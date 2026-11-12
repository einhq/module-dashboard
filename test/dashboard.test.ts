/**
 * Dashboards through their commands: a dashboard is a YAML file in /archive/dashboards that starts
 * out shared as its maker shares new things, its cards are the ones the modules' drop-ins offer,
 * checked against what each takes, a hand-edited file is read for what is well-formed, and someone
 * else sees one only as it is shared with them.
 */
import { assert, assertEquals, assertStringIncludes } from '@std/assert';
import { createTestContext, type ShellClient } from '@ein/testing';
import type { CardBrief, CardOffer, Dashboard, DashboardSummary, ShownCard } from '@dashboard/api';

const testCtx = createTestContext({ modules: ['dashboard'], boot: true });

Deno.test({ name: 'dashboards', sanitizeResources: false, sanitizeOps: false }, async (t) => {
  await testCtx.setup();
  const admin = await testCtx.server.createShellClient();
  const clients: ShellClient[] = [admin];

  try {
    for (const name of ['anna', 'bo']) {
      await admin.execString(`user-create ${name} --title '${name[0].toUpperCase()}${name.slice(1)} Andersson' && user-passwd ${name} --new-password hunter2`);
    }
    const signIn = async (username: string): Promise<ShellClient> => {
      const client = await testCtx.server.createShellClient({ username, password: 'hunter2' });
      clients.push(client);
      return client;
    };
    const anna = await signIn('anna');
    const bo = await signIn('bo');

    await t.step("the modules' cards are offered, the dashboard's own among them, and a broken list is said and skipped", async () => {
      await admin.execString('mkdir -p /etc/dashboard.d/demo');
      await admin.execString(
        `echo '[{"name":"weather","label":"Weather","route":"/cards/demo/weather","size":[3,2],"params":{"type":"object","properties":{"place":{"type":"string"}},"required":["place"]}},{"name":"Bad name","label":"x","route":"/x","size":[1,1]}]' > /etc/dashboard.d/demo/cards.json`,
      );
      const offers = await anna.execJson<CardOffer[]>('dashboard-cards');
      const ids = offers.map((offer) => offer.id);
      for (const id of ['dashboard.clock', 'dashboard.coming-up', 'dashboard.device', 'dashboard.note', 'demo.weather']) assert(ids.includes(id), id);
      assertEquals(ids.some((id) => id.startsWith('demo.') && id !== 'demo.weather'), false);
      const weather = offers.find((offer) => offer.id === 'demo.weather')!;
      assertEquals([weather.description, weather.frame, weather.min], ['Weather', 'titled', [1, 1]]);
      assertStringIncludes(await anna.execString('dashboard-cards 2>&1'), 'name is lower case');

      // Named, only those; brief, each without what the form draws, short enough for the assistant to read whole.
      assertEquals((await anna.execJson<CardOffer[]>('dashboard-cards demo.weather dashboard.clock')).map((offer) => offer.id), ['dashboard.clock', 'demo.weather']);
      assertStringIncludes((await anna.exec('dashboard-cards demo.nothing')).error ?? '', 'no module offers demo.nothing');
      const briefs = await anna.execJson<CardBrief[]>('dashboard-cards --brief');
      assertEquals(briefs.length, offers.length);
      assertEquals(briefs.find((brief) => brief.id === 'demo.weather'), {
        id: 'demo.weather',
        label: 'Weather',
        description: 'Weather',
        settings: ['place'],
        required: ['place'],
      });
      assertEquals(briefs.find((brief) => brief.id === 'dashboard.clock')?.settings, ['zone', 'seconds', 'label']);
    });

    let kitchen: DashboardSummary;
    await t.step('a new dashboard is a YAML file of its title, shared as its maker shares new things', async () => {
      kitchen = await anna.execJson<DashboardSummary>("dashboard-create Kitchen --color device --description 'By the fridge'");
      assertEquals([kitchen.path, kitchen.name, kitchen.color, kitchen.description, kitchen.columns, kitchen.tiles], [
        '/archive/dashboards/Kitchen.yaml',
        'Kitchen',
        'device',
        'By the fridge',
        12,
        [],
      ]);
      assertEquals(kitchen.canEdit, true);
      assertStringIncludes(await anna.execString('cat /archive/dashboards/Kitchen.yaml'), 'columns: 12');
      // Another titled the same, or one a page of dashboards is named, is refused.
      assertStringIncludes((await anna.exec('dashboard-create Kitchen')).error ?? '', 'already');
      assertStringIncludes((await anna.exec('dashboard-create new')).error ?? '', 'page of dashboards');
    });

    let clock: ShownCard;
    let weather: ShownCard;
    await t.step('cards go on as their offers say, and what they show is checked against what they take', async () => {
      clock = await anna.execJson<ShownCard>('dashboard-card-add Kitchen dashboard.clock --with seconds=yes');
      assertEquals([clock.size, clock.with, clock.frame, clock.route], [[4, 3], { seconds: true }, 'plain', '/cards/dashboard/clock?seconds=true']);
      weather = await anna.execJson<ShownCard>("dashboard-card-add Kitchen demo.weather --with 'place=Bergby' --size 6x2 --title Outside --at 0");
      assertEquals([weather.title, weather.size, weather.route], ['Outside', [6, 2], '/cards/demo/weather?place=Bergby']);

      assertStringIncludes((await anna.exec('dashboard-card-add Kitchen demo.weather')).error ?? '', 'place is needed');
      assertStringIncludes((await anna.exec('dashboard-card-add Kitchen dashboard.clock --with seconds=maybe')).error ?? '', 'not true or false');
      assertStringIncludes((await anna.exec('dashboard-card-add Kitchen dashboard.clock --with colour=red')).error ?? '', 'has no setting colour');
      assertStringIncludes((await anna.exec('dashboard-card-add Kitchen dashboard.clock --size 1x1')).error ?? '', 'at least 2x2');
      assertStringIncludes((await anna.exec('dashboard-card-add Kitchen demo.nothing')).error ?? '', 'no module offers');

      const shown = await anna.execJson<Dashboard>('dashboard-show Kitchen');
      assertEquals(shown.cards.map((card) => card.id), [weather.id, clock.id]);
      // Laid out from the top left: the 6-wide weather, then the clock beside it.
      assertEquals(shown.tiles.map(({ x, y, w, h }) => [x, y, w, h]), [[0, 0, 6, 2], [6, 0, 4, 3]]);
    });

    await t.step('a card is resized, renamed, set and moved, and taken off', async () => {
      const set = await anna.execJson<ShownCard>(`dashboard-card-set Kitchen ${clock.id} --size 3x2 --no-title --without seconds --to 0`);
      assertEquals([set.size, set.title, set.with], [[3, 2], false, undefined]);
      assertEquals((await anna.execJson<Dashboard>('dashboard-show Kitchen')).cards.map((card) => card.id), [clock.id, weather.id]);
      await anna.execString(`dashboard-card-remove Kitchen ${weather.id}`);
      assertEquals((await anna.execJson<Dashboard>('dashboard-show Kitchen')).cards.map((card) => card.id), [clock.id]);
    });

    await t.step('the dashboard is retitled, recoloured and given a wall, and copied', async () => {
      const set = await anna.execJson<Dashboard>("dashboard-set Kitchen --title 'Kitchen wall' --color mixed --dim 22:30-06:30@0.3 --effects light");
      assertEquals([set.path, set.color, set.wall], ['/archive/dashboards/Kitchen wall.yaml', 'mixed', { effects: 'light', dim: { from: '22:30', to: '06:30', level: 0.3 } }]);
      const copy = await anna.execJson<DashboardSummary>("dashboard-copy 'Kitchen wall' Hall");
      assertEquals([copy.name, copy.tiles.length], ['Hall', 1]);
    });

    await t.step("a file edited by hand is read for what is well-formed, and a gone module's card says so", async () => {
      await anna.execString(
        `printf 'columns: 7\\ncards:\\n  - id: a1\\n    card: gone.thing\\n    size: [2, 2]\\n  - id: a2\\n    card: dashboard.note\\n    size: [3, 2]\\n  - nonsense\\n' > /archive/dashboards/Hall.yaml`,
      );
      const hall = await anna.execJson<Dashboard>('dashboard-show Hall');
      assertEquals(hall.columns, 12);
      assertEquals(hall.cards.map((card) => [card.id, card.problem !== undefined]), [['a1', true], ['a2', true]]);
      assertStringIncludes(hall.cards[0].problem!, 'gone');
      assertStringIncludes(hall.cards[1].problem!, 'text is needed');
      assertEquals(hall.problems.length, 2);
    });

    await t.step('someone else sees a dashboard only as it is shared with them', async () => {
      await anna.execString('dashboard-create Secret --share private');
      const seen = (await bo.execJson<DashboardSummary[]>('dashboards')).map((each) => each.name);
      assertEquals(seen.includes('Secret'), false);
      assertEquals((await bo.exec('dashboard-show Secret')).success, false);
      assertEquals((await bo.exec(`dashboard-card-add Secret dashboard.clock`)).success, false);
      assertEquals((await anna.execJson<DashboardSummary[]>('dashboards')).map((each) => each.name), ['Hall', 'Kitchen wall', 'Secret']);
    });
  } finally {
    for (const client of clients) client.close();
  }
});
