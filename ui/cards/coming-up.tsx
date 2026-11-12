import { Group, Skeleton, Stack, Text } from '@mantine/core';
import type { EventEntry } from '@ein/api';
import { RoutePanel } from '@ein/ui/components';
import { useLocalDay, usePolledCommand } from '@ein/ui/hooks';
import { useSearchParams } from 'react-router-dom';
import { Quiet } from '../components/CardTile.tsx';
import { daysBetween, whenText } from './when.ts';
import '../dashboard.css';

/** How often what is coming up is read again: a day's events change little within it. */
const EVERY_MS = 30 * 60_000;

/**
 * `/cards/dashboard/coming-up`: what falls on the days ahead from every module that tells of events
 * (core's `events`) — birthdays, anniversaries, todos falling due — or only those `only` names, each
 * drawn by its module's own route with when it falls beside it, today's in the accent. Read on the
 * viewer's own day, again as the day turns.
 */
export default function ComingUpCard() {
  const [params] = useSearchParams();
  const today = useLocalDay();
  const days = Number(params.get('days') ?? 30) || 30;
  const limit = Number(params.get('limit') ?? 12) || 12;
  const only = params.getAll('only');
  // Narrowed to some kinds, the cut is made after narrowing, so ask for more.
  const events = usePolledCommand<EventEntry[]>(`events --today ${today} --days-ahead ${days} --days-past 0 --limit ${only.length > 0 ? 200 : limit}`, true, EVERY_MS);

  if (!events.data) return events.error ? <Quiet icon='calendar-off'>{events.error.message}</Quiet> : <Skeleton height='60%' radius='md' />;
  const shown = events.data.filter((entry) => only.length === 0 || only.includes(entry.source)).slice(0, limit);
  if (shown.length === 0) return <Quiet icon='calendar-event'>Nothing in the next {days} days</Quiet>;

  return (
    <Stack gap='0.55em' h='100%' style={{ overflow: 'auto' }}>
      {shown.map((entry) => {
        const away = daysBetween(today, entry.date);
        return (
          <Group key={`${entry.source}\n${entry.route}`} gap='xs' wrap='nowrap' justify='space-between' align='center'>
            <div style={{ flex: 1, minWidth: 0 }}>
              <RoutePanel path={entry.route} loading={<Skeleton height={30} radius='xl' />} failed={<Text size='sm' lineClamp={2}>{entry.title}</Text>} />
            </div>
            <Text
              size='clamp(0.75rem, 3.4cqmin, 1.1rem)'
              fw={away === 0 ? 650 : 500}
              c={away === 0 ? 'color-mix(in srgb, var(--dash-accent) 75%, white)' : 'dimmed'}
              style={{ flex: 'none', fontWeight: entry.milestone ? 700 : undefined }}
            >
              {whenText(away)}
            </Text>
          </Group>
        );
      })}
    </Stack>
  );
}
