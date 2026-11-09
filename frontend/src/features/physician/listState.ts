/** Part of the physician dashboard - see index.tsx for the screen shell. */

/**
 * Keys the physician lists remember their state under (`lib/sessionState`).
 *
 * Switching tabs unmounts the view, so without these the search text, filters,
 * sort order and page would reset every time. Session-scoped: a reload starts
 * clean, and signing out clears them.
 */
export const MANAGE_TABLE_STATE = "physician.manage.table";
export const MANAGE_SELECTED_STATE = "physician.manage.selected";
export const REQUESTS_TABLE_STATE = "physician.requests.table";

/** Overview has no sort control — just the status filter and the page. */
export const OVERVIEW_FILTER_STATE = "physician.overview.filter";
export const OVERVIEW_PAGE_STATE = "physician.overview.page";

/** The To-do widget's own patient filter and selection. */
export const TODO_STATUS_STATE = "physician.overview.todo.status";
export const TODO_VIEW_ALL_STATE = "physician.overview.todo.viewAll";
export const TODO_SELECTED_STATE = "physician.overview.todo.selected";
export const TODO_FOCUS_STATE = "physician.overview.todo.focused";
