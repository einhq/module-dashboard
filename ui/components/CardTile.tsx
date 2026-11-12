import { Skeleton, Stack, Text } from '@mantine/core';
import { RoutePanel, TablerIcon } from '@ein/ui/components';
import type { CSSProperties, ReactNode } from 'react';
import type { ShownCard } from '../../lib/api.ts';
import { accentOf } from '../look.ts';

/** What a tile says in place of its card: quiet, in the middle, in the card's own words. */
export function Quiet({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className='dash-tile-quiet'>
      <TablerIcon name={icon} size={26} stroke={1.5} />
      <Text size='sm' c='dimmed' maw={260}>{children}</Text>
    </div>
  );
}

/** A card on its way: bars in the shape of what most cards draw. */
function Loading() {
  return (
    <Stack gap={10} p={4}>
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
 */
export function CardTile({ card, order, place, lifted, resizing, tools, corner }: {
  card: ShownCard;
  /** Its place in the order it rises in as the page arrives. */
  order: number;
  /** Its cells in the grid, as CSS grid lines. */
  place: CSSProperties;
  lifted?: boolean;
  resizing?: boolean;
  tools?: ReactNode;
  corner?: ReactNode;
}) {
  const header = card.frame === 'titled' && card.title !== false;
  return (
    <div
      className='dash-tile'
      data-card-id={card.id}
      data-frame={card.frame}
      data-lifted={lifted || undefined}
      data-resizing={resizing || undefined}
      style={{ ...place, '--dash-accent': accentOf(card.color), '--dash-order': order } as CSSProperties}
    >
      {tools}
      {header && (
        <div className='dash-tile-head'>
          <span className='dash-tile-icon'>
            <TablerIcon name={card.icon} size={16} />
          </span>
          <span className='dash-tile-title'>{card.title || card.label}</span>
        </div>
      )}
      <div className='dash-tile-body'>
        {card.route
          ? <RoutePanel path={card.route} loading={<Loading />} failed={<Quiet icon='plug-connected-x'>{card.label} could not be drawn here</Quiet>} />
          : <Quiet icon={card.problem?.startsWith('no module') ? 'puzzle-off' : 'adjustments'}>{card.problem}</Quiet>}
      </div>
      {corner}
    </div>
  );
}
