/**
 * Detect medicines / drugs in free-text physician orders for PhilHealth CF4
 * Part V (Drugs/Medicines). Only medication lines are kept — care statements,
 * labs, imaging, diet, and monitoring orders are dropped.
 */

export type Cf4Medicine = {
  /** Leading drug / fluid name parsed from the order. */
  genericName: string;
  /** Dose, form, route, and frequency when present. */
  quantityDosageRoute: string;
  /** Original order clause used for dedupe / audit. */
  source: string;
};

// Longer unit spellings first so "1 liter" / "1 gram" are not split at L / g.
const DOSE =
  String.raw`\d+(?:\.\d+)?\s*(?:mg|mcg|µg|ug|grams?|g|mL|ml|liters?|L|IU|units?|%|mEq|meq)\b`;

const FORM =
  String.raw`\b(?:tablets?|tabs?|capsules?|caps?|ampoules?|ampules?|vials?|syrup|suspension|solution|cream|ointment|drops?|nebules?|nebulization|inhaler|sachet|bottle|tube)\b`;

const ROUTE =
  String.raw`\b(?:IV|IM|PO|SQ|SC|SL|PR|ID|oral(?:ly)?|intravenous(?:ly)?|intramuscular(?:ly)?|subcutaneous(?:ly)?|topical(?:ly)?|inhalation|nebuliz(?:e|ation|ed)|via\s+nasal\s+cannula)\b`;

const FREQUENCY =
  String.raw`\b(?:every\s+\d+\s*(?:hours?|hrs?|minutes?|mins?)|once\s+daily|twice\s+daily|thrice\s+daily|three\s+times\s+daily|four\s+times\s+daily|BID|TID|QID|OD|QD|QHS|QOD|PRN|as\s+needed|stat|STAT|at\s+bedtime|with\s+meals|before\s+meals|after\s+meals|loading\s+dose)\b`;

const IVF =
  String.raw`\b(?:IVF|PNSS|D5LR|D5NSS|D5W|D5\s*0?\.?9%?|plain\s+NSS|lactated\s+ringer'?s?|LR|NSS)\b`;

const DOSE_RE = new RegExp(DOSE, 'i');
const FORM_RE = new RegExp(FORM, 'i');
const ROUTE_RE = new RegExp(ROUTE, 'i');
const IVF_RE = new RegExp(IVF, 'i');

const MEDICINE_HINT = new RegExp(
  `(?:${DOSE}|${FORM}|${ROUTE}|${FREQUENCY}|${IVF}|\\bgive\\b|\\badminister\\b|\\bstart\\s+ivf\\b)`,
  'i',
);

/** Care / diagnostic statements that must not appear as drugs. */
const STATEMENT_START =
  /^(?:admit|discharge|transfer|refer|encourage|monitor|observe|repeat|order|request|for\s+consult|consult|ambulat|diet|npo|soft\s+diet|strict|keep|maintain\s+o(?:xygen|2)|continue\s+oxygen|oxygen\s+at|chest\s+x[- ]?ray|x[- ]?ray|ct\s+scan|ultrasound|ecg|ekg|cbc|complete\s+blood|urinalysis|urine\s+culture|blood\s+culture|abg|abgs|peak\s+expiratory|weigh|input\s+and\s+output|i\s*&\s*o|vital\s+signs|vs\s+q|notify|inform|refer\s+to|may\s+go|home\s+meds?\s+brought|patient\s+may|advance\s+diet|resume\s+diet|avoid\s+nsaids?\s*$|for\s+discharge)/i;

const LEADING_LABEL =
  /^(?:post[- ]?op(?:erative)?|pre[- ]?op(?:erative)?|plan|note|orders?)[:\s-]+/i;

