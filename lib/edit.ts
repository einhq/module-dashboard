/**
 * What the commands that change a dashboard share: sizes and values as a command line gives them,
 * checked against the card's offer before anything is written.
 */

import type { CardOffer, CardSize, CardValue } from './api.ts';
import { problemsOf, valueFrom } from './params.ts';
import { DashboardError } from './store.ts';

/** A size as `--size` gives it, `<columns>x<rows>`. */
export const parseSize = (text: string): CardSize => {
  const match = /^(\d{1,2})x(\d{1,2})$/.exec(text.trim());
  if (!match || Number(match[1]) < 1 || Number(match[2]) < 1) throw new DashboardError(`--size is <columns>x<rows>, such as 4x3, not '${text}'`);
  return [Number(match[1]), Number(match[2])];
};

/** `size` as `offer` lets a card be: at least its smallest. */
export const checkSize = (offer: CardOffer, size: CardSize): CardSize => {
  if (size[0] < offer.min[0] || size[1] < offer.min[1]) throw new DashboardError(`${offer.label} is at least ${offer.min.join('x')}`);
  return size;
};

/**
 * `values` with each `--with key=value` read as the offer's parameter takes it and `--without key`
 * taken away, refused whole when any of it does not fit the offer.
 */
export const changedValues = (
  offer: CardOffer,
  values: Record<string, CardValue>,
  given: string[],
  without: string[] = [],
): Record<string, CardValue> => {
  const changed = { ...values };
  for (const entry of given) {
    const at = entry.indexOf('=');
    if (at < 1) throw new DashboardError(`--with is key=value, not '${entry}'`);
    const key = entry.slice(0, at);
    const param = offer.params.properties[key];
    if (!param) throw new DashboardError(`${offer.label} has no setting ${key}; it takes ${Object.keys(offer.params.properties).join(', ') || 'none'}`);
    const value = valueFrom(param, entry.slice(at + 1));
    if (typeof value === 'object' && !Array.isArray(value)) throw new DashboardError(`${key}: ${value.problem}`);
    changed[key] = value;
  }
  for (const key of without) delete changed[key];
  const problems = problemsOf(offer.params, changed);
  if (problems.length > 0) throw new DashboardError(problems.join('; '));
  return changed;
};
