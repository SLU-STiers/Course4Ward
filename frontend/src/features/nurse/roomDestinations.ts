/** Part of the nurse dashboard — room destinations keyed by admission id. In-memory only: not persisted, cleared on page reload. */

const rooms = new Map<string, string>();

export const getRoomDestination = (admissionId: string) => rooms.get(admissionId) ?? '';

export const setRoomDestination = (admissionId: string, room: string) => {
  const value = room.trim();
  if (value) rooms.set(admissionId, value);
  else rooms.delete(admissionId);
};
