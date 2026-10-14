import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PhysicianOption } from '../../types';

export function PhysicianWardSelect({
  physicians,
  value,
  onChange,
  selectStyle,
  placeholder,
  disabled = false,
  ariaLabel,
  required = false,
}: {
  physicians: PhysicianOption[];
  value: string;
  onChange: (physicianId: string) => void;
  selectStyle: CSSProperties;
  placeholder: string;
  disabled?: boolean;
  ariaLabel: string;
  required?: boolean;
}) {
  const [wardId, setWardId] = useState('');
  const wards = useMemo(() => {
    const uniqueWards = new Map<string, string>();
    physicians.forEach((physician) =>
      physician.wards.forEach(({ ward }) => uniqueWards.set(ward.id, ward.name)),
    );
    return [...uniqueWards].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [physicians]);
  const filteredPhysicians = wardId
    ? physicians.filter((physician) => physician.wards.some(({ ward }) => ward.id === wardId))
    : physicians;

  return (
    <div style={{ display: 'grid', gap: 6, flex: 1 }}>
      <select
        style={selectStyle}
        value={wardId}
        onChange={(event) => {
          setWardId(event.target.value);
          onChange('');
        }}
        disabled={disabled || wards.length === 0}
        aria-label="Filter physicians by ward or specialty"
      >
        <option value="">All wards / specialties</option>
        {wards.map((ward) => (
          <option key={ward.id} value={ward.id}>
            {ward.name}
          </option>
        ))}
      </select>
      <select
        style={selectStyle}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || filteredPhysicians.length === 0}
        aria-label={ariaLabel}
        required={required}
      >
        <option value="">{placeholder}</option>
        {filteredPhysicians.map((physician) => (
          <option key={physician.id} value={physician.id}>
            Dr. {physician.firstName} {physician.lastName} ({physician.userId})
          </option>
        ))}
      </select>
    </div>
  );
}
