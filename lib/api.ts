/**
 * What the dashboard commands answer under `JSON_OUTPUT=1`. Import-free, for the commands, the
 * pages and other modules alike.
 */

/**
 * A dashboard's colour: the hat field's accent its page and wall are drawn in, `mixed` for every
 * colour across it, or one of the kinds' (`album` blue, `person` grape, `device` orange, …).
 */
export type DashboardColor =
  | 'mixed'
  | 'album'
  | 'person'
  | 'location'
  | 'track'
  | 'camera'
  | 'device'
  | 'label'
  | 'media'
  | 'staging'
  | 'system';

/** A card's size in cells: columns across, rows down. */
export type CardSize = [number, number];

/** A value a card is set to: what its route's query carries. */
export type CardValue = string | number | boolean | string[];

/** A card as a dashboard's file holds it. */
export type PlacedCard = {
  /** Unique on its dashboard, never reused: what `dashboard-card-set` and the page name it by. */
  id: string;
  /** The card it is, `<module>.<name>`, as `dashboard-cards` lists them. */
  card: string;
  size: CardSize;
  /** Its header's title in place of the card's label; `false` for no header at all. */
  title?: string | false;
  /** What it shows: its route's query, as the card's `params` take it. */
  with?: Record<string, CardValue>;
};

/** One card's place on a dashboard of its columns, in cells from the top left. */
export type Placement = { x: number; y: number; w: number; h: number };

/** How a dashboard's wall looks: `light` leaves out the blur behind the tiles, for a slow screen. */
export type WallSettings = {
  effects?: 'full' | 'light';
  /** Dimmed between two times of day, `HH:MM`, to `level` (0.1–1) of full brightness. */
  dim?: { from: string; to: string; level: number };
};

/** A dashboard as `dashboards` lists it. */
export type DashboardSummary = {
  path: string;
  /** Its title: the file's name without `.yaml`. */
  name: string;
  color: DashboardColor;
  description?: string;
  /** Cells across at full width. */
  columns: number;
  /** Its cards' places and colours, packed as the page lays them out: the list's miniature. */
  tiles: (Placement & { color: string })[];
  owner: { uid: number; name?: string };
  /** Epoch ms its file last changed. */
  modified?: number;
  /** Whether the reader may change it. */
  canEdit: boolean;
};

/** A card on a dashboard as the page draws it: placed, with what its offer says and the route to draw. */
export type ShownCard = PlacedCard & {
  label: string;
  icon: string;
  /** A Mantine colour: its tile's accent. */
  color: string;
  /** `titled` draws a header above the route; `plain` gives the route the whole tile. */
  frame: 'titled' | 'plain';
  /** The route with its query, every value the card takes filled in; absent when it cannot be drawn. */
  route?: string;
  /** Why it cannot be drawn as it is: its module is gone, or a value it needs is missing. */
  problem?: string;
};

/** One dashboard, as `dashboard-show` answers. */
export type Dashboard = DashboardSummary & {
  wall: WallSettings;
  cards: ShownCard[];
  /** What in its file could not be read, for whoever edits it by hand. */
  problems: string[];
};

/**
 * A card a module offers, as `dashboard-cards` lists them: the module's
 * `etc/dashboard.d/cards.json` entry with its id.
 */
export type CardOffer = {
  /** `<module>.<name>`. */
  id: string;
  module: string;
  name: string;
  label: string;
  description: string;
  /** A Tabler icon name. */
  icon: string;
  color: string;
  route: string;
  frame: 'titled' | 'plain';
  /** The size a new one takes, and the smallest it may be. */
  size: CardSize;
  min: CardSize;
  /** A JSON Schema of the route's query (`type: object`, `properties`, `required`). */
  params: CardParams;
};

/** The part of JSON Schema a card's parameters are written in. */
export type CardParams = {
  type: 'object';
  properties: Record<string, CardParam>;
  required?: string[];
};

/** One parameter of a card. */
export type CardParam = {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array';
  title?: string;
  description?: string;
  default?: CardValue;
  /** The values it may take, with what the form calls each. */
  enum?: (string | number)[];
  oneOf?: { const: string | number; title?: string }[];
  minimum?: number;
  maximum?: number;
  /** `path` a node; `markdown`, `timezone`, `date` or `time` the input the form draws. */
  format?: 'path' | 'markdown' | 'timezone' | 'date' | 'time';
  /** For an `array`, its items' type. */
  items?: { type: 'string' | 'number' };
  /**
   * The choices a read command lists: `items` the key path to the list in its answer when the
   * answer is not one, `value` and `label` each choice's fields, `{param}` in `command` another
   * parameter's value. The form runs it as the person editing.
   */
  'x-choices'?: { command: string; items?: string; value: string; label: string };
};
