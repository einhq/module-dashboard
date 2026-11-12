import { Stack, Text, Tooltip } from '@mantine/core';
import { TablerIcon } from '@ein/ui/components';
import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type { CardSize, ShownCard } from '../../lib/api.ts';
import { NARROW_COLUMNS, narrowSize, pack, resized } from '../../lib/layout.ts';
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
  /** A card given another size, by its corner. */
  onResize?: (id: string, size: CardSize) => void;
  onAdd?: () => void;
};

/**
 * A card held: by its grip, with the order it is being dragged through, or by its corner, with its
 * size and where the pointer was when it was taken, and the size it is dragged to. Let go
 * (`done`), the grid keeps showing it so until the dashboard comes back changed.
 */
type Hold =
  | { kind: 'move'; id: string; order: string[]; done?: boolean }
  | { kind: 'resize'; id: string; start: CardSize; from: [number, number]; pitch: [number, number]; min: CardSize; size: CardSize; done?: boolean };

/**
 * A dashboard's cards in its grid, laid out as the commands lay them out (`pack`): in order, each
 * at the first place it fits from the top left. While editing, a card's grip drags it through the
 * others, which make room as it passes, and its corner drags it a cell at a time to another size,
 * the others laid out around it as it grows; letting go puts it there. A phone, whose two columns
 * the sizes are made into, has no corner.
 */
export function DashboardGrid({ cards, columns, narrow, fit, width, gap, editing, tools, onMove, onResize, onAdd }: Props) {
  const [hold, setHold] = useState<Hold | null>(null);
  const holdRef = useRef<Hold | null>(null);
  holdRef.current = hold;
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => setHold((held) => held?.done ? null : held), [cards]);

  const ordered = useMemo(() => {
    if (hold?.kind !== 'move') return cards;
    const byId = new Map(cards.map((card) => [card.id, card]));
    return hold.order.flatMap((id) => byId.get(id) ?? []);
  }, [cards, hold]);

  const across = narrow ? NARROW_COLUMNS : columns;
  const sizeOf = (card: ShownCard): CardSize => hold?.kind === 'resize' && hold.id === card.id ? hold.size : card.size;
  const sizes = ordered.map((card) => narrow ? narrowSize(sizeOf(card), columns) : sizeOf(card));
  const adding = editing && onAdd;
  const { placements, rows } = pack(adding ? [...sizes, narrow ? narrowSize(ADD_SIZE, columns) : ADD_SIZE] : sizes, across);
  const row = fit ? '1fr' : `${Math.max(36, Math.round(((width - gap * (across - 1)) / across) * ROW_RATIO))}px`;

  // A grip held: the card follows the pointer through the others. A corner held: the card takes
  // the cells the pointer has moved over. Let go, it stays as it is.
  const holding = hold && !hold.done ? hold.kind : null;
  useEffect(() => {
    if (!holding) return;
    const move = (event: PointerEvent) => {
      const current = holdRef.current;
      if (!current || current.done) return;
      if (current.kind === 'resize') {
        const size = resized(current.start, [event.clientX - current.from[0], event.clientY - current.from[1]], current.pitch, current.min, columns);
        if (size[0] !== current.size[0] || size[1] !== current.size[1]) setHold({ ...current, size });
        return;
      }
      const over = (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-card-id]');
      const target = over?.dataset.cardId;
      if (!target || target === current.id) return;
      const order = current.order.filter((id) => id !== current.id);
      order.splice(current.order.indexOf(target), 0, current.id);
      setHold({ ...current, order });
    };
    const up = () => {
      const current = holdRef.current;
      if (!current) return;
      if (current.kind === 'resize') {
        const changed = current.size[0] !== current.start[0] || current.size[1] !== current.start[1];
        setHold(changed ? { ...current, done: true } : null);
        if (changed) onResize?.(current.id, current.size);
        return;
      }
      const to = current.order.indexOf(current.id);
      const changed = to !== cards.findIndex((card) => card.id === current.id);
      setHold(changed ? { ...current, done: true } : null);
      if (changed) onMove?.(current.id, to);
    };
    const cancel = () => setHold(null);
    globalThis.addEventListener('pointermove', move);
    globalThis.addEventListener('pointerup', up, { once: true });
    globalThis.addEventListener('pointercancel', cancel, { once: true });
    return () => {
      globalThis.removeEventListener('pointermove', move);
      globalThis.removeEventListener('pointerup', up);
      globalThis.removeEventListener('pointercancel', cancel);
    };
  }, [holding]);

  // A cell's pitch is measured from the grid as drawn, so the wall's rows and the page's agree.
  const startResize = (event: ReactPointerEvent, card: ShownCard) => {
    const grid = gridRef.current;
    if (!grid || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const box = grid.getBoundingClientRect();
    setHold({
      kind: 'resize',
      id: card.id,
      start: card.size,
      from: [event.clientX, event.clientY],
      pitch: [(box.width + gap) / across, (box.height + gap) / Math.max(rows, 1)],
      min: card.min ?? [1, 1],
      size: card.size,
    });
  };

  const place = (at: number): CSSProperties => {
    const { x, y, w, h } = placements[at];
    return { gridColumn: `${x + 1} / span ${w}`, gridRow: `${y + 1} / span ${h}` };
  };

  return (
    <div
      ref={gridRef}
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
          lifted={hold?.kind === 'move' && hold.id === card.id}
          resizing={hold?.kind === 'resize' && hold.id === card.id && !hold.done}
          tools={editing && tools && (
            <div
              className='dash-tile-tools'
              onPointerDown={(event) => {
                if ((event.target as HTMLElement).closest('.dash-grip')) {
                  event.preventDefault();
                  setHold({ kind: 'move', id: card.id, order: cards.map((each) => each.id) });
                }
              }}
            >
              {tools(card, at)}
            </div>
          )}
          corner={editing && onResize && !narrow && (
            <>
              {hold?.kind === 'resize' && hold.id === card.id && !hold.done && <span className='dash-size'>{hold.size.join(' × ')}</span>}
              <Tooltip label='Drag to resize' withArrow disabled={hold !== null}>
                <span className='dash-corner' aria-hidden onPointerDown={(event) => startResize(event, card)} />
              </Tooltip>
            </>
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
