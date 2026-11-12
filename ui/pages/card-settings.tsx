import { Button, Text } from '@mantine/core';
import { PageLoader, TablerIcon } from '@ein/ui/components';
import { useCommand, useSurface } from '@ein/ui/hooks';
import { shq } from '@ein/ui/lib';
import { execCommand } from '@ein/ui/signals';
import { useSearchParams } from 'react-router-dom';
import type { CardOffer, Dashboard } from '../../lib/api.ts';
import { CardEditor } from '../components/CardEditor.tsx';
import { valueArgs } from '../components/ParamsForm.tsx';
import '../dashboard.css';

/** The shell's dialog takes its frame from here; as a page, this is its heading. */
export const handle = { title: 'Card settings', icon: 'adjustments', pattern: 'mixed', dialogSize: 'xl', signedIn: true };

/** `/dashboards/card?path=&id=`, in the dialog from a card's settings: what it shows, its title and size, beside a preview; or take it off. */
export default function CardSettingsPage() {
  const [params] = useSearchParams();
  const path = params.get('path') ?? '';
  const id = params.get('id') ?? '';
  const surface = useSurface();
  const shown = useCommand<Dashboard>(`dashboard-show ${shq(path)}`);
  const catalog = useCommand<CardOffer[]>('dashboard-cards');
  if (!shown.data || !catalog.data) return shown.error || catalog.error ? <Text c='red'>{(shown.error ?? catalog.error)!.message}</Text> : <PageLoader />;
  const card = shown.data.cards.find((each) => each.id === id);
  const offer = card && catalog.data.find((each) => each.id === card.card);
  if (!card) return <Text c='dimmed'>That card is no longer on the dashboard.</Text>;
  if (!offer) return <Text c='dimmed'>{card.problem}</Text>;

  return (
    <CardEditor
      offer={offer}
      initial={{ values: card.with ?? {}, title: typeof card.title === 'string' ? card.title : '', size: card.size }}
      submitLabel='Save'
      extra={
        <Button
          variant='subtle'
          color='red'
          leftSection={<TablerIcon name='trash' size={16} />}
          onClick={async () => {
            await execCommand(`dashboard-card-remove ${shq(path)} ${shq(id)}`);
            surface.close();
          }}
        >
          Take off
        </Button>
      }
      onSubmit={async (draft) => {
        const title = draft.title.trim() ? `--title ${shq(draft.title.trim())}` : card.title === false ? '' : '--card-title';
        await execCommand(`dashboard-card-set ${shq(path)} ${shq(id)} --size ${draft.size.join('x')} ${title} ${valueArgs(draft.values, card.with ?? {})}`);
        surface.close();
      }}
    />
  );
}
