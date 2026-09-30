/** Part of the nurse dashboard — shared building blocks for the Add Patient and Patient Details modals. */

import type { ReactNode } from 'react';
import patientInfoIcon from '../../Img/patient-information.png';
import assessmentIcon from '../../Img/assesment.png';
import careTeamIcon from '../../Img/care-team.png';
import { addPatient as s } from './styles';

export const SECTION_ICONS = {
  patientInfo: patientInfoIcon,
  triage: assessmentIcon,
  careTeam: careTeamIcon,
  room: patientInfoIcon,
};

const AVATAR_TONES = [
  { backgroundColor: '#e0f2fe', color: '#0369a1' },
  { backgroundColor: '#ede9fe', color: '#6d28d9' },
  { backgroundColor: '#dcfce7', color: '#15803d' },
  { backgroundColor: '#fef3c7', color: '#b45309' },
  { backgroundColor: '#fce7f3', color: '#be185d' },
];

export function avatarTone(key: string) {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function initialsOf(name: string) {
  return name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section style={s.section}>
      <div style={s.sectionHeader}>
        <span style={s.sectionIcon} aria-hidden="true">
          <img src={icon} alt="" style={s.sectionIconImg} />
        </span>
        <div>
          <h4 style={s.sectionTitle}>{title}</h4>
          {hint && <p style={s.sectionHint}>{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function DoctorCard({
  name,
  meta,
  action,
}: {
  name: string;
  meta: string;
  action?: ReactNode;
}) {
  return (
    <div style={s.doctorCard}>
      <span style={{ ...s.avatar, ...avatarTone(name) }}>{initialsOf(name)}</span>
      <div style={{ minWidth: 0 }}>
        <div style={s.doctorName}>{name}</div>
        <div style={s.doctorMeta}>{meta}</div>
      </div>
      {action}
    </div>
  );
}
