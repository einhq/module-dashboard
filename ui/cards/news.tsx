import { Group, Skeleton, Stack, Text } from '@mantine/core';
import type { NewsEntry } from '@ein/api';
import { RollingList, RoutePanel, TablerIcon } from '@ein/ui/components';
import { usePolledCommand } from '@ein/ui/hooks';
import { useSearchParams } from 'react-router-dom';
import { Quiet } from '../components/CardTile.tsx';
import { agoText } from './when.ts';
import '../dashboard.css';

/**
 * `/cards/dashboard/news`: what was added lately (core's `news`) — albums made, and whatever else
 * the modules tell of — newest first, each drawn by its module's own route, with how long ago;
 * what does not fit rolls by.
 */
export default function NewsCard() {
  const [params] = useSearchParams();
  const limit = Number(params.get('limit') ?? 6) || 6;
  const news = usePolledCommand<NewsEntry[]>(`news --limit ${limit}`, true, 5 * 60_000);

  if (!news.data) return news.error ? <Quiet icon='news'>{news.error.message}</Quiet> : <Skeleton height='60%' radius='md' />;
  if (news.data.length === 0) return <Quiet icon='news'>Nothing new lately</Quiet>;
  return (
    <RollingList gap='0.7em'>
      {news.data.map((entry) => (
        <Group key={`${entry.source}\n${entry.route}`} gap='sm' wrap='nowrap' align='flex-start'>
          <TablerIcon name={entry.icon ?? 'sparkles'} size={18} style={{ color: 'var(--dash-accent)', flex: 'none', marginTop: 4 }} />
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <RoutePanel path={entry.route} loading={<Skeleton height={30} radius='md' />} failed={<Text size='sm' lineClamp={2}>{entry.title}</Text>} />
            <Text size='xs' c='dimmed'>{agoText(entry.at)}{entry.by ? ` · ${entry.by.name ?? entry.by.username}` : ''}</Text>
          </Stack>
        </Group>
      ))}
    </RollingList>
  );
}
