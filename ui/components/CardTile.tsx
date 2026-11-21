import { Skeleton, Stack, Text } from '@mantine/core';
import { RoutePanel, TablerIcon } from '@ein/ui/components';
import type { HatPiece } from '@ein/ui/lib';
import type { CSSProperties, ReactNode } from 'react';
import type { ShownCard } from '../../lib/api.ts';
import { accentOf } from '../look.ts';

/** How far a piece's content keeps from the nearest point of its edge, in px. */
const PIECE_PADDING = 30;

/**
 * The padding across `size` px of a piece's clear box: `PIECE_PADDING`, or less in a piece too small
 * to give it and still show what it holds, such as a card one row high.
 */
const piecePadding = (size: number): number => Math.min(PIECE_PADDING, Math.round(size * 0.12));

/** What a tile says in place of its card: quiet, in the middle, in the card's own words. */
export function Quiet({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className='dash-tile-quiet'>
      <TablerIcon name={icon} size={26} stroke={1.5} />
      <Text size='sm' c='dimmed' maw={260}>{children}</Text>
    </div>
  );
}

/** A card on its way: bars in the shape of what most cards draw, kept clear of a piece's edge. */
function Loading() {
  return (
    <Stack gap={10} p={4} style={{ margin: 'var(--dash-inset-top, 0) var(--dash-inset-right, 0) 0 var(--dash-inset-left, 0)' }}>
      <Skeleton height={14} width='55%' radius='xl' />
      <Skeleton height={10} width='80%' radius='xl' />
      <Skeleton height={10} width='65%' radius='xl' />
    </Stack>
  );
}

/**
 * One card on a dashboard: a tile in its accent — a faint glow from its corner and a ring of it —
 * with a header of its icon in a glassy tile and its title, unless it draws the whole tile itself
 * (`plain`) or was given no title; then the route that draws it, or why it cannot be drawn.
 * `tools` stand over it while the dashboard is edited, and `corner` in its bottom right.
 *
 * Given a `piece` of the hat tiling it is cut along that piece's hats instead, its hats faint inside
 * it and its edge a line of its accent; its header and route keep clear of the edge by
 * `piecePadding`, and a `plain` route has the whole piece, told how far in its words keep clear.
 */
export function CardTile({ card, order, place, piece, lifted, resizing, tools, corner }: {
  card: ShownCard;
  /** Its place in the order it rises in as the page arrives. */
  order: number;
  /** Its cells in the grid, as CSS grid lines, or its box when it is a piece that holds no hat. */
  place: CSSProperties;
  piece?: HatPiece;
  lifted?: boolean;
  resizing?: boolean;
  tools?: ReactNode;
  corner?: ReactNode;
}) {
  const header = card.frame === 'titled' && card.title !== false && (
    <div className='dash-tile-head'>
      <span className='dash-tile-icon'>
        <TablerIcon name={card.icon} size={16} />
      </span>
      <span className='dash-tile-title'>{card.title || card.label}</span>
    </div>
  );
  const route = card.route
    ? <RoutePanel path={card.route} loading={<Loading />} failed={<Quiet icon='plug-connected-x'>{card.label} could not be drawn here</Quiet>} />
    : <Quiet icon={card.problem?.startsWith('no module') ? 'puzzle-off' : 'adjustments'}>{card.problem}</Quiet>;
  const accent = { '--dash-accent': accentOf(card.color), '--dash-order': order };

  if (piece) {
    const [left, top, width, height] = piece.box;
    const [x, y, w, h] = piece.clear;
    const [across, down] = [piecePadding(w), piecePadding(h)];
    return (
      <div
        className='dash-tile dash-piece'
        data-card-id={card.id}
        data-frame={card.frame}
        style={{ left, top, width, height, clipPath: `path('${piece.outline}')`, ...accent } as CSSProperties}
      >
        <svg className='dash-piece-art' width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden focusable='false'>
          <path className='dash-piece-mirrored' d={piece.mirrored} />
          <path className='dash-piece-tiles' d={piece.tiles} />
          <path className='dash-piece-edge' d={piece.outline} />
        </svg>
        {card.frame === 'plain'
          ? (
            <div
              className='dash-tile-body'
              style={{
                '--dash-inset-top': `${y + down}px`,
                '--dash-inset-right': `${width - x - w + across}px`,
                '--dash-inset-bottom': `${height - y - h + down}px`,
                '--dash-inset-left': `${x + across}px`,
              } as CSSProperties}
            >
              {route}
            </div>
          )
          : (
            <div className='dash-piece-content' style={{ left: x, top: y, width: w, height: h, padding: `${down}px ${across}px` }}>
              {header}
              <div className='dash-tile-body'>{route}</div>
            </div>
          )}
      </div>
    );
  }

  return (
    <div
      className='dash-tile'
      data-card-id={card.id}
      data-frame={card.frame}
      data-lifted={lifted || undefined}
      data-resizing={resizing || undefined}
      style={{ ...place, ...accent } as CSSProperties}
    >
      {tools}
      {header}
      <div className='dash-tile-body'>{route}</div>
      {corner}
    </div>
  );
}
