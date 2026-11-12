import { Stack } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../dashboard.css';

/**
 * `/cards/dashboard/clock`: the time, large, with the day and the date under it, in another place's
 * time zone when `zone` says, with `seconds` when asked, and a `label` under them.
 */
export default function ClockCard() {
  const [params] = useSearchParams();
  const zone = params.get('zone') || undefined;
  const seconds = params.get('seconds') === 'true';
  const label = params.get('label');
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), seconds ? 1000 : 5000);
    return () => clearInterval(timer);
  }, [seconds]);

  let time: string;
  let date: string;
  try {
    time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}), timeZone: zone }).format(now);
    date = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: zone }).format(now);
  } catch {
    // A zone the browser does not know: the screen's own.
    time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(now);
    date = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  }

  return (
    <Stack h='100%' justify='center' gap='0.4em' px='1.1em' py='0.8em'>
      <div className='dash-figure'>{time}</div>
      <div className='dash-line' style={{ textTransform: 'capitalize' }}>{date}</div>
      {label && <div className='dash-line' style={{ color: 'color-mix(in srgb, var(--dash-accent) 70%, white)' }}>{label}</div>}
    </Stack>
  );
}
