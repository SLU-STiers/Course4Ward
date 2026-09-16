/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { TEAL } from './styles';

export function HeartIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path
        d="M14 23s-8-5.2-8-10.2C6 9.6 8.2 7.5 11 7.5c1.6 0 2.6.8 3 1.6.4-.8 1.4-1.6 3-1.6 2.8 0 5 2.1 5 5.3C22 17.8 14 23 14 23z"
        stroke={TEAL}
        strokeWidth="1.8"
      />
      <path
        d="M8 14h3l1.5-3 2 6 1.5-3H20"
        stroke={TEAL}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function BedIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="9" cy="10" r="2.2" stroke={TEAL} strokeWidth="1.8" />
      <path
        d="M5 20v-5.5h16A2.5 2.5 0 0 1 23.5 17v3M5 16.5h10"
        stroke={TEAL}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function WheelchairIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="11" cy="8" r="2" stroke={TEAL} strokeWidth="1.8" />
      <path
        d="M11 10.5v4.5h6l2.5 5"
        stroke={TEAL}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="19" r="3.5" stroke={TEAL} strokeWidth="1.8" />
    </svg>
  );
}
