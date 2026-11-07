import { BadRequestException } from '@nestjs/common';

/**
 * The physician's optional extra instructions on Regenerate are FORMATTING
 * instructions. They may change HOW the orders are written -- wording, order of
 * items, grouping, emphasis, length -- and may ask for a detail the orders
 * themselves already contain. They may never introduce clinical content: no new
 * order, medication, dose, diagnosis, result or finding.
 *
 * The AI prompt states the same rule (ai_service/ollama_client.py), but a small
 * local model happily writes "10 mg Biogesic" when told to "add 10 mg Biogesic".
 * So the request is screened here first and rejected with a message that tells
 * the physician what to do instead.
 *
 * This is a guard rail, not a parser. It rejects an instruction when it
 *  - names a dose the orders do not contain,
 *  - dresses something up as clinical ("add cupcakes as medication"),
 *  - asks for "a new / another / additional" anything, or lands an additive verb
 *    straight on a record item ("add the diagnosis"), or
 *  - introduces a word the day's orders never mention ("add cupcakes").
 * A word that IS in the orders passes, so pointing at an existing detail works
 * for any wording. The last check can over-reach on a synonym the orders spell
 * differently; the 400 says so, and the physician can rephrase.
 */

/** A quantity with a clinical unit: "10 mg", "500mg", "2 tabs", "1 g". */
const DOSE_PATTERN =
  /\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|ug|grams?|grammes?|g|kg|ml|cc|litres?|liters?|l|meq|mmol|iu|units?|u|tabs?|tablets?|caps?|capsules?|drops?|puffs?|ampoules?|ampules?|vials?|tsp|tbsp)\b/gi;

/**
 * Verbs that splice something into the text. Whatever follows one of these is
 * checked word by word against the orders (see `unsupportedWords`).
 */
const CONTENT_VERB_PATTERN = /\b(?:add|append|attach|include|insert|prescribe|put|write|list)\b/gi;

/** Every verb a physician may use to steer the wording. */
const INSTRUCTION_VERB =
  '(?:add|append|attach|include|insert|prescribe|put|write|list|mention|note|state|say|indicate|describe|call|label)';

/**
 * "the medications", "these labs" point AT orders that already exist, so they
 * are scrubbed before the addition checks run (but never before the word check).
 * Only known plural categories are listed, so "the diagnosis" is not mistaken
 * for a plural just because it ends in "s".
 */
const DEFINITE_PLURAL_REFERENCE = new RegExp(
  '\\b(?:the|these|those|all|every)\\s+' +
    '(?:orders|medications|medicines|drugs|prescriptions|labs|tests|results|' +
    'findings|vitals|procedures|referrals|fluids|supplements|doses|settings)\\b',
  'gi',
);

/**
 * "add cupcakes as medication": the added thing is dressed up as clinical
 * content, so it is rejected no matter how un-clinical the noun looks.
 */
const DRESSED_UP_AS_CLINICAL = new RegExp(
  `\\b${INSTRUCTION_VERB}\\b[^.;\\n]{0,60}?\\bas\\s+(?:a\\s+|an\\s+|the\\s+)?` +
    '(?:medications?|medicines?|drugs?|orders?|prescriptions?|treatments?|therap(?:y|ies)|diagnos(?:is|es)|doses?|labs?|results?|findings?|procedures?)\\b',
  'i',
);

/**
 * "add a new medication", "include another order", or an additive verb landing
 * directly on something that only exists in the clinical record.
 */
const NEW_CLINICAL_CONTENT = new RegExp(
  `\\b${INSTRUCTION_VERB}\\b[^.;\\n]{0,40}?\\b(?:new|another|additional|extra|missing)\\b` +
    `|\\b(?:add|append|attach|include|insert|prescribe|put)\\b(?:\\s+(?:a|an|the|one|some|his|her|its))*\\s+` +
    '(?:orders?|medications?|medicines?|drugs?|prescriptions?|diagnos(?:is|es)|labs?|laborator(?:y|ies)|tests?|results?|findings?)\\b',
  'i',
);

/**
 * Words that may follow an additive verb without counting as clinical content:
 * formatting vocabulary, plus the generic category words a physician uses to
 * point AT existing orders ("the medications", "the labs"). Any other word has
 * to appear in the day's orders -- that is what stops "add cupcakes".
 */
