/** A page number to render as a button, or a gap rendered as "…". */
export type PageItem = number | 'gap';

/**
 * Page buttons for a pager that stays short however many pages there are:
 * always the first and last page, plus a window around the current one.
 *
 * `pageItems(7, 200)` → `[1, 'gap', 5, 6, 7, 8, 9, 'gap', 200]`
 */
export function pageItems(page: number, pageCount: number, radius = 2): PageItem[] {
  const pages = new Set<number>([1, pageCount]);
  for (let p = page - radius; p <= page + radius; p++) {
    if (p >= 1 && p <= pageCount) pages.add(p);
  }

  const items: PageItem[] = [];
  let previous = 0;
  for (const p of [...pages].sort((a, b) => a - b)) {
    // A gap of exactly one page is shown as that page, not as "…".
    if (p - previous === 2) items.push(previous + 1);
    else if (p - previous > 2) items.push('gap');
    items.push(p);
    previous = p;
  }
  return items;
}
