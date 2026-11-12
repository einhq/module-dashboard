import { Badge, Box, Button, Text } from '@mantine/core';
import { CardGrid, EmptyState, EntityCard, EntityDetailHeader, ListFilterInput, PageLoader } from '@ein/ui/components';
import { useCommand, useNodeEvents, useUrlParam } from '@ein/ui/hooks';
import { isAuthenticated, onOutsideEdit, openDialog } from '@ein/ui/signals';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DashboardSummary } from '../../lib/api.ts';
import { Miniature } from '../components/Miniature.tsx';
import { dashboardRoute } from '../look.ts';
import '../dashboard.css';

/** The page draws its own band edge to edge. */
export const handle = { fullBleed: true };

const cardsText = (count: number): string => count === 0 ? 'No cards yet' : count === 1 ? '1 card' : `${count} cards`;

/**
 * `/dashboards`: every dashboard the reader can see as a tile, its cover a miniature of its layout
 * in its cards' colours, narrowed to titles holding the filter's words. Read again when one is
 * made, changed or removed.
 */
export default function DashboardsPage() {
  const navigate = useNavigate();
  const [text, setText] = useUrlParam('q');
  const listing = useCommand<DashboardSummary[]>('dashboards');
  useEffect(() => onOutsideEdit(() => void listing.refetch()), [listing.refetch]);
  useNodeEvents({ pathPrefix: '/archive/dashboards', recursive: false }, () => void listing.refetch());

  const words = text.trim().toLowerCase();
  const shown = (listing.data ?? []).filter((each) => !words || each.name.toLowerCase().includes(words) || each.description?.toLowerCase().includes(words));
  const create = isAuthenticated.value ? () => openDialog('/dashboards/new') : undefined;

  return (
    <Box>
      <EntityDetailHeader
        title='Dashboards'
        pattern='mixed'
        flowContent
        actions={create ? { items: [{ label: 'New dashboard', icon: 'plus', button: true, onClick: create }] } : undefined}
        controls={<ListFilterInput value={text} onChange={setText} what='dashboards' />}
      />
      <Box px='md' py='lg'>
        {listing.error && <Text c='red' mb='md'>{listing.error.message}</Text>}
        {listing.loading && !listing.data ? <PageLoader /> : (
          <>
            <CardGrid items={shown} itemKey={(each) => each.path} textParts={(each) => ({ description: Boolean(each.description), badges: true })}>
              {(each) => (
                <EntityCard
                  title={each.name}
                  description={each.description}
                  coverArt={<Miniature dashboard={each} />}
                  onClick={() => navigate(dashboardRoute(each.name))}
                  hoverText={each.path}
                  badges={
                    <>
                      <Badge size='xs' variant='light' color='gray'>{cardsText(each.tiles.length)}</Badge>
                      {each.owner.name && <Badge size='xs' variant='outline' color='gray'>by {each.owner.name}</Badge>}
                    </>
                  }
                />
              )}
            </CardGrid>
            {shown.length === 0 && !words && !listing.error && (
              <EmptyState title='No dashboards yet' actions={create && <Button variant='light' onClick={create}>New dashboard</Button>}>
                A dashboard gathers cards on one page — the time, what is coming up, a picture of the day, a device's readings, a todo list — and shows them full screen on a
                wall.
              </EmptyState>
            )}
            {shown.length === 0 && words && (
              <Box ta='center' py='xl'>
                <Text c='dimmed'>No dashboards match</Text>
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