function splitClauses(content: string): string[] {
  return content
    .replace(/\r\n/g, '\n')
    .split(/\n+|(?<=[.!;])\s+(?=[A-Z(])/)
    .map((part) => part.replace(LEADING_LABEL, '').replace(/^[•\-\u2022]\s*/, '').trim())
    .map((part) => part.replace(/[.;]+$/, '').trim())
    .filter((part) => part.length >= 3);
}

function looksLikeMedicine(clause: string): boolean {
  if (!MEDICINE_HINT.test(clause)) return false;
  if (STATEMENT_START.test(clause)) {
    // "Admit … Start IVF PNSS …" — keep only if an IVF / dose phrase is the core.
    if (!IVF_RE.test(clause) && !DOSE_RE.test(clause)) return false;
    // Drop pure admit/diagnostic lines even when they mention a dose elsewhere.
    if (/^(?:admit|discharge|chest|repeat|urinalysis|encourage|continue\s+oxygen)/i.test(clause)) {
      return IVF_RE.test(clause) || /(?:give|administer|start)\s+/i.test(clause);
    }
  }
  // Prefer clauses that name a product + dose/route/form, not free-text progress notes.
  return DOSE_RE.test(clause) || FORM_RE.test(clause) || ROUTE_RE.test(clause) || IVF_RE.test(clause);
}

function parseMedicine(clause: string): Cf4Medicine | null {
  const cleaned = clause.replace(/\s+/g, ' ').trim();
  if (!looksLikeMedicine(cleaned)) return null;

  // "Start IVF PNSS 1 liter at 80 ml/hr"
  const ivfMatch = cleaned.match(
    /(?:start\s+)?(IVF\s+)?(PNSS|D5LR|D5NSS|D5W|D5\s*0?\.?9%?|plain\s+NSS|lactated\s+ringer'?s?|LR|NSS)\b(.*)$/i,
  );
  if (ivfMatch && /(?:IVF|PNSS|D5LR|D5NSS|D5W|NSS|LR|ringer)/i.test(cleaned)) {
    const fluid = ivfMatch[2].replace(/\s+/g, ' ').trim();
    const genericName = ivfMatch[1] ? `IVF ${fluid}` : fluid;
    const rest = (ivfMatch[3] || '').replace(/^[,:\s]+/, '').trim();
    return {
      genericName,
      quantityDosageRoute: rest || cleaned,
      source: cleaned,
    };
  }

  // Drug name = words before the first dose quantity.
  const doseMatch = cleaned.match(new RegExp(DOSE, 'i'));
  if (doseMatch && doseMatch.index !== undefined) {
    let name = cleaned.slice(0, doseMatch.index).trim().replace(/[,:]+$/, '');
    name = name.replace(/^(?:give|administer|start|continue)\s+/i, '').trim();
    // Drop trailing connectors left on the name ("with", "plus").
    name = name.replace(/\b(?:with|plus|and|&)$/i, '').trim();
    if (!name || name.length < 2) return null;
    // Reject if the "name" is mostly a care verb phrase.
    if (STATEMENT_START.test(name)) return null;
    const quantityDosageRoute = cleaned.slice(doseMatch.index).trim();
    return { genericName: name, quantityDosageRoute, source: cleaned };
  }

  // Nebulization / named drug without an explicit mg (e.g. "Salbutamol nebulization every 4 hours")
  const nebMatch = cleaned.match(
    /^((?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})|[A-Za-z][A-Za-z-]{1,40})\s+(nebulization|inhaler|nebule)\b(.*)$/i,
  );
  if (nebMatch) {
    return {
      genericName: nebMatch[1].trim(),
      quantityDosageRoute: `${nebMatch[2]}${nebMatch[3] || ''}`.trim(),
      source: cleaned,
    };
  }

  return null;
}

function dedupeKey(medicine: Cf4Medicine): string {
  return `${medicine.genericName}|${medicine.quantityDosageRoute}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pull distinct medicines from every physician order on the stay.
 * Inactive / discontinued wording is kept when the clause is still a drug order.
 */
export function extractMedicinesFromOrders(
  orders: Array<{ content?: string | null }>,
): Cf4Medicine[] {
  const seen = new Set<string>();
  const medicines: Cf4Medicine[] = [];

  for (const order of orders) {
    const content = order.content?.trim();
    if (!content) continue;
    for (const clause of splitClauses(content)) {
      const medicine = parseMedicine(clause);
      if (!medicine) continue;
      const key = dedupeKey(medicine);
      if (seen.has(key)) continue;
      seen.add(key);
      medicines.push(medicine);
    }
  }

  return medicines;
}
