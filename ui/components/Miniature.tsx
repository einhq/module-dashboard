import type { DashboardSummary } from '../../lib/api.ts';
import { accentOf, mantineOf } from '../look.ts';

/** How tall a row is for a column's width, as the page lays them out, so the miniature has its shape. */
const ROW = 0.62;

/**
 * A dashboard's cover: its cards as they are laid out, each a rounded tile in its colour on the
 * chrome's ground, which a glow of the dashboard's own colour lights from a corner. An empty one
 * shows the grid it waits to fill.
 */
export function Miniature({ dashboard }: { dashboard: DashboardSummary }) {
  const columns = dashboard.columns;
  const rows = Math.max(dashboard.tiles.reduce((most, tile) => Math.max(most, tile.y + tile.h), 0), Math.ceil(columns / 1.5 / ROW));
  const height = rows * ROW;
  const gap = 0.18;
  const glow = accentOf(mantineOf(dashboard.color));
  const id = `dash-mini-${dashboard.name.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg viewBox={`-0.6 -0.6 ${columns + 1.2} ${height + 1.2}`} preserveAspectRatio='xMidYMid meet' width='100%' height='100%' aria-hidden style={{ display: 'block' }}>
      <defs>
        <radialGradient id={id} cx='0' cy='0' r='1.2'>
          <stop offset='0' stopColor={glow} stopOpacity='0.3' />
          <stop offset='1' stopColor={glow} stopOpacity='0' />
        </radialGradient>
      </defs>
      <rect x={-0.6} y={-0.6} width={columns + 1.2} height={height + 1.2} fill='var(--mrx-surface-chrome)' />
      <rect x={-0.6} y={-0.6} width={columns + 1.2} height={height + 1.2} fill={`url(#${id})`} />
      {dashboard.tiles.length === 0
        ? Array.from(
          { length: columns * rows },
          (_, at) => (
            <rect
              key={at}
              x={(at % columns) + gap}
              y={Math.floor(at / columns) + gap}
              width={1 - 2 * gap}
              height={1 - 2 * gap}
              rx={0.12}
              fill='var(--mrx-hairline)'
              opacity={0.5}
            />
          ),
        )
        : dashboard.tiles.map((tile, at) => (
          <rect
            key={at}
            x={tile.x + gap}
            y={tile.y * ROW + gap}
            width={tile.w - 2 * gap}
            height={tile.h * ROW - 2 * gap}
            rx={0.3}
            fill={`var(--mantine-color-${tile.color}-7)`}
            fillOpacity={0.55}
            stroke={`var(--mantine-color-${tile.color}-4)`}
            strokeOpacity={0.8}
            strokeWidth={0.06}
          />
        ))}
    </svg>
  );
}
