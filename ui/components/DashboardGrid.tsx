import { Stack, Text } from '@mantine/core';
import { TablerIcon } from '@ein/ui/components';
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type { CardSize, ShownCard } from '../../lib/api.ts';
import { NARROW_COLUMNS, narrowSize, pack } from '../../lib/layout.ts';
import { CardTile } from './CardTile.tsx';

/** How tall a row is, for each column's width: rows and columns keep a card's shape wherever it is drawn. */
const ROW_RATIO = 0.62;

/** The size of the tile that adds a card, while editing. */
const ADD_SIZE: CardSize = [3, 2];

type Props = {
  cards: ShownCard[];
  columns: number;
  /** Cells across the grid has room for; a phone shows `NARROW_COLUMNS`. */
  narrow?: boolean;
  /**
   * `fit` lays every row into the box the grid is given (the wall); otherwise rows are as tall as
   * the width calls for and the page scrolls.
   */
  fit?: boolean;
  width: number;
  gap: number;
  editing?: boolean;
  /** Tools over a card while editing. */
  tools?: (card: ShownCard, at: number) => ReactNode;
  /** A card moved to another place, by its grip. */
  onMove?: (id: string, to: number) => void;
  onAdd?: () => void;
};

/** Where a card's grip is held: which card, and the order it is being dragged through. */
type Drag = { id: string; order: string[] };

/**
 * A dashboard's cards in its grid, laid out as the commands lay them out (`pack`): in order, each
 * at the first place it fits from the top left. While editing, a card's grip drags it through the
 * others, which make room as it passes; letting go puts it there.
 */
export function DashboardGrid({ cards, columns, narrow, fit, width, gap, editing, tools, onMove, onAdd }: Props) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;

  const ordered = useMemo(() => {
    if (!drag) return cards;
    const byId = new Map(cards.map((card) => [card.id, card]));
    return drag.order.flatMap((id) => byId.get(id) ?? []);
  }, [cards, drag]);

  const across = narrow ? NARROW_COLUMNS : columns;
  const sizes = ordered.map((card) => narrow ? narrowSize(card.size, columns) : card.size);
  const adding = editing && onAdd;
  const { placements, rows } = pack(adding ? [...sizes, narrow ? narrowSize(ADD_SIZE, columns) : ADD_SIZE] : sizes, across);
  const row = fit ? '1fr' : `${Math.max(36, Math.round(((width - gap * (across - 1)) / across) * ROW_RATIO))}px`;

  // A grip held: the card follows the pointer through the others; let go, it stays where it is.
  useEffect(() => {
    if (!drag) return;
    const move = (event: PointerEvent) => {
      const over = (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-card-id]');
      const target = over?.dataset.cardId;
      const current = dragRef.current;
      if (!current || !target || target === current.id) return;
      const order = current.order.filter((id) => id !== current.id);
      order.splice(current.order.indexOf(target), 0, current.id);
      setDrag({ ...current, order });
    };
    const up = () => {
      const current = dragRef.current;
      setDrag(null);
      if (!current) return;
      const to = current.order.indexOf(current.id);
      if (to !== cards.findIndex((card) => card.id === current.id)) onMove?.(current.id, to);
    };
    globalThis.addEventListener('pointermove', move);
    globalThis.addEventListener('pointerup', up, { once: true });
    return () => {
      globalThis.removeEventListener('pointermove', move);
      globalThis.removeEventListener('pointerup', up);
    };
  }, [drag !== null]);

  const place = (at: number): CSSProperties => {
    const { x, y, w, h } = placements[at];
    return { gridColumn: `${x + 1} / span ${w}`, gridRow: `${y + 1} / span ${h}` };
  };

  return (
    <div
      className='dash-grid'
      data-editing={editing || undefined}
      style={{
        '--dash-columns': across,
        '--dash-rows': Math.max(rows, 1),
        '--dash-row': row,
        '--dash-gap': `${gap}px`,
        ...(fit ? { height: '100%' } : {}),
      } as CSSProperties}
    >
      {ordered.map((card, at) => (
        <CardTile
          key={card.id}
          card={card}
          order={at}
          place={place(at)}
          lifted={drag?.id === card.id}
          tools={editing && tools && (
            <div
              className='dash-tile-tools'
              onPointerDown={(event) => {
                if ((event.target as HTMLElement).closest('.dash-grip')) {
                  event.preventDefault();
                  setDrag({ id: card.id, order: cards.map((each) => each.id) });
                }
              }}
            >
              {tools(card, at)}
            </div>
          )}
        />
      ))}
      {adding && (
        <button type='button' className='dash-add' style={place(ordered.length)} onClick={onAdd}>
          <Stack gap={6} align='center'>
            <TablerIcon name='plus' size={26} />
            <Text size='sm' fw={600}>Add card</Text>
          </Stack>
        </button>
      )}
    </div>
  );
}
