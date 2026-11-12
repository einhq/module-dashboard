/**
 * Where dashboards live and how they are read and written.
 *
 * A dashboard is one YAML file in `/archive/dashboards`, named by its title: `Kitchen.yaml` is the
 * dashboard Kitchen. The file holds its layout — how many columns, how its wall looks, its cards
 * in order — and the node's attrs what describes it: `color` and `description`. A file edited by
 * hand is read for what is well-formed in it, and what is not is reported rather than refused.
 *
 * Who may see and change a dashboard is its own access: it starts out shared as the person making
 * it shares new things, as an album does, and the sharing dialog changes it. Every read and write
 * here is made with the caller's access, and nothing here checks it.
 */

import { basename } from '@std/path';
import { parse, stringify } from '@std/yaml';
import { applySharePreference, type Command, type Node, type NodeAttrs, NodeNotFoundError, readSettings, resolveDefaultOwnership, shq, verifyAccess } from '@ein/client';
import type { CardSize, CardValue, DashboardColor, DashboardSummary, PlacedCard, WallSettings } from './api.ts';
import { COLUMN_CHOICES, DEFAULT_COLUMNS, fitSize, pack } from './layout.ts';

/** The folder every dashboard is in: the module's archive root. */
export const DASHBOARDS_ROOT = '/archive/dashboards';

const EXTENSION = '.yaml';
const MIMETYPE = 'application/yaml';

/** Titles the pages under `/dashboards` take for themselves. */
const RESERVED = new Set(['new', 'add', 'card', 'settings']);

/** The colours a dashboard may take, `mixed` first: the hat field's accents. */
export const COLORS: DashboardColor[] = ['mixed', 'album', 'person', 'location', 'track', 'camera', 'device', 'label', 'media', 'staging', 'system'];

/** A dashboard's attrs: its file's name and type, and what describes it. */
export type DashboardAttrs = NodeAttrs & { name: string; mimetype: string; color?: DashboardColor; description?: string };

/** A dashboard's file as read: its layout, and what in it could not be read. */
export type DashboardFile = { columns: number; wall: WallSettings; cards: PlacedCard[]; problems: string[] };

/** A `dashboard-*` command's failure, said to the caller as it is. */
export class DashboardError extends Error {}

/** Say why a command failed, and fail: a `DashboardError`'s words as they are, anything else's message. */
export const fail = async (cmd: Command, name: string, error: unknown): Promise<number> => {
  const message = error instanceof NodeNotFoundError ? 'no such dashboard' : error instanceof Error ? error.message : String(error);
  await cmd.writeError(`${name}: ${message}\n`);
  return 1;
};

/** A title as a dashboard is named by it: one line, trimmed, no slash, not a page's own name. */
export const checkTitle = (title: string): string => {
  const trimmed = title.trim();
  if (!trimmed) throw new DashboardError('a dashboard needs a title');
  if (trimmed.includes('/') || /[\n\r\t]/.test(trimmed) || trimmed.startsWith('.')) {
    throw new DashboardError(`'${title}' cannot be a title: one line, no slash, not starting with a dot`);
  }
  if (RESERVED.has(trimmed.toLowerCase())) throw new DashboardError(`'${trimmed}' is the name of a page of dashboards, and cannot be a title`);
  return trimmed;
};

/** The path of the dashboard `ref` names: a path as it is, or a title. */
export const dashboardPath = (ref: string): string => ref.startsWith('/') ? ref : `${DASHBOARDS_ROOT}/${ref}${EXTENSION}`;

/** The title a dashboard's path names: its file's name without `.yaml`. */
export const titleOf = (path: string): string => basename(path, EXTENSION);

/** Whether a listing's entry is a dashboard: a YAML file. */
const isDashboardEntry = (name: string, node: Node): boolean => name.endsWith(EXTENSION) && node.type === 'file';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A card's values as a file holds them: strings, numbers, true or false, and lists of strings. */
const readValues = (raw: unknown): Record<string, CardValue> | undefined => {
  if (!isRecord(raw)) return undefined;
  const values: Record<string, CardValue> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') values[key] = value;
    else if (Array.isArray(value) && value.every((each) => typeof each === 'string' || typeof each === 'number')) values[key] = value.map(String);
  }
  return values;
};

