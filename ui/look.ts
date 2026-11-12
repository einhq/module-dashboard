/**
 * How the dashboard pages name and colour things: a dashboard's routes, and the colours of the
 * kinds a dashboard and its cards are drawn in.
 */

import type { DashboardColor } from '../lib/api.ts';

/** The folder every dashboard is in. */
const ROOT = '/archive/dashboards';

/** A dashboard's page, by its title. */
export const dashboardRoute = (name: string): string => `/dashboards/${encodeURIComponent(name)}`;

/** A dashboard's wall, the route the full-screen surface draws. */
export const wallRoute = (name: string): string => `/dashboard-wall/${encodeURIComponent(name)}`;

/** A dashboard's file, by its title. */
export const dashboardFile = (name: string): string => `${ROOT}/${name}.yaml`;

/** The Mantine colour of each of a dashboard's colours, the kinds' own; `mixed` is the app's accent. */
const MANTINE: Record<DashboardColor, string> = {
  mixed: 'marine',
  album: 'blue',
  person: 'grape',
  location: 'teal',
  track: 'cyan',
  camera: 'green',
  device: 'orange',
  label: 'pink',
  media: 'indigo',
  staging: 'yellow',
  system: 'lime',
};

/** What the colour picker calls each. */
export const COLOR_NAMES: Record<DashboardColor, string> = {
  mixed: 'Every colour',
  album: 'Albums blue',
  person: 'People violet',
  location: 'Places green',
  track: 'Tracks cyan',
  camera: 'Cameras green',
  device: 'Devices orange',
  label: 'Labels pink',
  media: 'Pictures indigo',
  staging: 'Staging yellow',
  system: 'System lime',
};

/** A dashboard colour's Mantine colour. */
export const mantineOf = (color: DashboardColor): string => MANTINE[color] ?? 'marine';

/** A Mantine colour as the CSS a tile's accent is, at the shade that carries on a dark surface. */
export const accentOf = (mantine: string): string => `var(--mantine-color-${mantine}-4)`;

/** What a device card says when it cannot read its device: a refusal in words, anything else as it came. */
export const deviceProblem = (error: Error): string => /access denied/i.test(error.message) ? 'Whoever looks at this dashboard may not read this device.' : error.message;
