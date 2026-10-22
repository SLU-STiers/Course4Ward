/**
 * Which words of a summary's source orders made it into the summary text —
 * drug names, procedures, labs ("penicillin", "CBC", "nebulization").
 *
 * ponytail: plain word matching with a stopword list, no medical dictionary or
 * synonyms ("PCN" will not match "penicillin"). Swap in a term list if that
 * matters.
 */

import type { OrderType } from '../../types';

export interface SummarySourceOrder {
  id: string;
  orderContent: string;
  dateCreated?: string;
  type?: OrderType;
  executedAt?: string | null;
  orderedBy?: { firstName: string; lastName: string } | null;
  executedBy?: { firstName: string; lastName: string } | null;
}

/** Filler and generic order verbs that are never worth highlighting. */
const STOPWORDS = new Set(
  (
    'the and for with from then that this into onto when every each until after before ' +
    'also over under once twice daily hourly hours hour days minutes please ' +
    'patient patients order orders start started continue continued give given ' +
    'administer administered refer referred follow other same will shall should must ' +
    'needed done have been were was are doctor physician nurse room ward'
  ).split(' '),
);

/** Meaningful words of an order: 4+ letters, or an all-caps abbreviation (IV, CBC, NPO). */
export function orderTerms(orderContent: string): string[] {
  const terms = new Set<string>();
  for (const word of orderContent.match(/[A-Za-z][A-Za-z0-9-]*/g) ?? []) {
    const lower = word.toLowerCase();
    const isAbbreviation = word.length >= 2 && word === word.toUpperCase();
    if ((lower.length >= 4 || isAbbreviation) && !STOPWORDS.has(lower)) terms.add(lower);
  }
  return [...terms];
}

const escape = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A term counts as used when a summary word starts with it ("monitor" → "monitored"). */
function termPattern(terms: string[], flags: string) {
  const alternatives = [...terms].sort((a, b) => b.length - a.length).map(escape).join('|');
  return new RegExp(`\\b((?:${alternatives})[A-Za-z0-9-]*)`, flags);
}

/** The order's terms that appear in the summary. */
export function termsInSummary(orderContent: string, summary: string): string[] {
  return orderTerms(orderContent).filter((term) => termPattern([term], 'i').test(summary));
}

/**
 * The summary split into plain and matched pieces, for highlighting. Odd
 * indexes are matches.
 */
export function splitOnTerms(summary: string, orders: SummarySourceOrder[]): string[] {
  const terms = [...new Set(orders.flatMap((order) => termsInSummary(order.orderContent, summary)))];
  return terms.length ? summary.split(termPattern(terms, 'gi')) : [summary];
}
