import { ActionIcon, Tooltip } from '@mantine/core';
import { useSignals } from '@preact/signals-react/runtime';
import { HatField, type HatPattern, PageLoader, TablerIcon } from '@ein/ui/components';
import { useCommand, useElementWidth, useNodeEvents, useSurface, useWakeLock } from '@ein/ui/hooks';
import { shq } from '@ein/ui/lib';
import { isAuthenticated } from '@ein/ui/signals';
import { type CSSProperties, useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import type { Dashboard, WallSettings } from '../../lib/api.ts';
import { DashboardGrid } from '../components/DashboardGrid.tsx';
import { Quiet } from '../components/CardTile.tsx';
import { dashboardFile, dashboardRoute, wallRoute } from '../look.ts';
import '../dashboard.css';

/** How long the pointer rests before the cursor and the controls go. */
const IDLE_MS = 3000;

/** When a wall loads itself again each night, local time, to take what a deploy brought; a few minutes apart per screen. */
const RELOAD_AT = { hour: 3, minute: 30, spreadMs: 10 * 60_000 };

/** How far, and how often, the cards drift, so nothing stands still on a screen for months. */
const DRIFT_PX = 3;
const DRIFT_MS = 10 * 60_000;

/** Below this width the wall scrolls rather than fitting every row onto the screen. */
const NARROW_PX = 700;

/** Minutes since midnight of `HH:MM`. */
const minutesOf = (time: string): number => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** How bright the wall is now: dimmed between `dim`'s times, which may run past midnight. */
const brightness = (wall: WallSettings, now = new Date()): number => {
  if (!wall.dim) return 1;
  const at = now.getHours() * 60 + now.getMinutes();
  const from = minutesOf(wall.dim.from);
  const to = minutesOf(wall.dim.to);
  const dimmed = from <= to ? at >= from && at < to : at >= from || at < to;
  return dimmed ? wall.dim.level : 1;
};

/** Load the page again at the next `RELOAD_AT`. */
function useNightlyReload() {
  useEffect(() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), RELOAD_AT.hour, RELOAD_AT.minute);
    if (next <= now) next.setDate(next.getDate() + 1);
    const timer = setTimeout(() => globalThis.location.reload(), next.getTime() - now.getTime() + Math.random() * RELOAD_AT.spreadMs);
    return () => clearTimeout(timer);
  }, []);
}

/** Whether the pointer has rested a while: the cursor and the controls then go. */
function useIdle(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), IDLE_MS);
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), IDLE_MS);
    };
    for (const event of ['pointermove', 'pointerdown', 'keydown']) globalThis.addEventListener(event, wake);
    return () => {
      clearTimeout(timer);
      for (const event of ['pointermove', 'pointerdown', 'keydown']) globalThis.removeEventListener(event, wake);
    };
  }, []);
  return idle;
}

/** A value that changes on a clock: `every` ms, `read` again. */
function useEvery<T>(every: number, read: () => T): T {
  const [value, setValue] = useState(read);
  useEffect(() => {
    const timer = setInterval(() => setValue(read()), every);
    return () => clearInterval(timer);
  }, [every, read]);
  return value;
}

/** The minute it is: what a wall draws again on, for its dimming. */
const minuteNow = (): number => Math.floor(Date.now() / 60_000);

const randomDrift = (): [number, number] => [Math.round((Math.random() * 2 - 1) * DRIFT_PX), Math.round((Math.random() * 2 - 1) * DRIFT_PX)];

/**
 * `/dashboard-wall/<title>`, drawn by the full-screen surface: a dashboard for a screen on a wall.
 * Its address loaded as a page — typed, bookmarked, reloaded — opens it full screen over its
 * dashboard's page, as Full screen there does, rather than inside the sidebar and the top bar.
 */
export default function WallPage() {
  const { name = '' } = useParams();
  if (useSurface().kind !== 'page') return <Wall name={name} />;
  const search = new URLSearchParams({ fullscreen: wallRoute(name) });
  return <Navigate replace to={`${dashboardRoute(name)}?${search}`} />;
}

/**
 * A dashboard's wall. Its cards fill the screen as glass tiles over the hat field in its colour,
 * which glints now and then; the screen is held awake where the browser lets it, the cursor and
 * the controls go when the pointer rests, the cards drift a few pixels now and then, the wall dims
 * between the times its dashboard says, and it loads itself again each night. A visitor holding a
 * link only looks: the cards lead nowhere and there is no way out of it.
 */
function Wall({ name }: { name: string }) {
  useSignals();
  const path = dashboardFile(name);
  const surface = useSurface();
  const shown = useCommand<Dashboard>(`dashboard-show ${shq(path)}`);
  useNodeEvents({ pathPrefix: path }, () => void shown.refetch());
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const idle = useIdle();
  useWakeLock(true);
  useNightlyReload();
  const drift = useEvery(DRIFT_MS, randomDrift);
  const dashboard = shown.data;
  // Read again each minute, which is as fine as a dimming's times are.
  useEvery(60_000, minuteNow);
  const level = dashboard ? brightness(dashboard.wall) : 1;
  const signedIn = isAuthenticated.value;
  const narrow = width > 0 && width < NARROW_PX;

  const fill = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  };

  return (
    <div
      ref={measure}
      className='mrx-pattern dash-wall'
      data-pattern={dashboard?.color ?? 'mixed'}
      data-effects={dashboard?.wall.effects ?? 'full'}
      data-display={!signedIn || undefined}
      data-idle={idle || undefined}
      style={{ filter: level < 1 ? `brightness(${level})` : undefined, overflowY: narrow ? 'auto' : undefined } as CSSProperties}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        <HatField pattern={(dashboard?.color ?? 'mixed') as HatPattern} kind='backdrop' />
      </div>
      {!dashboard
        ? (shown.error ? <Quiet icon='layout-dashboard'>{shown.error.message}</Quiet> : <PageLoader />)
        : dashboard.cards.length === 0
        ? <Quiet icon='layout-dashboard'>{dashboard.name} has no cards yet.</Quiet>
        : width > 0 && (
          <div
            style={{
              position: narrow ? 'relative' : 'absolute',
              inset: narrow ? undefined : 'clamp(14px, 2vmin, 36px)',
              padding: narrow ? 14 : undefined,
              transform: `translate(${drift[0]}px, ${drift[1]}px)`,
              transition: 'transform 3s ease',
            }}
          >
            <DashboardGrid
              cards={dashboard.cards}
              columns={dashboard.columns}
              narrow={narrow}
              fit={!narrow}
              width={width - 28}
              gap={narrow ? 10 : Math.round(Math.max(10, width / 120))}
            />
          </div>
        )}
      <div className='dash-wall-controls'>
        <Tooltip label='Fill the screen' withArrow>
          <ActionIcon size='lg' radius='xl' color='gray' onClick={fill} aria-label='Fill the screen'>
            <TablerIcon name='maximize' size={18} />
          </ActionIcon>
        </Tooltip>
        {signedIn && (
          <>
            <Tooltip label='Arrange' withArrow>
              <ActionIcon size='lg' radius='xl' color='gray' onClick={() => surface.openPage(`${dashboardRoute(name)}?edit=1`)} aria-label='Arrange'>
                <TablerIcon name='layout-grid' size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label='Leave full screen' withArrow>
              <ActionIcon size='lg' radius='xl' color='gray' onClick={surface.close} aria-label='Leave full screen'>
                <TablerIcon name='x' size={18} />
              </ActionIcon>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
