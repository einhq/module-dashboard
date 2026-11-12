import { ActionIcon, Box, Button, Menu, Text, Tooltip } from '@mantine/core';
import { useSignals } from '@preact/signals-react/runtime';
import { EmptyState, EntityDetailHeader, type HatPattern, PageLoader, TablerIcon } from '@ein/ui/components';
import { useCommand, useElementWidth, useNodeEvents, usePhone, useUrlParam } from '@ein/ui/hooks';
import { shq } from '@ein/ui/lib';
import { execCommand, fullscreenPath, heldLinks, isAuthenticated, notify, onOutsideEdit, openDialog, openFullscreen } from '@ein/ui/signals';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import type { CardSize, Dashboard, ShownCard } from '../../lib/api.ts';
import { DashboardGrid } from '../components/DashboardGrid.tsx';
import { dashboardFile, wallRoute } from '../look.ts';
import '../dashboard.css';

/** The page draws its own band edge to edge. */
export const handle = { fullBleed: true };

/** The sizes the size menu offers, those a card's smallest and the dashboard's width allow. */
const SIZES: { label: string; size: CardSize }[] = [
  { label: 'Small', size: [3, 2] },
  { label: 'Medium', size: [4, 3] },
  { label: 'Wide', size: [6, 3] },
  { label: 'Tall', size: [3, 5] },
  { label: 'Large', size: [6, 5] },
  { label: 'Hero', size: [8, 6] },
  { label: 'Banner', size: [12, 3] },
];

/**
 * `/dashboards/<title>`: a dashboard as a page — its band in its colour over the hat field, then its
 * cards — with Edit to arrange them (drag a grip, pick a size, open a card's settings, take it off,
 * add another), Full screen for its wall, Share, and the rest under ⋮. It follows its file, so an
 * edit made elsewhere shows here at once. A visitor holding a link to it is shown the wall.
 */