const ALLOWED_WORDS = new Set([
  'sentence', 'sentences', 'paragraph', 'paragraphs', 'word', 'words', 'wording',
  'phrase', 'phrases', 'line', 'lines', 'bullet', 'bullets', 'list', 'lists',
  'item', 'items', 'numbered', 'summary', 'summaries', 'text', 'tone', 'style',
  'tense', 'past', 'present', 'passive', 'active', 'voice', 'chronological',
  'order', 'orders', 'ordering', 'sequence', 'first', 'last', 'then', 'next',
  'finally', 'before', 'after', 'group', 'grouping', 'combine', 'combined',
  'merge', 'separate', 'split', 'one', 'two', 'three', 'four', 'five', 'short',
  'shorter', 'longer', 'concise', 'brief', 'detail', 'details', 'detailed',
  'length', 'fewer', 'less', 'more', 'most', 'maximum', 'minimum', 'plain',
  'formal', 'please', 'also', 'additionally', 'emphasis', 'emphasize',
  'highlight', 'important', 'key', 'lead', 'leading', 'keep', 'avoid', 'omit',
  'same', 'each', 'per', 'only', 'day', 'days', 'date', 'today', 'yesterday',
  'medication', 'medications', 'medicine', 'medicines', 'drug', 'drugs', 'dose',
  'doses', 'dosage', 'route', 'frequency', 'interval', 'lab', 'labs',
  'laboratory', 'test', 'tests', 'result', 'results', 'finding', 'findings',
  'vital', 'vitals', 'procedure', 'procedures', 'referral', 'referrals',
  'diagnosis', 'diagnoses', 'imaging', 'blood', 'fluid', 'fluids', 'diet',
  'intake', 'output', 'monitoring', 'treatment', 'treatments', 'therapy',
  'therapies', 'prescription', 'prescriptions', 'antibiotic', 'antibiotics',
  'analgesic', 'antipyretic', 'setting', 'settings',
]);

/**
 * Function words carry no clinical content, so they are never compared against
 * the orders: "add the cupcakes first" must not fail on "the".
 */
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'these', 'those', 'into',
  'onto', 'about', 'its', 'his', 'her', 'their', 'them', 'they', 'was', 'were',
  'are', 'is', 'be', 'been', 'being', 'has', 'have', 'had', 'will', 'would',
  'can', 'could', 'should', 'may', 'might', 'must', 'not', 'but', 'or', 'if',
  'so', 'all', 'any', 'both', 'than', 'then', 'there', 'when', 'where', 'which',
  'while', 'who', 'whom', 'why', 'how', 'too', 'very', 'just', 'other', 'out',
  'over', 'under', 'via', 'etc', 'use', 'using', 'used', 'get', 'got', 'make',
  'made', 'again', 'still', 'either', 'otherwise', 'instead',
]);

/** Shown when the instruction asks for clinical content that is not in the orders. */
export const FORMATTING_ONLY_INSTRUCTIONS_MESSAGE =
  'Additional instructions may only change how the summary is written, not add ' +
  'clinical content. Ask for a formatting change (wording, order, grouping, ' +
  'length) or edit the summary text directly; a missing order, medication or ' +
  'result must be recorded as a new order.';

/** `"500 mg"` and `"500mg"` compare equal, so spacing/case never decides the outcome. */
function normalizeDose(value: string): string {
  return value.toLowerCase().replace(/[\s,]/g, '');
}

function dosesIn(text: string): string[] {
  return Array.from(text.matchAll(DOSE_PATTERN), (match) => normalizeDose(match[0]));
}

/**
 * Words an additive instruction introduces that the day's orders never mention.
 * Each clause after "add / include / insert / ..." is compared word by word, so
 * "add cupcakes as medication" fails on "cupcakes" even though every clinical
 * word in it is spelled correctly.
 */
function unsupportedWords(text: string, orderText: string): string[] {
  const haystack = orderText.toLowerCase();
  const missing = new Set<string>();
  for (const verb of text.matchAll(CONTENT_VERB_PATTERN)) {
    const clause = text.slice((verb.index ?? 0) + verb[0].length).split(/[.;\n]/)[0];
    for (const word of clause.toLowerCase().match(/[a-z]{3,}/g) ?? []) {
      if (STOP_WORDS.has(word) || ALLOWED_WORDS.has(word)) continue;
      if (haystack.includes(word)) continue;
      missing.add(word);
    }
  }
  return Array.from(missing);
}

/**
 * Throws a 400 when `instructions` asks the AI to add clinical content instead
 * of formatting the orders. `sourceOrders` is the text the summary is built
 * from, so a requested dose or detail the orders already contain is allowed.
 */
export function assertFormattingOnlyInstructions(
  instructions?: string | null,
  sourceOrders: readonly (string | null | undefined)[] = [],
): void {
  const text = (instructions ?? '').trim();
  if (!text) return;

  const orderText = sourceOrders.filter(Boolean).join('\n');

  const knownDoses = new Set(dosesIn(orderText));
  const unsupported = Array.from(
    new Set(dosesIn(text).filter((dose) => !knownDoses.has(dose))),
  );
  if (unsupported.length) {
    throw new BadRequestException(
      `${FORMATTING_ONLY_INSTRUCTIONS_MESSAGE} "${unsupported[0]}" is not in this day's orders.`,
    );
  }

  // Definite plurals ("the medications") are references, not additions.
  const additions = text.replace(DEFINITE_PLURAL_REFERENCE, ' ');

  if (DRESSED_UP_AS_CLINICAL.test(additions)) {
    throw new BadRequestException(FORMATTING_ONLY_INSTRUCTIONS_MESSAGE);
  }

  if (NEW_CLINICAL_CONTENT.test(additions)) {
    throw new BadRequestException(FORMATTING_ONLY_INSTRUCTIONS_MESSAGE);
  }

  const notInOrders = unsupportedWords(text, orderText);
  if (notInOrders.length) {
    throw new BadRequestException(
      `${FORMATTING_ONLY_INSTRUCTIONS_MESSAGE} "${notInOrders[0]}" is not in this day's orders, ` +
        'so it cannot be added to the summary.',
    );
  }
}