/** One card of a file, or why it is not one. */
const readCard = (raw: unknown, at: number): PlacedCard | string => {
  if (!isRecord(raw)) return `card ${at + 1} is not a mapping`;
  const { id, card, size, title } = raw;
  if (typeof id !== 'string' || !/^[a-z0-9]{1,16}$/.test(id)) return `card ${at + 1} has no id of lower case letters and digits`;
  if (typeof card !== 'string' || !/^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/.test(card)) return `card ${id} does not name a card as <module>.<name>`;
  if (!Array.isArray(size) || size.length !== 2 || !size.every((n) => Number.isInteger(n) && n >= 1)) return `card ${id}'s size is not [columns, rows]`;
  const values = raw.with === undefined ? undefined : readValues(raw.with);
  if (raw.with !== undefined && !values) return `card ${id}'s with is not a mapping`;
  return {
    id,
    card,
    size: size as CardSize,
    ...(typeof title === 'string' || title === false ? { title } : {}),
    ...(values && Object.keys(values).length > 0 ? { with: values } : {}),
  };
};

/** A dashboard's YAML read for what is well-formed in it, saying what is not. */
const parseDashboard = (text: string): DashboardFile => {
  const problems: string[] = [];
  let raw: unknown;
  try {
    raw = parse(text) ?? {};
  } catch (error) {
    return { columns: DEFAULT_COLUMNS, wall: {}, cards: [], problems: [`the file is not YAML: ${(error as Error).message}`] };
  }
  if (!isRecord(raw)) return { columns: DEFAULT_COLUMNS, wall: {}, cards: [], problems: ['the file is not a mapping'] };

  let columns = DEFAULT_COLUMNS;
  if (raw.columns !== undefined) {
    if ((COLUMN_CHOICES as readonly unknown[]).includes(raw.columns)) columns = raw.columns as number;
    else problems.push(`columns is one of ${COLUMN_CHOICES.join(', ')}`);
  }

  const wall: WallSettings = {};
  if (isRecord(raw.wall)) {
    if (raw.wall.effects === 'full' || raw.wall.effects === 'light') wall.effects = raw.wall.effects;
    const dim = raw.wall.dim;
    if (isRecord(dim) && typeof dim.from === 'string' && TIME.test(dim.from) && typeof dim.to === 'string' && TIME.test(dim.to)) {
      const level = typeof dim.level === 'number' && dim.level >= 0.1 && dim.level <= 1 ? dim.level : 0.35;
      wall.dim = { from: dim.from, to: dim.to, level };
    } else if (dim !== undefined) problems.push('wall.dim is from and to as HH:MM, and a level');
  }

  const cards: PlacedCard[] = [];
  const ids = new Set<string>();
  for (const [at, entry] of (Array.isArray(raw.cards) ? raw.cards : []).entries()) {
    const card = readCard(entry, at);
    if (typeof card === 'string') problems.push(card);
    else if (ids.has(card.id)) problems.push(`card ${card.id} is there twice`);
    else {
      ids.add(card.id);
      cards.push({ ...card, size: fitSize(card.size, columns) });
    }
  }
  if (raw.cards !== undefined && !Array.isArray(raw.cards)) problems.push('cards is a list');
  return { columns, wall, cards, problems };
};

/** A dashboard's layout as its file holds it. */
const renderDashboard = ({ columns, wall, cards }: Omit<DashboardFile, 'problems'>): string =>
  stringify({
    columns,
    ...(wall.effects || wall.dim ? { wall } : {}),
    cards: cards.map(({ id, card, size, title, with: values }) => ({
      id,
      card,
      size,
      ...(title !== undefined ? { title } : {}),
      ...(values && Object.keys(values).length > 0 ? { with: values } : {}),
    })),
  }, { flowLevel: 3 });

const readText = async (cmd: Command, path: string): Promise<string> => {
  const handle = await cmd.sys.vfs.open(cmd.access, path, { mode: 'r' });
  try {
    return await new Response(handle.readable).text();
  } finally {
    await handle.close();
  }
};

const writeText = async (cmd: Command, path: string, text: string): Promise<void> => {
  const handle = await cmd.sys.vfs.open(cmd.access, path, { mode: 'w' });
  try {
    await handle.write(new TextEncoder().encode(text));
  } finally {
    await handle.close();
  }
};

/** A dashboard's node and its file as read. */
export const readDashboard = async (cmd: Command, path: string): Promise<{ node: Node<DashboardAttrs>; file: DashboardFile }> => {
  const node = await cmd.sys.vfs.get<DashboardAttrs>(cmd.access, path);
  if (!isDashboardEntry(basename(path), node) || !path.startsWith(`${DASHBOARDS_ROOT}/`)) throw new DashboardError(`${path} is not a dashboard`);
  return { node, file: parseDashboard(await readText(cmd, path)) };
};