export default function DashboardPage() {
  useSignals();
  const { name = '' } = useParams();
  const path = dashboardFile(name);
  const shown = useCommand<Dashboard>(`dashboard-show ${shq(path)}`);
  useNodeEvents({ pathPrefix: path }, () => void shown.refetch());
  useEffect(() => onOutsideEdit(() => void shown.refetch()), [shown.refetch]);
  const [edit, setEdit] = useUrlParam('edit');
  const phone = usePhone();
  const [measure, width] = useElementWidth<HTMLDivElement>();

  // Someone who opened a link to it has nothing to do here but look: the wall it is made for.
  const visitor = !isAuthenticated.value && heldLinks.value.length > 0;
  const wallOpen = fullscreenPath.value?.startsWith('/dashboard-wall/') ?? false;
  useEffect(() => {
    if (visitor && !wallOpen) openFullscreen(wallRoute(name));
  }, [visitor, wallOpen, name]);

  const dashboard = shown.data;
  if (!dashboard) {
    if (shown.error) return <EmptyState title='This dashboard cannot be opened'>{shown.error.message}</EmptyState>;
    return <PageLoader />;
  }
  const editing = edit === '1' && dashboard.canEdit;

  const run = async (line: string) => {
    try {
      await execCommand(line);
    } catch (error) {
      notify({ message: error instanceof Error ? error.message : String(error), color: 'red' });
    } finally {
      await shown.refetch();
    }
  };
  const remove = async (card: ShownCard, at: number) => {
    await run(`dashboard-card-remove ${shq(path)} ${shq(card.id)}`);
    const values = Object.entries(card.with ?? {}).map(([key, value]) => ` --with ${shq(`${key}=${Array.isArray(value) ? value.join(',') : value}`)}`).join('');
    const title = card.title === false ? ' --no-title' : card.title ? ` --title ${shq(card.title)}` : '';
    notify({
      message: `${card.title || card.label} was taken off`,
      action: { label: 'Undo', onClick: () => void run(`dashboard-card-add ${shq(path)} ${shq(card.card)} --size ${card.size.join('x')} --at ${at}${title}${values}`) },
    });
  };
  const addCard = () => openDialog(`/dashboards/add?path=${encodeURIComponent(path)}`);
  const wall = () => openFullscreen(wallRoute(name));

  const tools = (card: ShownCard, at: number) => (
    <>
      <Tooltip label='Drag to move' withArrow>
        <ActionIcon className='dash-grip' size='sm' radius='xl' color='gray' aria-label={`Move ${card.label}`}>
          <TablerIcon name='grip-vertical' size={15} />
        </ActionIcon>
      </Tooltip>
      {phone && (
        <>
          <ActionIcon
            size='sm'
            radius='xl'
            color='gray'
            disabled={at === 0}
            onClick={() => void run(`dashboard-card-set ${shq(path)} ${shq(card.id)} --to ${at - 1}`)}
            aria-label='Earlier'
          >
            <TablerIcon name='arrow-up' size={15} />
          </ActionIcon>
          <ActionIcon
            size='sm'
            radius='xl'
            color='gray'
            disabled={at === dashboard.cards.length - 1}
            onClick={() => void run(`dashboard-card-set ${shq(path)} ${shq(card.id)} --to ${at + 1}`)}
            aria-label='Later'
          >
            <TablerIcon name='arrow-down' size={15} />
          </ActionIcon>
        </>
      )}
      <Menu position='bottom-end' withinPortal>
        <Menu.Target>
          <ActionIcon size='sm' radius='xl' color='gray' aria-label='Size'>
            <TablerIcon name='dimensions' size={15} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Size</Menu.Label>
          {SIZES.filter(({ size }) => size[0] <= dashboard.columns).map(({ label, size }) => (
            <Menu.Item
              key={label}
              rightSection={<Text size='xs' c='dimmed'>{size.join(' × ')}</Text>}
              leftSection={size[0] === card.size[0] && size[1] === card.size[1] ? <TablerIcon name='check' size={14} /> : <Box w={14} />}
              onClick={() => void run(`dashboard-card-set ${shq(path)} ${shq(card.id)} --size ${size.join('x')}`)}
            >
              {label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
      <ActionIcon
        size='sm'
        radius='xl'
        color='gray'
        aria-label={`${card.label} settings`}
        onClick={() => openDialog(`/dashboards/card?path=${encodeURIComponent(path)}&id=${card.id}`)}
      >
        <TablerIcon name='adjustments' size={15} />
      </ActionIcon>
      <ActionIcon size='sm' radius='xl' color='red' aria-label={`Take ${card.label} off`} onClick={() => void remove(card, at)}>
        <TablerIcon name='x' size={15} />
      </ActionIcon>
    </>
  );

  const editItems = dashboard.canEdit
    ? [
      { label: editing ? 'Done' : 'Arrange', icon: editing ? 'check' : 'layout-grid', button: true, onClick: () => setEdit(editing ? '' : '1') },
      { label: 'Add card', icon: 'plus', onClick: addCard },
      { label: 'Settings', icon: 'settings', onClick: () => openDialog(`/dashboards/settings?path=${encodeURIComponent(path)}`) },
      { label: 'Make a copy', icon: 'copy', onClick: () => void run(`dashboard-copy ${shq(path)} ${shq(`${name} (copy)`)}`) },
    ]
    : [];

  return (
    <Box>
      <EntityDetailHeader
        eyebrow='Dashboard'
        title={dashboard.name}
        subtitle={dashboard.description}
        pattern={dashboard.color as HatPattern}
        flowContent
        actions={{
          ...(dashboard.canEdit ? { share: path, trash: { path, name: dashboard.name, leaveTo: '/dashboards' } } : {}),
          items: [{ label: 'Full screen', icon: 'arrows-maximize', button: true, onClick: wall }, ...editItems],
        }}
      />
      <Box ref={measure} px='md' py='lg'>
        {dashboard.problems.length > 0 && editing && <Text size='sm' c='yellow' mb='md'>Its file says what could not be read: {dashboard.problems.join('; ')}.</Text>}
        {dashboard.cards.length === 0 && !editing
          ? (
            <EmptyState
              title='Nothing on it yet'
              actions={dashboard.canEdit && <Button variant='light' leftSection={<TablerIcon name='plus' size={16} />} onClick={addCard}>Add card</Button>}
            >
              Add the time, what is coming up, a picture of the day or a device's readings, and arrange them; Full screen shows them on a wall.
            </EmptyState>
          )
          // While its wall is open over the page, the page's own cards would only read twice.
          : !wallOpen && width > 0 && (
            <DashboardGrid
              cards={dashboard.cards}
              columns={dashboard.columns}
              narrow={phone}
              width={width - 32}
              gap={phone ? 10 : 14}
              editing={editing}
              tools={tools}
              onMove={(id, to) => void run(`dashboard-card-set ${shq(path)} ${shq(id)} --to ${to}`)}
              onAdd={addCard}
            />
          )}
      </Box>
    </Box>
  );
}
