/**
 * The cards the installed modules offer: each module's `etc/dashboard.d/cards.json`, which
 * `mod setup` links as `/etc/dashboard.d/<module>/cards.json`, a list of cards in the shape
 * `readOffer` reads. The dashboard names no module itself, its own cards among them.
 */

import type { Command } from '@ein/client';
import type { CardOffer } from './api.ts';
import { readOffer } from './params.ts';

/** Where the modules' cards are. */
const DROP_INS = '/etc/dashboard.d';

/** Every card the installed modules offer, module by module in name order, and what in their lists could not be read. */
export const readCatalog = async (cmd: Command): Promise<{ offers: CardOffer[]; problems: string[] }> => {
  const offers: CardOffer[] = [];
  const problems: string[] = [];
  const modules = (await cmd.sys.vfs.children(cmd.access, DROP_INS).catch(() => [])).map((child) => child.name).sort();
  for (const module of modules) {
    let listed: unknown;
    try {
      const handle = await cmd.sys.vfs.open(cmd.access, `${DROP_INS}/${module}/cards.json`, { mode: 'r' });
      try {
        listed = JSON.parse(await new Response(handle.readable).text());
      } finally {
        await handle.close();
      }
    } catch (error) {
      // A module whose drop-in has no cards list offers none; one that is not JSON is the module's to fix.
      if (error instanceof SyntaxError) problems.push(`${module}: cards.json is not JSON: ${error.message}`);
      continue;
    }
    if (!Array.isArray(listed)) {
      problems.push(`${module}: cards.json is not a list`);
      continue;
    }
    for (const entry of listed) {
      const offer = readOffer(module, entry);
      if (typeof offer === 'string') problems.push(`${module}: ${offer}`);
      else if (offers.some((other) => other.id === offer.id)) problems.push(`${offer.id} is offered twice`);
      else offers.push(offer);
    }
  }
  return { offers, problems };
};
