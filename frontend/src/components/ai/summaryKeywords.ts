/**
 * Which parts of a summary came from its source orders — drug names with
 * their dose ("Biogesic 5g/day"), procedures, labs ("CBC", "nebulization").
 *
 * An order contributes key terms (drug / procedure / lab words). A key term
 * found in the summary is highlighted together with the dose, unit, route and
 * frequency right next to it, so "Biogesic 500 mg PO every 6 hours" is one
 * highlight, not four.
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

/** Filler, generic order verbs and vague nouns that are never worth highlighting on their own. */
const STOPWORDS = new Set(
  (
    'the and for with from then that this into onto when every each until after before ' +
    'also over under once twice please kindly about around above below than more less ' +
    'while through upon within without except least following further here there ' +
    'patient patients order orders start started starting continue continued resume resumed ' +
    'give given administer administered refer referred follow other same will shall should ' +
    'must needed need done have been were was are being doctor physician nurse room ward ' +
    'monitor monitored monitoring check checked obtain obtained request requested secure ' +
    'maintain maintained apply applied observe observed watch keep kept stop stopped ' +
    'discontinue discontinued hold held increase increased decrease decreased shift shifted ' +
    'change changed prepare prepared notify notified inform informed transfer transferred ' +
    'schedule scheduled perform performed carry carried take taken note noted make made ' +
    'morning noon afternoon evening night today tomorrow tonight now time times dose doses ' +
    'status result results level levels value values routine possible thereafter ' +
    'dr md rn am pm ok'
  ).split(' '),
);

/** Dose units, routes and frequencies: attached to a key term, never highlighted alone. */
const UNITS = new Set(
  (
    'mg g gm mcg ug kg ml cc l lpm meq iu unit units tab tabs tablet tablets cap caps ' +
    'capsule capsules amp amps ampule vial vials drop drops gtt gtts puff puffs sachet ' +
    'po iv ivtt ivp im sc sq sl pr ngt od bid tid qid qd prn hs ac pc stat ' +
    'h hr hrs hour hours min mins minute minutes day days daily week weeks hourly'
  ).split(' '),
);

/** Words that join a key term to a number after them ("every 6 hours", "for 7 days", "x 3"). */
const CONNECTORS = new Set(['every', 'per', 'for', 'x', 'q', 'at']);

interface Term {
  lower: string;
  /** All-caps abbreviations (IV, CBC) match whole words only, so "PO" never matches "possible". */
  abbreviation: boolean;
}

interface Token {
  lower: string;
  start: number;
  end: number;
}

const isUnit = (lower: string) =>
  lower.split('/').every((part) => UNITS.has(part) || /^q\d+h?$/.test(part));

/** A number ("500mg", "5g/day", "0.9%") or a unit / route / frequency. */
const isDetail = (lower: string) => /^\d/.test(lower) || isUnit(lower);

/** Meaningful words of an order: 4+ letters, or an all-caps abbreviation (CBC, NPO, D5LR). */
function orderTerms(orderContent: string): Term[] {
  const terms = new Map<string, Term>();
  for (const word of orderContent.match(/[A-Za-z][A-Za-z0-9-]*/g) ?? []) {
    const lower = word.toLowerCase();
    if (STOPWORDS.has(lower) || isUnit(lower)) continue;
    const abbreviation = word.length >= 2 && word === word.toUpperCase();
    if (lower.length >= 4 || abbreviation) terms.set(lower, { lower, abbreviation });
  }
  return [...terms.values()];
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(/[A-Za-z0-9][A-Za-z0-9.%/-]*/g)) {
    const raw = match[0].replace(/[./-]+$/, '');
    const start = match.index ?? 0;
    tokens.push({ lower: raw.toLowerCase(), start, end: start + raw.length });
  }
  return tokens;
}

/** "nebulize" → "nebulized", "x-ray" → "x-rays"; an abbreviation only as itself (or plural). */
function matches(token: Token, term: Term): boolean {
  if (term.abbreviation) return token.lower === term.lower || token.lower === `${term.lower}s`;
  return token.lower.startsWith(term.lower) && /^[a-z]{0,4}$/.test(token.lower.slice(term.lower.length));
}

/** Character ranges of the summary to highlight: each key term plus its attached dose details. */
function findSpans(summary: string, terms: Term[]): Array<[number, number]> {
  if (terms.length === 0) return [];
  const tokens = tokenize(summary);
  // Two tokens are one phrase only when nothing but spaces separates them.
  const joined = (i: number) => /^[ \t]*$/.test(summary.slice(tokens[i].end, tokens[i + 1].start));
  const marked = tokens.map((token) => terms.some((term) => matches(token, term)));

  [...marked].forEach((isKey, i) => {
    if (!isKey) return;
    // Forward: "Biogesic 500mg PO every 6 hours".
    let j = i + 1;
    while (j < tokens.length && joined(j - 1)) {
      if (isDetail(tokens[j].lower)) {
        marked[j++] = true;
      } else if (
        CONNECTORS.has(tokens[j].lower) &&
        j + 1 < tokens.length &&
        joined(j) &&
        /^\d/.test(tokens[j + 1].lower)
      ) {
        marked[j] = marked[j + 1] = true;
        j += 2;
      } else break;
    }
    // Backward: "500 mg Biogesic".
    for (j = i - 1; j >= 0 && joined(j) && isDetail(tokens[j].lower); j--) marked[j] = true;
  });

  const spans: Array<[number, number]> = [];
  tokens.forEach((token, i) => {
    if (!marked[i]) return;
    const last = spans[spans.length - 1];
    if (last && marked[i - 1] && joined(i - 1)) last[1] = token.end;
    else spans.push([token.start, token.end]);
  });
  return spans;
}

/** The phrases of the summary that came from this order, as written in the summary. */
export function termsInSummary(orderContent: string, summary: string): string[] {
  const phrases = new Map<string, string>();
  for (const [start, end] of findSpans(summary, orderTerms(orderContent))) {
    const phrase = summary.slice(start, end);
    if (!phrases.has(phrase.toLowerCase())) phrases.set(phrase.toLowerCase(), phrase);
  }
  return [...phrases.values()];
}

/**
 * The summary split into plain and matched pieces, for highlighting. Odd
 * indexes are matches.
 */
export function splitOnTerms(summary: string, orders: SummarySourceOrder[]): string[] {
  const terms = orders.flatMap((order) => orderTerms(order.orderContent));
  const pieces: string[] = [];
  let cursor = 0;
  for (const [start, end] of findSpans(summary, terms)) {
    pieces.push(summary.slice(cursor, start), summary.slice(start, end));
    cursor = end;
  }
  pieces.push(summary.slice(cursor));
  return pieces;
}
