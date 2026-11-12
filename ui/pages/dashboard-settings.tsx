import { CommandForm, type FormField, type FormValues, PageLoader } from '@ein/ui/components';
import { useCommand } from '@ein/ui/hooks';
import { shq } from '@ein/ui/lib';
import { useSearchParams } from 'react-router-dom';
import type { Dashboard, DashboardColor } from '../../lib/api.ts';
import { COLUMN_CHOICES } from '../../lib/layout.ts';
import { COLOR_NAMES, dashboardRoute } from '../look.ts';

/** The shell's dialog takes its frame from here; as a page, this is its heading. */
export const handle = { title: 'Dashboard settings', icon: 'settings', pattern: 'mixed', dialogSize: 'md', signedIn: true };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const fields: FormField[] = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'text' },
  {
    key: 'color',
    label: 'Colour',
    type: 'select',
    options: (Object.keys(COLOR_NAMES) as DashboardColor[]).map((value) => ({ value, label: COLOR_NAMES[value] })),
    half: true,
  },
  {
    key: 'columns',
    label: 'Columns',
    type: 'select',
    description: 'How finely its cards are sized.',
    options: COLUMN_CHOICES.map((value) => ({ value: String(value), label: `${value} across` })),
    half: true,
  },
  {
    key: 'effects',
    label: 'On the wall',
    type: 'select',
    options: [{ value: 'full', label: 'Glass tiles over the pattern' }, { value: 'light', label: 'Plain tiles, for a slow screen' }],
  },
  { key: 'dimFrom', label: 'Dim from', type: 'text', placeholder: '22:30', description: 'Its wall dims between two times; leave both empty to never dim.', half: true },
  { key: 'dimTo', label: 'until', type: 'text', placeholder: '06:30', half: true },
  { key: 'dimLevel', label: 'Brightness while dimmed', type: 'number', placeholder: '0.35', description: 'From 0.1 to 1.' },
];

/** The command line that sets the dashboard at `path` to `values`. */
const commandFor = (path: string, values: FormValues): string => {
  const from = values.dimFrom?.trim() ?? '';
  const to = values.dimTo?.trim() ?? '';
  if ((from || to) && !(TIME.test(from) && TIME.test(to))) throw new Error('Dimming takes two times as HH:MM, such as 22:30 and 06:30');
  const level = values.dimLevel?.trim() ? Number(values.dimLevel) : undefined;
  if (level !== undefined && !(level >= 0.1 && level <= 1)) throw new Error('The brightness while dimmed is from 0.1 to 1');
  return [
    `dashboard-set ${shq(path)}`,
    `--title ${shq(values.title.trim())}`,
    `--description ${shq(values.description?.trim() ?? '')}`,
    `--color ${shq(values.color)}`,
    `--columns ${shq(values.columns)}`,
    `--effects ${shq(values.effects)}`,
    from ? `--dim ${shq(`${from}-${to}${level !== undefined ? `@${level}` : ''}`)}` : '--no-dim',
  ].join(' ');
};

/** `/dashboards/settings?path=`, in the dialog from a dashboard's ⋮: its title, line, colour, columns and how its wall looks. */
export default function DashboardSettingsPage() {
  const [params] = useSearchParams();
  const path = params.get('path') ?? '';
  const shown = useCommand<Dashboard>(`dashboard-show ${shq(path)}`);
  const dashboard = shown.data;
  if (!dashboard) return <PageLoader />;
  const initial: FormValues = {
    title: dashboard.name,
    description: dashboard.description ?? '',
    color: dashboard.color,
    columns: String(dashboard.columns),
    effects: dashboard.wall.effects ?? 'full',
    dimFrom: dashboard.wall.dim?.from ?? '',
    dimTo: dashboard.wall.dim?.to ?? '',
    dimLevel: dashboard.wall.dim ? String(dashboard.wall.dim.level) : '',
  };
  return (
    <CommandForm
      fields={fields}
      initial={initial}
      build={(values) => ({ command: commandFor(path, values), navigateTo: (answer) => dashboardRoute((answer as Dashboard).name) })}
      submitLabel='Save'
    />
  );
}
