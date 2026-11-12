import { Skeleton, Stack, Text } from '@mantine/core';
import type { DeviceHistory, DeviceInfo } from '@ein/api';
import { usePolledCommand } from '@ein/ui/hooks';
import { agoText, readingText, shq } from '@ein/ui/lib';
import { useId } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Quiet } from '../components/CardTile.tsx';
import { deviceProblem } from '../look.ts';
import '../dashboard.css';

/** The interval a reading's history is summed up in, for so many hours of it: a hundred-odd points either way. */
const bucketFor = (hours: number): string => hours <= 6 ? '5m' : hours <= 24 ? '15m' : hours <= 72 ? '1h' : '2h';

/** A reading's history as a line in its tile's accent, over a glow of it, from its lowest to its highest. */
function Trace({ values }: { values: number[] }) {
  const id = `dash-trace-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (values.length < 2) return null;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const points = values.map((value, at) => [(at / (values.length - 1)) * 100, 36 - ((value - low) / span) * 32]);
  const line = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  return (
    <svg viewBox='0 0 100 40' preserveAspectRatio='none' width='100%' height='34%' aria-hidden style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0' stopColor='var(--dash-accent)' stopOpacity='0.35' />
          <stop offset='1' stopColor='var(--dash-accent)' stopOpacity='0' />
        </linearGradient>
      </defs>
      <polygon points={`0,40 ${line} 100,40`} fill={`url(#${id})`} />
      <polyline points={line} fill='none' stroke='var(--dash-accent)' strokeWidth='1.6' vectorEffect='non-scaling-stroke' strokeLinejoin='round' strokeLinecap='round' />
    </svg>
  );
}

/**
 * `/cards/dashboard/reading`: one reading of a device (`device`, `endpoint`), large, with its unit,
 * how long ago it came, and how it went over the last `hours`. The value is read every ten seconds,
 * its history every ten minutes.
 */
export default function ReadingCard() {
  const [params] = useSearchParams();
  const device = params.get('device') ?? '';
  const name = params.get('endpoint') ?? '';
  const hours = Number(params.get('hours') ?? 24) || 24;
  const info = usePolledCommand<DeviceInfo>(`device-show ${shq(device)}`, device !== '');
  const history = usePolledCommand<DeviceHistory>(
    `device-history ${shq(`${device}/${name}`)} --since ${hours}h --bucket ${bucketFor(hours)}`,
    device !== '' && name !== '',
    10 * 60_000,
  );

  if (!info.data) return info.error ? <Quiet icon='gauge'>{deviceProblem(info.error)}</Quiet> : <Skeleton height='70%' radius='md' />;
  const endpoint = info.data.endpointList.find((each) => each.name === name);
  if (!endpoint) return <Quiet icon='gauge'>{info.data.label} has no reading {name}</Quiet>;
  const values = (history.data?.readings ?? []).map((reading) => reading.value).filter((value): value is number => typeof value === 'number');

  return (
    <Stack h='100%' gap={0} justify='space-between' style={{ padding: '0.9em 1.1em 0.6em' }}>
      <Text className='dash-line' truncate>{params.get('label') || `${endpoint.label} · ${info.data.label}`}</Text>
      <div>
        <div className='dash-figure'>{endpoint.last ? readingText(endpoint.last.value, endpoint.unit) : '–'}</div>
        <Text size='xs' c='dimmed' mt={4}>{endpoint.last ? agoText(endpoint.last.at) : 'no reading yet'}</Text>
      </div>
      <Trace values={values} />
    </Stack>
  );
}
