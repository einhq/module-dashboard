import { MultiSelect, NumberInput, Select, Stack, Switch, TagsInput, Textarea, TextInput } from '@mantine/core';
import { MarkdownEditor } from '@ein/ui/components';
import { shq } from '@ein/ui/lib';
import { execCommand } from '@ein/ui/signals';
import { useEffect, useMemo, useState } from 'react';
import type { CardParam, CardParams, CardValue } from '../../lib/api.ts';

type Choice = { value: string; label: string };

/** The field a key path names in an answer: `endpointList`, `a.b`. */
const at = (value: unknown, path: string | undefined): unknown =>
  !path ? value : path.split('.').reduce<unknown>((into, key) => (into && typeof into === 'object' ? (into as Record<string, unknown>)[key] : undefined), value);

/** Whether an item of a choices command's answer has, in each field `where` names, one of its values. */
const matches = (item: unknown, where: Record<string, CardValue> | undefined): boolean =>
  Object.entries(where ?? {}).every(([path, wanted]) => ([] as unknown[]).concat(wanted).includes(at(item, path)));

/**
 * The choices a parameter's `x-choices` command lists, read as the person editing, with `{param}`
 * filled in from the form's other values; none while one it needs is unset. Only the items its
 * `where` matches are listed, and a choice the answer repeats only once.
 */
function useChoices(param: CardParam, values: Record<string, CardValue>): { choices: Choice[]; loading: boolean } {
  const spec = param['x-choices'];
  const command = useMemo(() => {
    if (!spec) return undefined;
    let missing = false;
    const line = spec.command.replace(/\{([a-zA-Z0-9_-]+)\}/g, (_, key: string) => {
      const value = values[key];
      if (value === undefined || value === '') missing = true;
      return shq(String(value ?? ''));
    });
    return missing ? undefined : line;
  }, [spec?.command, JSON.stringify(values)]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!spec || !command) return setChoices([]);
    let cancelled = false;
    setLoading(true);
    execCommand<unknown>(command)
      .then((answer) => {
        if (cancelled) return;
        const list = at(answer, spec.items);
        const seen = new Set<string>();
        const read: Choice[] = [];
        for (const item of Array.isArray(list) ? list : []) {
          if (!matches(item, spec.where)) continue;
          const value = at(item, spec.value);
          if (value === undefined || value === null || seen.has(String(value))) continue;
          seen.add(String(value));
          read.push({ value: String(value), label: String(at(item, spec.label) ?? value) });
        }
        setChoices(read);
      })
      .catch(() => !cancelled && setChoices([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [command]);

  return { choices, loading };
}

/** The values a parameter names itself: its `oneOf` with their titles, or its `enum`. */
const ownChoices = (param: CardParam): Choice[] | undefined =>
  param.oneOf?.map((choice) => ({ value: String(choice.const), label: choice.title ?? String(choice.const) })) ??
    param.enum?.map((value) => ({ value: String(value), label: String(value) }));

/** Every time zone the browser knows: what the server checks against too. */
const ZONES = (() => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [];
  }
})();

function ParamField({ name, param, required, values, onChange }: {
  name: string;
  param: CardParam;
  required: boolean;
  values: Record<string, CardValue>;
  onChange: (value: CardValue | undefined) => void;
}) {
  const { choices: listed, loading } = useChoices(param, values);
  const value = values[name] ?? param.default;
  const label = param.title ?? name;
  const common = { label, description: param.description, required };
  const choices = ownChoices(param) ?? (param['x-choices'] ? listed : undefined);

  if (param.type === 'boolean') {
    return <Switch label={label} description={param.description} checked={value === true} onChange={(event) => onChange(event.currentTarget.checked)} />;
  }
  if (param.type === 'array') {
    const list = Array.isArray(value) ? value.map(String) : [];
    if (choices) {
      return (
        <MultiSelect
          {...common}
          data={choices}
          value={list}
          onChange={(next) => onChange(next.length ? next : undefined)}
          searchable
          clearable
          placeholder={loading ? 'Reading…' : undefined}
        />
      );
    }
    return <TagsInput {...common} value={list} onChange={(next) => onChange(next.length ? next : undefined)} />;
  }
  if (param.type === 'number' || param.type === 'integer') {
    return (
      <NumberInput
        {...common}
        value={typeof value === 'number' ? value : ''}
        min={param.minimum}
        max={param.maximum}
        allowDecimal={param.type === 'number'}
        onChange={(next) => onChange(typeof next === 'number' ? next : undefined)}
      />
    );
  }
  const text = value === undefined ? '' : String(value);
  if (choices) {
    return (
      <Select
        {...common}
        data={choices}
        value={text || null}
        onChange={(next) => onChange(next ?? undefined)}
        searchable
        clearable={!required}
        placeholder={loading ? 'Reading…' : choices.length === 0 && param['x-choices'] ? 'Nothing to choose from yet' : undefined}
        nothingFoundMessage='Nothing matches'
      />
    );
  }
  if (param.format === 'timezone') {
    return <Select {...common} data={ZONES} value={text || null} onChange={(next) => onChange(next ?? undefined)} searchable clearable placeholder='The screen’s own' />;
  }
  if (param.format === 'markdown') {
    return <MarkdownEditor label={label} description={param.description} required={required} value={text} onChange={(next) => onChange(next || undefined)} minRows={4} />;
  }
  if (param.format === 'path') {
    return (
      <TextInput
        {...common}
        value={text}
        onChange={(event) => onChange(event.currentTarget.value || undefined)}
        placeholder='/archive/…'
        styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
      />
    );
  }
  if (text.length > 80) return <Textarea {...common} value={text} onChange={(event) => onChange(event.currentTarget.value || undefined)} autosize minRows={2} />;
  return <TextInput {...common} value={text} onChange={(event) => onChange(event.currentTarget.value || undefined)} />;
}

/**
 * A card's settings as a form, drawn from its offer's JSON Schema: a switch, a number, a text, a
 * list, or a choice — read from the command its `x-choices` names, as the person editing — for
 * each, in the order the offer lists them.
 */
export function ParamsForm({ params, values, onChange }: {
  params: CardParams;
  values: Record<string, CardValue>;
  onChange: (values: Record<string, CardValue>) => void;
}) {
  const entries = Object.entries(params.properties);
  if (entries.length === 0) return null;
  return (
    <Stack gap='sm'>
      {entries.map(([name, param]) => (
        <ParamField
          key={name}
          name={name}
          param={param}
          required={params.required?.includes(name) ?? false}
          values={values}
          onChange={(value) => {
            const next = { ...values };
            if (value === undefined) delete next[name];
            else next[name] = value;
            onChange(next);
          }}
        />
      ))}
    </Stack>
  );
}

/** The `--with` and `--without` words that set a card to `values` from `was`. */
export const valueArgs = (values: Record<string, CardValue>, was: Record<string, CardValue> = {}): string => {
  const words: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (JSON.stringify(value) === JSON.stringify(was[key])) continue;
    words.push(`--with ${shq(`${key}=${Array.isArray(value) ? value.join(',') : String(value)}`)}`);
  }
  for (const key of Object.keys(was)) if (!(key in values)) words.push(`--without ${shq(key)}`);
  return words.join(' ');
};