/** Write a dashboard's layout back to its file. */
export const writeDashboard = async (cmd: Command, path: string, file: Omit<DashboardFile, 'problems'>): Promise<void> => {
  await writeText(cmd, path, renderDashboard(file));
};

/** A new card's id: four letters and digits no card of the dashboard has. */
export const newCardId = (cards: PlacedCard[]): string => {
  const taken = new Set(cards.map((card) => card.id));
  for (;;) {
    const id = Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) => (byte % 36).toString(36)).join('');
    if (!taken.has(id)) return id;
  }
};

/**
 * Make an empty dashboard titled `title`, shared as the person making it shares new things unless
 * `share` says otherwise (`default`, `private`, `shared`, `everyone`), as `album create` does.
 */
export const createDashboard = async (
  cmd: Command,
  title: string,
  opts: { color?: DashboardColor; description?: string; columns?: number; share?: string },
): Promise<string> => {
  const name = `${checkTitle(title)}${EXTENSION}`;
  const path = `${DASHBOARDS_ROOT}/${name}`;
  if (await cmd.sys.vfs.exists(cmd.access, path)) throw new DashboardError(`there is a dashboard called ${titleOf(path)} already`);
  const text = renderDashboard({ columns: opts.columns ?? DEFAULT_COLUMNS, wall: {}, cards: [] });

  // Ownership comes from the system default, narrowed or widened by `share`, or by this person's
  // own preference, read from the settings files as album create reads them.
  const ownership = await resolveDefaultOwnership(cmd, cmd.access);
  const preference = opts.share === undefined || opts.share === 'default' ? (await readSettings(cmd, cmd.access)).CFG_USER_DEFAULT_SHARE : opts.share;
  const mode = applySharePreference(ownership.mode, preference);
  await cmd.sys.vfs.create<DashboardAttrs>(cmd.access, 'file', DASHBOARDS_ROOT, name, {
    props: { gid: cmd.access.gid, mode, tier: 'db' },
    attrs: {
      name,
      mimetype: MIMETYPE,
      size: 0,
      color: opts.color ?? 'mixed',
      ...(opts.description ? { description: opts.description } : {}),
    },
  });
  await writeText(cmd, path, text);
  // A private dashboard stays its maker's, as made: the default owner would take it from them.
  if (preference !== 'private') {
    const result = await cmd.execute(`share-set ${shq(path)} --default-owner --no-recursive${preference === 'everyone' ? ' -m g:users:rx' : ''}`);
    if (result.code !== 0) throw new DashboardError(result.stderr.trim() || 'the default sharing could not be applied');
  }
  return path;
};

/** Every dashboard the reader can see, by title. */
export const listDashboards = async (cmd: Command): Promise<string[]> => {
  const entries = await cmd.sys.vfs.children(cmd.access, DASHBOARDS_ROOT).catch((error) => {
    if (error instanceof NodeNotFoundError) return [];
    throw error;
  });
  return entries.filter((entry) => isDashboardEntry(entry.name, entry.node)).map((entry) => `${DASHBOARDS_ROOT}/${entry.name}`)
    .sort((a, b) => titleOf(a).localeCompare(titleOf(b)));
};

/** A dashboard as `dashboards` lists it: its node, its file's layout packed for the miniature, each card in `colorOf`'s colour. */
export const summarize = (
  cmd: Command,
  path: string,
  node: Node<DashboardAttrs>,
  file: DashboardFile,
  colorOf: (card: PlacedCard) => string,
  ownerName?: string,
): DashboardSummary => {
  const { placements } = pack(file.cards.map((card) => card.size), file.columns);
  return {
    path,
    name: titleOf(path),
    color: COLORS.includes(node.attrs.color as DashboardColor) ? node.attrs.color as DashboardColor : 'mixed',
    ...(node.attrs.description ? { description: node.attrs.description } : {}),
    columns: file.columns,
    tiles: placements.map((placement, at) => ({ ...placement, color: colorOf(file.cards[at]) })),
    owner: { uid: node.props.uid, ...(ownerName ? { name: ownerName } : {}) },
    ...(node.props.modtime?.timestamp ? { modified: node.props.modtime.timestamp } : {}),
    canEdit: verifyAccess(cmd.access, node.props, 'w'),
  };
};
