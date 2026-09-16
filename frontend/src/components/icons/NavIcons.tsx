/**
 * The sidebar icon set shared by every dashboard.
 *
 * One drawing spec for all of them — 24px grid, 1.7px stroke, round caps and
 * joins, `currentColor` — so the tabs in Nurse, Physician, Claims and Admin all
 * render at the same optical weight and inherit the active/hover colour from
 * `.ui-nav-item` automatically. `.ui-nav-item__icon` sizes them at 22×22.
 */
import type { ReactNode, SVGProps } from 'react';

export type NavIconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: NavIconProps & { children: ReactNode }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Overview / Dashboard — four cards on the grid. */
export function DashboardIcon(props: NavIconProps) {
  return (
    <Icon {...props}>
      <rect x="3.25" y="3.25" width="7.5" height="7.5" rx="2.25" />
      <rect x="13.25" y="3.25" width="7.5" height="7.5" rx="2.25" />
      <rect x="3.25" y="13.25" width="7.5" height="7.5" rx="2.25" />
      <rect x="13.25" y="13.25" width="7.5" height="7.5" rx="2.25" />
    </Icon>
  );
}

/** Manage — the day's chart: a clipboard with its entries. */
export function ManageIcon(props: NavIconProps) {
  return (
    <Icon {...props}>
      <rect x="8.5" y="2.75" width="7" height="3.75" rx="1.4" />
      <path d="M15.5 4.5h1.75A2.5 2.5 0 0 1 19.75 7v11.25a2.5 2.5 0 0 1-2.5 2.5H6.75a2.5 2.5 0 0 1-2.5-2.5V7a2.5 2.5 0 0 1 2.5-2.5H8.5" />
      <path d="M8.75 11.25h6.5" />
      <path d="M8.75 15h4.5" />
    </Icon>
  );
}

/** Requests — the tray everything submitted lands in. */
export function RequestsIcon(props: NavIconProps) {
  return (
    <Icon {...props}>
      <path d="M2.75 13h4.6l1.45 2.75h6.4L16.65 13h4.6" />
      <path d="M6.1 5h11.8c1.06 0 2 .67 2.35 1.67l1.75 5v5.83a2.5 2.5 0 0 1-2.5 2.5H4.5A2.5 2.5 0 0 1 2 17.5v-5.83l1.75-5A2.5 2.5 0 0 1 6.1 5Z" />
    </Icon>
  );
}

/** Export — a document leaving through the tray. */
export function ExportIcon(props: NavIconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5V14" />
      <path d="m7.75 10 4.25 4.25L16.25 10" />
      <path d="M4.5 16.75v1.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-1.5" />
    </Icon>
  );
}

/** Patient — one person's record. */
export function PatientIcon(props: NavIconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.75 20a7.25 7.25 0 0 1 14.5 0" />
    </Icon>
  );
}

/** Users — the accounts an administrator manages. */
export function UsersIcon(props: NavIconProps) {
  return (
    <Icon {...props}>
      <circle cx="9.5" cy="7.75" r="3.25" />
      <path d="M3.75 19.5a5.75 5.75 0 0 1 11.5 0" />
      <path d="M15.75 4.85a3.25 3.25 0 0 1 0 5.8" />
      <path d="M16.9 14.2c1.9.8 3.1 2.6 3.1 4.7" />
    </Icon>
  );
}

/** Calendar — the date field of the order navigator. */
export function CalendarIcon(props: NavIconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5.25" width="17" height="15.25" rx="3" />
      <path d="M8 3.25v3.5M16 3.25v3.5" />
      <path d="M3.5 10h17" />
      <path d="M8 13.75h.01M12 13.75h.01M16 13.75h.01M8 17h.01M12 17h.01" />
    </Icon>
  );
}

/** Chevron left — previous day / month. */
export function ChevronLeftIcon(props: NavIconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 6.5 9 12l5.5 5.5" />
    </Icon>
  );
}

/** Chevron right — next day / month. */
export function ChevronRightIcon(props: NavIconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 6.5 15 12l-5.5 5.5" />
    </Icon>
  );
}

/** Chevron down — opens a month / year picker. */
export function ChevronDownIcon(props: NavIconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 9.5 12 15l5.5-5.5" />
    </Icon>
  );
}
