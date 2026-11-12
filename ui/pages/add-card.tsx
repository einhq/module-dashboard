import { Badge, Box, Button, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import { ListFilterInput, PageLoader, TablerIcon } from '@ein/ui/components';
import { useCommand, useSurface } from '@ein/ui/hooks';
import { shq } from '@ein/ui/lib';
import { execCommand, moduleRoutePaths } from '@ein/ui/signals';
import { type CSSProperties, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CardOffer } from '../../lib/api.ts';
import { CardEditor } from '../components/CardEditor.tsx';
import { valueArgs } from '../components/ParamsForm.tsx';
import { accentOf } from '../look.ts';
import '../dashboard.css';

/** The shell's dialog takes its frame from here; as a page, this is its heading. */
export const handle = { title: 'Add a card', icon: 'layout-dashboard', pattern: 'mixed', dialogSize: 'xl', signedIn: true };

/** One card on offer, as a tile in its accent: its icon, name, what it shows and whose it is. */
function OfferTile({ offer, onPick }: { offer: CardOffer; onPick: () => void }) {
  return (
    <UnstyledButton
      className='dash-tile'
      onClick={onPick}
      style={{ '--dash-accent': accentOf(offer.color), padding: 14, minHeight: 116, animation: 'none', textAlign: 'left' } as CSSProperties}
    >
      <Stack gap={8}>
        <span className='dash-tile-icon'>
          <TablerIcon name={offer.icon} size={16} />
        </span>
        <Text fw={600} size='sm'>{offer.label}</Text>
        <Text size='xs' c='dimmed' lineClamp={3}>{offer.description}</Text>
      </Stack>
      <Badge size='xs' variant='outline' color='gray' style={{ position: 'absolute', top: 12, right: 12 }}>{offer.module}</Badge>
    </UnstyledButton>
  );
}

/**
 * `/dashboards/add?path=`, in the dialog from a dashboard's Add card: every card the installed
 * modules offer the reader — those of a module kept to groups the reader is not in are left out —
 * to pick from, then its settings beside a preview, and it goes on at the dashboard's end.
 */
export default function AddCardPage() {
  const [params] = useSearchParams();
  const path = params.get('path') ?? '';
  const surface = useSurface();
  const catalog = useCommand<CardOffer[]>('dashboard-cards');
  const [filter, setFilter] = useState('');
  const [picked, setPicked] = useState<CardOffer | null>(null);

  if (picked) {
    return (
      <CardEditor
        offer={picked}
        initial={{ values: {}, title: '', size: picked.size }}
        submitLabel='Add card'
        extra={<Button variant='subtle' color='gray' leftSection={<TablerIcon name='arrow-left' size={16} />} onClick={() => setPicked(null)}>Other cards</Button>}
        onSubmit={async (draft) => {
          const title = draft.title.trim() ? ` --title ${shq(draft.title.trim())}` : '';
          await execCommand(`dashboard-card-add ${shq(path)} ${shq(picked.id)} --size ${draft.size.join('x')}${title} ${valueArgs(draft.values)}`);
          surface.close();
        }}
      />
    );
  }

  if (!catalog.data) return catalog.error ? <Text c='red'>{catalog.error.message}</Text> : <PageLoader />;
  const words = filter.trim().toLowerCase();
  const offers = catalog.data
    .filter((offer) => moduleRoutePaths.value.has(offer.route))
    .filter((offer) => !words || `${offer.label} ${offer.description} ${offer.module}`.toLowerCase().includes(words));

  return (
    <Stack gap='md'>
      <ListFilterInput value={filter} onChange={setFilter} what='cards' />
      <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }} spacing='sm'>
        {offers.map((offer) => <OfferTile key={offer.id} offer={offer} onPick={() => setPicked(offer)} />)}
      </SimpleGrid>
      {offers.length === 0 && (
        <Box ta='center' py='xl'>
          <Text c='dimmed'>{words ? 'No cards match' : 'No module offers a card yet'}</Text>
        </Box>
      )}
    </Stack>
  );
}
