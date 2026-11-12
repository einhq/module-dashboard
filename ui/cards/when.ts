/** When something falls, in a card's words: Today, Tomorrow, then in so many days or weeks. */

const MS_PER_DAY = 86_400_000;

/** Days from `from` to `to`, both `YYYY-MM-DD`. */
export const daysBetween = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);

/** How far off a day is, as a person says it: weeks past a fortnight, so never "in 1 weeks". */
export const whenText = (days: number): string => {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  const ahead = days > 0;
  const count = Math.abs(days);
  if (count < 14) return ahead ? `in ${count} days` : `${count} days ago`;
  const weeks = Math.round(count / 7);
  return ahead ? `in ${weeks} weeks` : `${weeks} weeks ago`;
};

/** How long ago `at` (epoch ms) was, briefly. */
export const agoText = (at: number, now = Date.now()): string => {
  const minutes = Math.round((now - at) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
};
