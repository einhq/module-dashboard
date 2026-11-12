import { CommandForm, type FormField, type FormValues } from '@ein/ui/components';
import { shq } from '@ein/ui/lib';
import type { DashboardColor, DashboardSummary } from '../../lib/api.ts';
import { COLOR_NAMES, dashboardRoute } from '../look.ts';

/** The shell's dialog takes its frame from here; as a page, this is its heading. */
export const handle = { title: 'New dashboard', icon: 'layout-dashboard', pattern: 'mixed', dialogSize: 'md', signedIn: true };

const SHARES = [
  { value: 'default', label: 'As you share new things' },
  { value: 'private', label: 'Only you' },
  { value: 'everyone', label: 'Everyone with an account' },
];

const fields: FormField[] = [
  { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Kitchen' },
  { key: 'description', label: 'Description', type: 'text', placeholder: 'By the fridge' },
  {
    key: 'color',
    label: 'Colour',
    type: 'select',
    description: 'What its page and its wall are drawn in.',
    options: (Object.keys(COLOR_NAMES) as DashboardColor[]).map((value) => ({ value, label: COLOR_NAMES[value] })),
    half: true,
  },
  { key: 'share', label: 'Who sees it', type: 'select', options: SHARES, half: true },
];

const build = (values: FormValues) => ({
  command: `dashboard-create ${shq(values.title.trim())}${values.description?.trim() ? ` --description ${shq(values.description.trim())}` : ''}` +
    ` --color ${shq(values.color || 'mixed')} --share ${shq(values.share || 'default')}`,
  navigateTo: (answer: unknown) => `${dashboardRoute((answer as DashboardSummary).name)}?edit=1`,
});

/**
 * `/dashboards/new`, in the dialog from the Create menu or the Dashboards page: a dashboard's title,
 * a line about it, its colour and who sees it. It opens the new one ready to arrange.
 */
export default function NewDashboardPage() {
  return <CommandForm fields={fields} initial={{ color: 'mixed', share: 'default' }} build={build} submitLabel='Create dashboard' />;
}
