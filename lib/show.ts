/**
 * A dashboard as the commands answer about it: its file's cards matched to the cards the modules
 * offer, each with the route it is drawn with, or why it cannot be drawn.
 */

import type { Command, Node, UserAttrs } from '@ein/client';
import { USERS_PATH } from '@ein/paths';
import type { CardOffer, Dashboard, PlacedCard, ShownCard } from './api.ts';
import { cardRoute, problemsOf, withDefaults } from './params.ts';
import { type DashboardAttrs, type DashboardFile, summarize } from './store.ts';

/** The cards on offer by id. */
export const offersById = (offers: CardOffer[]): Map<string, CardOffer> => new Map(offers.map((offer) => [offer.id, offer]));

/** A placed card with what its offer says, and its route; a card no module offers, or one missing a value, gets why instead. */
export const shownCard = (card: PlacedCard, offers: Map<string, CardOffer>): ShownCard => {
  const offer = offers.get(card.card);
  if (!offer) {
    const module = card.card.split('.')[0];
    return { ...card, label: card.card, icon: 'puzzle-off', color: 'gray', frame: 'titled', problem: `no module offers ${card.card}: is ${module} installed?` };
  }
  const values = card.with ?? {};
  const problems = problemsOf(offer.params, values);
  return {
    ...card,
    label: offer.label,
    icon: offer.icon,
    color: offer.color,
    frame: offer.frame,
    ...(problems.length > 0 ? { problem: problems.join('; ') } : { route: cardRoute(offer.route, withDefaults(offer.params, values)) }),
  };
};

/** Account names by uid, as a page writes them: the title, else the user name. */
export const accountNames = async (cmd: Command): Promise<Map<number, string>> => {
  const users = await cmd.sys.vfs.children<UserAttrs>(cmd.access, USERS_PATH).catch(() => []);
  return new Map(
    users.filter((entry) => entry.node.type === 'user' && typeof entry.node.attrs.uid === 'number')
      .map((entry) => [entry.node.attrs.uid, typeof entry.node.attrs.title === 'string' && entry.node.attrs.title ? entry.node.attrs.title : entry.name]),
  );
};

/** One dashboard as `dashboard-show` answers it. */
export const showDashboard = (
  cmd: Command,
  path: string,
  node: Node<DashboardAttrs>,
  file: DashboardFile,
  offers: Map<string, CardOffer>,
  names: Map<number, string>,
): Dashboard => ({
  ...summarize(cmd, path, node, file, (card) => offers.get(card.card)?.color ?? 'gray', names.get(node.props.uid)),
  wall: file.wall,
  cards: file.cards.map((card) => shownCard(card, offers)),
  problems: file.problems,
});
