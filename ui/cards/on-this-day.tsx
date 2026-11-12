import { Skeleton, Text } from '@mantine/core';
import type { OnThisDayEntry } from '@ein/api';
import { RollingList, RoutePanel } from '@ein/ui/components';
import { useLocalDay, usePolledCommand } from '@ein/ui/hooks';
import { useSearchParams } from 'react-router-dom';
import { Quiet } from '../components/CardTile.tsx';
import '../dashboard.css';

/**
 * `/cards/dashboard/on-this-day`: this calendar day in earlier years (core's `onthisday`), each
 * year drawn by its module's own route — the archive's ring round that day's first picture — in
 * a row, newest first, that rolls sideways when it does not fit. Read again as the day turns.
 */
export default function OnThisDayCard() {
  const [params] = useSearchParams();
  const today = useLocalDay();
  const limit = Number(params.get('limit') ?? 8) || 8;
  const entries = usePolledCommand<OnThisDayEntry[]>(`onthisday ${today.slice(5)} --limit ${limit}`, true, 60 * 60_000);

  if (!entries.data) return entries.error ? <Quiet icon='history'>{entries.error.message}</Quiet> : <Skeleton height='60%' radius='md' />;
  if (entries.data.length === 0) return <Quiet icon='history'>Nothing from this day in earlier years</Quiet>;
  return (
    <RollingList axis='x' gap='var(--mantine-spacing-md)'>
      {entries.data.map((entry) => (
        <div key={`${entry.source}\n${entry.route}`} style={{ flex: 'none' }}>
          <RoutePanel path={entry.route} loading={<Skeleton circle height={76} />} failed={<Text size='xs' w={84} lineClamp={3}>{entry.title}</Text>} />
        </div>
      ))}
    </RollingList>
  );
}
