/** Part of the nurse dashboard — room dropdown with a floor filter; free rooms are pickable, occupied ones are flagged. */

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover } from '../../components/ui/Popover';
import { patientsApi } from '../../services/domainApi';
import type { WardRoom } from '../../types';
import { addPatient as s, TEAL } from './styles';

/** "room 101", " Rm. 101 " and "101" all name room 101 (matches the API). */
export const normalizeRoom = (value: string) =>
  value.trim().replace(/^(room|rm\.?)\s*/i, '').toUpperCase();

/** Room numbers carry their floor before the last two digits: 105 → 1, 1203 → 12. */
export const floorOf = (number: string) => (number.length > 2 ? number.slice(0, -2) : '');

/** The ward rooms with live occupancy; `reload` refreshes them, e.g. after a failed save. */
export function useWardRooms(enabled = true) {
  const [rooms, setRooms] = useState<WardRoom[] | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(
    () =>
      patientsApi
        .listRooms()
        .then(({ data }) => {
          setRooms(data);
          setFailed(false);
        })
        .catch(() => setFailed(true)),
    [],
  );

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  return { rooms, failed, reload };
}

/** A room another admission holds; the admission's own room is free to keep. */
const takenByOther = (room: WardRoom, admissionId?: string) =>
  room.occupied && room.occupiedByAdmissionId !== admissionId;

/** Why `value` cannot be this admission's room, or null when it can (or nothing is chosen yet). */
export function roomProblem(value: string, rooms: WardRoom[] | null, admissionId?: string) {
  const number = normalizeRoom(value);
  if (!number || !rooms) return null;
  const room = rooms.find((candidate) => candidate.number === number);
  if (!room) return `Room ${number} does not exist`;
  if (takenByOther(room, admissionId)) return `Room ${number} is occupied`;
  return null;
}

export function RoomPicker({
  value,
  onChange,
  rooms,
  failed,
  admissionId,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  rooms: WardRoom[] | null;
  failed?: boolean;
  /** The admission being placed, so its current room is not reported as occupied. */
  admissionId?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [floor, setFloor] = useState(() => floorOf(normalizeRoom(value)));
  const [search, setSearch] = useState('');

  const chosen = normalizeRoom(value);
  const problem = roomProblem(value, rooms, admissionId);
  const floors = [...new Set((rooms ?? []).map((room) => floorOf(room.number)))].sort(
    (a, b) => Number(a) - Number(b),
  );
  const onFloor = (rooms ?? []).filter((room) => !floor || floorOf(room.number) === floor);
  const freeOnFloor = onFloor.filter((room) => !takenByOther(room, admissionId));

  const typed = normalizeRoom(search);
  // A typed number is looked up across every floor.
  const listed = typed ? (rooms ?? []).filter((room) => room.number.startsWith(typed)) : onFloor;
  const searchProblem = typed ? roomProblem(typed, rooms, admissionId) : null;
  const exact = rooms?.find((room) => room.number === typed);

  const pick = (number: string) => {
    onChange(number);
    setSearch('');
    setOpen(false);
  };

  const floorLabel = (value: string) => (value ? `Floor ${value}` : 'Other');

  return (
    <div>
      <div style={styles.row}>
        <select
          style={{ ...s.input, width: 150, flexShrink: 0 }}
          value={floor}
          onChange={(e) => setFloor(e.target.value)}
          aria-label="Filter rooms by floor"
          disabled={disabled || !rooms}
        >
          <option value="">All floors</option>
          {floors.map((value) => (
            <option key={value} value={value}>
              {floorLabel(value)}
            </option>
          ))}
        </select>

        <div style={{ flex: 1, minWidth: 0 }}>
          <Popover
            open={open && !disabled}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setSearch('');
            }}
            align="start"
            ariaLabel="Choose a room"
            anchorClassName="ui-popover__anchor--block"
            trigger={
              <button
                type="button"
                style={{
                  ...s.input,
                  ...styles.trigger,
                  ...(problem ? s.inputInvalid : {}),
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
                disabled={disabled}
                aria-invalid={problem ? true : undefined}
              >
                <span style={{ color: chosen ? '#0f172a' : '#94a3b8' }}>
                  {chosen ? `Room ${chosen}` : 'Select a room'}
                </span>
                <ChevronDown size={16} color="#64748b" aria-hidden="true" />
              </button>
            }
          >
            <div style={styles.panel}>
              <input
                style={{ ...s.input, height: 36 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  // A typed room is taken as-is; an occupied one is then flagged under the field.
                  if (exact) pick(exact.number);
                  else if (listed.length === 1) pick(listed[0].number);
                }}
                placeholder="Type a room number"
                aria-label="Search rooms"
                autoFocus
              />
              {searchProblem && exact && (
                <span style={s.fieldError} role="alert">
                  ⚠ {searchProblem}
                </span>
              )}

              <div style={styles.listHeader}>
                <span>{typed ? 'Matching rooms' : floor ? floorLabel(floor) : 'All floors'}</span>
                {rooms && !typed && (
                  <span>
                    {freeOnFloor.length} of {onFloor.length} free
                  </span>
                )}
              </div>

              {failed ? (
                <div style={styles.empty}>Could not load the rooms.</div>
              ) : !rooms ? (
                <div style={styles.empty}>Loading rooms…</div>
              ) : !listed.length ? (
                <div style={styles.empty}>
                  {typed && !exact ? `Room ${typed} does not exist.` : 'No rooms on this floor.'}
                </div>
              ) : (
                <div role="listbox" aria-label="Rooms" style={styles.list}>
                  {listed.map((room) => {
                    const taken = takenByOther(room, admissionId);
                    const selected = room.number === chosen;
                    return (
                      <button
                        key={room.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        aria-disabled={taken}
                        style={{
                          ...styles.option,
                          ...(selected ? styles.optionSelected : {}),
                          ...(taken ? styles.optionTaken : {}),
                        }}
                        onClick={() => !taken && pick(room.number)}
                        title={taken ? `Room ${room.number} is occupied` : undefined}
                      >
                        <span style={{ fontWeight: 700 }}>Room {room.number}</span>
                        <span style={{ ...styles.tag, ...(taken ? styles.tagTaken : styles.tagFree) }}>
                          {taken ? 'Occupied' : room.number === chosen ? 'Selected' : 'Available'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Popover>
        </div>
      </div>

      {problem ? (
        <span style={s.fieldError} role="alert">
          ⚠ {problem}.{problem.endsWith('occupied') ? ' Choose an available room.' : ''}
        </span>
      ) : (
        chosen &&
        rooms && (
          <span style={styles.ok} role="status">
            ✓ Room {chosen} is available
          </span>
        )
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  row: { display: 'flex', gap: 8 },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    textAlign: 'left',
  },
  panel: { display: 'flex', flexDirection: 'column', gap: 8, width: 280 },
  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 240, overflowY: 'auto' },
  option: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '8px 10px',
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  optionSelected: { backgroundColor: '#f0fdfa', boxShadow: `inset 0 0 0 1px ${TEAL}` },
  optionTaken: { color: '#94a3b8', cursor: 'not-allowed' },
  tag: { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 },
  tagFree: { color: '#15803d', backgroundColor: '#dcfce7' },
  tagTaken: { color: '#b91c1c', backgroundColor: '#fee2e2' },
  ok: { display: 'block', marginTop: 4, fontSize: 12, fontWeight: 600, color: '#15803d' },
  empty: { fontSize: 12, color: '#64748b', padding: '6px 2px' },
};
