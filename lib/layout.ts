/**
 * How a dashboard's cards are laid out: in their order, each at the first place from the top left
 * where it fits, so a small card fills a gap a larger one left. The page, the wall, the list's
 * miniature and the commands all lay out with this, so they agree. Import-free, for the pages too.
 */

import type { CardSize, Placement } from './api.ts';

/** Cells across a dashboard has unless it says otherwise. */
export const DEFAULT_COLUMNS = 12;

/** The widths a dashboard may be laid out in. */
export const COLUMN_CHOICES = [6, 8, 12] as const;

/** Cells across a phone shows a dashboard in. */
export const NARROW_COLUMNS = 2;

/** A size within `columns`: at least one cell each way, no wider than the dashboard. */
export const fitSize = ([w, h]: CardSize, columns: number): CardSize => [
  Math.min(Math.max(1, Math.round(w)), columns),
  Math.max(1, Math.round(h)),
];

/** Every card's place, in order, and how many rows they take. */
export const pack = (sizes: CardSize[], columns: number): { placements: Placement[]; rows: number } => {
  const taken: boolean[][] = [];
  const free = (x: number, y: number, w: number, h: number): boolean => {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) if (taken[row]?.[col]) return false;
    }
    return true;
  };
  const take = ({ x, y, w, h }: Placement): void => {
    for (let row = y; row < y + h; row++) {
      taken[row] ??= [];
      for (let col = x; col < x + w; col++) taken[row][col] = true;
    }
  };

  const placements = sizes.map((size): Placement => {
    const [w, h] = fitSize(size, columns);
    for (let y = 0;; y++) {
      for (let x = 0; x + w <= columns; x++) {
        if (!free(x, y, w, h)) continue;
        const placement = { x, y, w, h };
        take(placement);
        return placement;
      }
    }
  });
  return { placements, rows: placements.reduce((most, { y, h }) => Math.max(most, y + h), 0) };
};

/**
 * A card's size on a phone, `NARROW_COLUMNS` across: one that took up to a quarter of the
 * dashboard's width takes one cell, a wider one the whole width. A row is as tall as a cell is
 * wide, in proportion, wherever it is drawn, so keeping the card's shape keeps its rows to its
 * columns.
 */
export const narrowSize = ([w, h]: CardSize, columns: number): CardSize => {
  const across = w * 4 <= columns ? 1 : NARROW_COLUMNS;
  return [across, Math.max(1, Math.round((h * across) / w))];
};
