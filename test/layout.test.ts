/**
 * Laying cards out and reading their parameters, as the page, the wall, the miniature and the
 * commands all do: in order from the top left, a small card filling a gap, a phone's two columns
 * keeping each card's shape, and a card's values checked, filled in and put in its route.
 */
import { assertEquals } from '@std/assert';
import { narrowSize, pack, resized } from '../lib/layout.ts';
import { cardRoute, problemsOf, readOffer, valueFrom, withDefaults } from '../lib/params.ts';
import type { CardParams } from '../lib/api.ts';

Deno.test('cards are laid out in order, each at the first place it fits, and a small one fills a gap', () => {
  const { placements, rows } = pack([[8, 4], [6, 3], [4, 2], [4, 2]], 12);
  assertEquals(placements, [{ x: 0, y: 0, w: 8, h: 4 }, { x: 0, y: 4, w: 6, h: 3 }, { x: 8, y: 0, w: 4, h: 2 }, { x: 8, y: 2, w: 4, h: 2 }]);
  assertEquals(rows, 7);
  // Wider than the dashboard, a card takes its width.
  assertEquals(pack([[20, 2]], 8).placements, [{ x: 0, y: 0, w: 8, h: 2 }]);
});

Deno.test('on a phone a narrow card takes half the width and a wide one all of it, each keeping its shape', () => {
  assertEquals(narrowSize([3, 2], 12), [1, 1]);
  assertEquals(narrowSize([8, 6], 12), [2, 2]);
  assertEquals(narrowSize([12, 3], 12), [2, 1]);
});

Deno.test("a card's corner dragged gives it the cells it passes, to the nearest, never under its smallest nor wider than the dashboard", () => {
  // Cells 100px across and 60px down with their gaps.
  assertEquals(resized([4, 3], [140, 95], [100, 60], [2, 2], 12), [5, 5]);
  assertEquals(resized([4, 3], [-40, -20], [100, 60], [2, 2], 12), [4, 3]);
  assertEquals(resized([4, 3], [-900, -900], [100, 60], [2, 2], 12), [2, 2]);
  assertEquals(resized([4, 3], [2000, 0], [100, 60], [2, 2], 8), [8, 3]);
});

const params: CardParams = {
  type: 'object',
  required: ['list'],
  properties: {
    list: { type: 'string' },
    days: { type: 'integer', minimum: 1, default: 7 },
    who: { type: 'boolean' },
    show: { type: 'string', oneOf: [{ const: 'open' }, { const: 'soon' }] },
    people: { type: 'array', items: { type: 'string' } },
  },
};

Deno.test("a card's values are read as its parameters take them, and checked", () => {
  assertEquals([valueFrom(params.properties.days, '3'), valueFrom(params.properties.who, 'yes'), valueFrom(params.properties.people, 'a, b')], [3, true, ['a', 'b']]);
  assertEquals(valueFrom(params.properties.days, '2.5'), { problem: "'2.5' is not a whole number" });
  assertEquals(problemsOf(params, { list: 'Shopping', days: 0, show: 'later', colour: 'red' }), [
    'days is at least 1',
    'show is one of open, soon',
    'colour is not one of its settings',
  ]);
  assertEquals(problemsOf(params, {}), ['list is needed']);
});

Deno.test("a card's route carries its values, its defaults filled in and a list's items each a value", () => {
  const values = withDefaults(params, { list: '/groups/home/todos/Shopping', people: ['a', 'b'] });
  assertEquals(cardRoute('/cards/todo/list', values), '/cards/todo/list?list=%2Fgroups%2Fhome%2Ftodos%2FShopping&days=7&people=a&people=b');
});

Deno.test('an offer takes defaults for what it leaves out, and one that cannot be drawn says why', () => {
  const offer = readOffer('demo', { name: 'clock', label: 'Clock', route: '/cards/demo/clock', size: [2, 2] });
  assertEquals(typeof offer === 'object' && [offer.id, offer.icon, offer.color, offer.frame, offer.min], ['demo.clock', 'puzzle', 'gray', 'titled', [1, 1]]);
  assertEquals(readOffer('demo', { name: 'clock', label: 'Clock', route: '/cards/demo/clock?x=1', size: [2, 2] }), 'demo.clock: route is a path, without a query');
  assertEquals(
    readOffer('demo', { name: 'clock', label: 'Clock', route: '/c', size: [2, 2], params: { type: 'object', properties: { a: { type: 'date' } } } }),
    'demo.clock: a: type is not one of string, number, integer, boolean, array',
  );
});
