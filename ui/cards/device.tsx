import { Badge, Group, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';
import type { DeviceInfo } from '@ein/api';
import { EndpointTile } from '@ein/ui/components';
import { useElementWidth, usePolledCommand } from '@ein/ui/hooks';
import { shq } from '@ein/ui/lib';
import { useSearchParams } from 'react-router-dom';
import { Quiet } from '../components/CardTile.tsx';
import { deviceProblem } from '../look.ts';
import '../dashboard.css';

/** How wide an endpoint's tile is at least: past this the card fits another beside it. */
const TILE_PX = 190;

/**
 * `/cards/dashboard/device`: one device (`device`) with its readings and switches — those
 * `endpoints` names, else every one in use that is not a setting — each drawn as on the device's
 * own page; a switch works for whoever may use it and stays still for a screen that only shows.
 * Read every ten seconds, as the device's page is.
 */
export default function DeviceCard() {
  const [params] = useSearchParams();
  const device = params.get('device') ?? '';
  const chosen = params.getAll('endpoints');
  const info = usePolledCommand<DeviceInfo>(`device-show ${shq(device)}`, device !== '');
  const [measure, width] = useElementWidth<HTMLDivElement>();

  if (!info.data) return info.error ? <Quiet icon='plug-x'>{deviceProblem(info.error)}</Quiet> : <Skeleton height='70%' radius='md' />;
  const endpoints = info.data.endpointList.filter((endpoint) =>
    chosen.length > 0 ? chosen.includes(endpoint.name) : !endpoint.retired && endpoint.supported && endpoint.category === undefined
  );

  return (
    <Stack ref={measure} gap='xs' h='100%' style={{ overflow: 'auto' }}>
      <Group gap='xs' wrap='nowrap'>
        <Text fw={600} truncate style={{ flex: 1, minWidth: 0 }}>{info.data.label}</Text>
        {info.data.online !== undefined && <Badge size='xs' variant='dot' color={info.data.online ? 'teal' : 'gray'}>{info.data.online ? 'online' : 'offline'}</Badge>}
      </Group>
      {endpoints.length === 0 ? <Text size='sm' c='dimmed'>It has nothing to show yet.</Text> : (
        <SimpleGrid cols={Math.max(1, Math.floor(width / TILE_PX))} spacing='xs'>
          {endpoints.map((endpoint) => (
            <EndpointTile
              key={endpoint.name}
              device={info.data!.name}
              deviceClass={info.data!.class}
              endpoint={endpoint}
              onChanged={() => void info.refetch()}
            />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
