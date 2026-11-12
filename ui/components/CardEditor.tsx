import { Alert, Box, Button, Group, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { DialogActions, RoutePanel, TablerIcon } from '@ein/ui/components';
import { useSurface } from '@ein/ui/hooks';
import { useDebouncedValue } from '@mantine/hooks';
import { type CSSProperties, type ReactNode, useState } from 'react';
import type { CardOffer, CardSize, CardValue } from '../../lib/api.ts';
import { cardRoute, problemsOf, withDefaults } from '../../lib/params.ts';
import { accentOf } from '../look.ts';
import { ParamsForm } from './ParamsForm.tsx';
import { Quiet } from './CardTile.tsx';

/** The sizes a card may be given here; its smallest leaves some out. */
const SIZES: { label: string; size: CardSize }[] = [
  { label: 'Small, 3 × 2', size: [3, 2] },
  { label: 'Medium, 4 × 3', size: [4, 3] },
  { label: 'Wide, 6 × 3', size: [6, 3] },
  { label: 'Tall, 3 × 5', size: [3, 5] },
  { label: 'Large, 6 × 5', size: [6, 5] },
  { label: 'Hero, 8 × 6', size: [8, 6] },
  { label: 'Banner, 12 × 3', size: [12, 3] },
];

type CardDraft = { values: Record<string, CardValue>; title: string; size: CardSize };

/**
 * A card's settings beside a preview of it: what it shows, from its offer's form, its title and its
 * size; the preview draws the card as it is set, a moment after each change.
 */
export function CardEditor({ offer, initial, submitLabel, onSubmit, extra }: {
  offer: CardOffer;
  initial: CardDraft;
  submitLabel: string;
  onSubmit: (draft: CardDraft) => Promise<void>;
  /** More buttons in the bar, before Cancel. */
  extra?: ReactNode;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [settled] = useDebouncedValue(draft.values, 400);
  const problems = problemsOf(offer.params, settled);
  const sizes = SIZES.filter(({ size }) => size[0] >= offer.min[0] && size[1] >= offer.min[1]);
  const sizeKey = draft.size.join('x');
  const surface = useSurface();

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSubmit(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className='mrx-dialog-form'
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing='lg'>
        <Stack gap='sm'>
          <Text size='sm' c='dimmed'>{offer.description}</Text>
          {error && <Alert color='red' variant='light'>{error}</Alert>}
          <ParamsForm params={offer.params} values={draft.values} onChange={(values) => setDraft({ ...draft, values })} />
          {offer.frame === 'titled' && (
            <TextInput
              label='Title'
              placeholder={offer.label}
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.currentTarget.value })}
            />
          )}
          <Select
            label='Size'
            data={[
              ...sizes.map(({ label, size }) => ({ value: size.join('x'), label })),
              ...(sizes.some(({ size }) => size.join('x') === sizeKey) ? [] : [{ value: sizeKey, label: draft.size.join(' × ') }]),
            ]}
            value={sizeKey}
            onChange={(value) => value && setDraft({ ...draft, size: value.split('x').map(Number) as CardSize })}
            allowDeselect={false}
          />
        </Stack>
        <Stack gap={6}>
          <Text size='xs' c='dimmed' fw={600} tt='uppercase'>Preview</Text>
          <Box
            className='dash-tile'
            data-frame={offer.frame}
            style={{ '--dash-accent': accentOf(offer.color), aspectRatio: `${draft.size[0]} / ${draft.size[1] * 0.62}`, maxHeight: 320, animation: 'none' } as CSSProperties}
          >
            {offer.frame === 'titled' && (
              <div className='dash-tile-head'>
                <span className='dash-tile-icon'>
                  <TablerIcon name={offer.icon} size={16} />
                </span>
                <span className='dash-tile-title'>{draft.title || offer.label}</span>
              </div>
            )}
            <div className='dash-tile-body'>
              {problems.length > 0
                ? <Quiet icon='adjustments'>{problems.join('; ')}</Quiet>
                : <RoutePanel key={JSON.stringify(settled)} path={cardRoute(offer.route, withDefaults(offer.params, settled))} />}
            </div>
          </Box>
        </Stack>
      </SimpleGrid>
      <DialogActions>
        <Group gap='xs' mr='auto'>{extra}</Group>
        <Button variant='default' onClick={surface.close}>Cancel</Button>
        <Button type='submit' loading={saving} disabled={problemsOf(offer.params, draft.values).length > 0}>{submitLabel}</Button>
      </DialogActions>
    </form>
  );
}
