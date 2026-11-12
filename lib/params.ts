/**
 * A card's parameters: a module's offer read from its `cards.json`, the values a card is set to
 * checked and filled in as the offer's JSON Schema says, and the route the card is drawn with.
 * Import-free, for the pages too.
 */

import type { CardOffer, CardParam, CardParams, CardSize, CardValue } from './api.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const NAME = /^[a-z0-9][a-z0-9-]*$/;
const TYPES = new Set(['string', 'number', 'integer', 'boolean', 'array']);
const FORMATS = new Set(['path', 'markdown', 'timezone', 'date', 'time']);

const isSize = (value: unknown): value is CardSize => Array.isArray(value) && value.length === 2 && value.every((n) => Number.isInteger(n) && n >= 1 && n <= 48);

/** Why `param` is not one the form can draw, or undefined when it is. */
const paramProblem = (key: string, param: unknown): string | undefined => {
  if (!isRecord(param)) return `${key} is not an object`;
  if (!TYPES.has(param.type as string)) return `${key}: type is not one of ${[...TYPES].join(', ')}`;
  if (param.format !== undefined && !FORMATS.has(param.format as string)) return `${key}: format is not one of ${[...FORMATS].join(', ')}`;
  if (param.type === 'array' && !(isRecord(param.items) && ['string', 'number'].includes(param.items.type as string))) {
    return `${key}: an array's items are strings or numbers`;
  }
  const choices = param['x-choices'];
  if (choices !== undefined) {
    if (!isRecord(choices) || typeof choices.command !== 'string' || typeof choices.value !== 'string' || typeof choices.label !== 'string') {
      return `${key}: x-choices takes a command, and the value and label fields of its answer`;
    }
  }
  return undefined;
};

/**
 * One entry of a module's `etc/dashboard.d/cards.json` as the card it offers, or why it is not
 * one. What it leaves out takes a default: the label for a description, a puzzle piece for an icon,
 * grey, a titled frame, one cell at least, and no parameters.
 */
export const readOffer = (module: string, raw: unknown): CardOffer | string => {
  if (!isRecord(raw)) return 'an entry is not an object';
  const { name, label, route, size } = raw;
  if (typeof name !== 'string' || !NAME.test(name)) return 'name is lower case letters, digits and -';
  const where = `${module}.${name}`;
  if (typeof label !== 'string' || label === '') return `${where}: label is missing`;
  if (typeof route !== 'string' || !route.startsWith('/') || route.includes('?')) return `${where}: route is a path, without a query`;
  if (!isSize(size)) return `${where}: size is [columns, rows]`;
  const min = raw.min === undefined ? [1, 1] as CardSize : raw.min;
  if (!isSize(min)) return `${where}: min is [columns, rows]`;
  const params: CardParams = { type: 'object', properties: {} };
  if (raw.params !== undefined) {
    if (!isRecord(raw.params) || raw.params.type !== 'object' || (raw.params.properties !== undefined && !isRecord(raw.params.properties))) {
      return `${where}: params is a JSON Schema of an object`;
    }
    for (const [key, param] of Object.entries(raw.params.properties ?? {})) {
      const problem = paramProblem(key, param);
      if (problem) return `${where}: ${problem}`;
      params.properties[key] = param as CardParam;
    }
    const required = raw.params.required;
    if (required !== undefined) {
      if (!Array.isArray(required) || !required.every((key) => typeof key === 'string' && key in params.properties)) {
        return `${where}: required names its own parameters`;
      }
      params.required = required as string[];
    }
  }
  return {
    id: where,
    module,
    name,
    label,
    description: typeof raw.description === 'string' && raw.description ? raw.description : label,
    icon: typeof raw.icon === 'string' && raw.icon ? raw.icon : 'puzzle',
    color: typeof raw.color === 'string' && raw.color ? raw.color : 'gray',
    route,
    frame: raw.frame === 'plain' ? 'plain' : 'titled',
    size,
    min,
    params,
  };
};

const TRUE = new Set(['true', '1', 'yes', 'on']);
const FALSE = new Set(['false', '0', 'no', 'off']);

/** `text`, as `--with key=text` gives it, read as `param` takes it; a string saying why when it cannot be. */
export const valueFrom = (param: CardParam, text: string): CardValue | { problem: string } => {
  switch (param.type) {
    case 'number':
    case 'integer': {
      const value = Number(text);
      if (text.trim() === '' || !Number.isFinite(value)) return { problem: `'${text}' is not a number` };
      if (param.type === 'integer' && !Number.isInteger(value)) return { problem: `'${text}' is not a whole number` };
      return value;
    }
    case 'boolean':
      if (TRUE.has(text.toLowerCase())) return true;
      if (FALSE.has(text.toLowerCase())) return false;
      return { problem: `'${text}' is not true or false` };
    case 'array':
      return text.split(',').map((part) => part.trim()).filter(Boolean);
    default:
      return text;
  }
};

/** The values `param` may take, when it names them. */
const choicesOf = (param: CardParam): (string | number)[] | undefined => param.enum ?? param.oneOf?.map((choice) => choice.const);

/** What is wrong with `value` for `param`, the parameter `key`; undefined when nothing is. */
const valueProblem = (key: string, param: CardParam, value: CardValue): string | undefined => {
  const kind = Array.isArray(value) ? 'array' : typeof value;
  const fits = param.type === 'integer' ? typeof value === 'number' && Number.isInteger(value) : param.type === kind;
  if (!fits) return `${key} takes a ${param.type === 'array' ? 'list' : param.type}`;
  if (typeof value === 'number') {
    if (param.minimum !== undefined && value < param.minimum) return `${key} is at least ${param.minimum}`;
    if (param.maximum !== undefined && value > param.maximum) return `${key} is at most ${param.maximum}`;
  }
  const choices = choicesOf(param);
  if (choices && !(Array.isArray(value) ? value : [value]).every((each) => choices.includes(each as string | number))) {
    return `${key} is one of ${choices.join(', ')}`;
  }
  return undefined;
};

/** What is wrong with `values` for `params`: a value of the wrong kind, out of range or not a choice, one it does not take, or a required one missing. */
export const problemsOf = (params: CardParams, values: Record<string, CardValue>): string[] => {
  const problems: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    const param = params.properties[key];
    if (!param) problems.push(`${key} is not one of its settings`);
    else {
      const problem = valueProblem(key, param, value);
      if (problem) problems.push(problem);
    }
  }
  for (const key of params.required ?? []) {
    const value = values[key] ?? params.properties[key]?.default;
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) problems.push(`${key} is needed`);
  }
  return problems;
};

/** `values` with each parameter it leaves out at its default, where there is one. */
export const withDefaults = (params: CardParams, values: Record<string, CardValue>): Record<string, CardValue> => {
  const filled: Record<string, CardValue> = {};
  for (const [key, param] of Object.entries(params.properties)) {
    const value = values[key] ?? param.default;
    if (value !== undefined) filled[key] = value;
  }
  return filled;
};

/** The route a card is drawn with: its own, its values in the query, a list's items each a value of the key. */
export const cardRoute = (route: string, values: Record<string, CardValue>): string => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    for (const each of Array.isArray(value) ? value : [value]) query.append(key, String(each));
  }
  const text = query.toString();
  return text ? `${route}?${text}` : route;
};
