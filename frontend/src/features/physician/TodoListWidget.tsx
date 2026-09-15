/** Part of the physician dashboard - see index.tsx for the screen shell. */

import { useEffect, useState } from 'react';
import { notesApi } from '../../services/domainApi';
import type { PhysicianNote } from '../../types';
import type { DashboardPatient } from './types';
import { overview } from './styles';

type NoteItem = PhysicianNote & { done: boolean };

export function TodoListWidget({ patients }: { patients: DashboardPatient[] }) {
  const [patientId, setPatientId] = useState('');
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMode, setEditingMode] = useState(false);

  useEffect(() => {
    const firstPatient = patients.find((patient) => patient.status === 'admitted') ?? patients[0];
    if (firstPatient && !patientId) setPatientId(firstPatient.id);
  }, [patients, patientId]);

  useEffect(() => {
    if (!patientId) {
      setNotes([]);
      return;
    }
    notesApi.forPatient(patientId)
      .then(({ data }) => setNotes(data.map((note) => ({ ...note, done: false }))))
      .catch(() => setNotes([]));
  }, [patientId]);

  const resetEditor = () => {
    setDraft('');
    setAdding(false);
    setEditingId(null);
  };

  const saveNote = () => {
    const content = draft.trim();
    if (!content || !patientId) return;
    if (editingId) {
      notesApi.update(editingId, { content }).then(({ data }) => {
        setNotes((previous) => previous.map((note) => note.id === data.id ? { ...note, ...data } : note));
        resetEditor();
      }).catch(() => undefined);
      return;
    }
    notesApi.create({ patientId, content }).then(({ data }) => {
      setNotes((previous) => [{ ...data, done: false }, ...previous]);
      resetEditor();
    }).catch(() => undefined);
  };

  const deleteNote = (id: string) => {
    notesApi.remove(id).then(() => {
      setNotes((previous) => previous.filter((note) => note.id !== id));
      if (editingId === id) resetEditor();
    }).catch(() => undefined);
  };

  return (
    <section style={{ ...overview.widget, flex: 1 }}>
      <div style={overview.todoHeader}>
        <h3 style={{ ...overview.sectionTitle, margin: 0 }}>To do List</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={patientId} onChange={(event) => setPatientId(event.target.value)} aria-label="Patient for notes">
            <option value="">Select patient</option>
            {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}
          </select>
          <button type="button" style={overview.addNotesBtn} onClick={() => { setEditingId(null); setDraft(''); setAdding(true); }}>
            Add Notes +
          </button>
          <button type="button" style={editingMode ? overview.doneNotesBtn : overview.editNotesBtn} onClick={() => { setEditingMode((value) => !value); resetEditor(); }}>
            {editingMode ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>
      {adding && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="New note" style={overview.addNoteInput} onKeyDown={(event) => event.key === 'Enter' && saveNote()} />
          <button type="button" onClick={saveNote} style={overview.addNotesBtn}>{editingId ? 'Update' : 'Save'}</button>
          <button type="button" onClick={resetEditor} style={overview.cancelNotesBtn}>Cancel</button>
        </div>
      )}
      <ul style={overview.todoList}>
        {notes.map((note) => (
          <li key={note.id} style={{ ...overview.todoItem, ...(editingMode ? overview.todoItemEditing : {}) }}>
            {editingId === note.id ? (
              <div style={overview.noteInlineEditor}>
                <input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} style={overview.noteInlineInput} aria-label="Edit note" onKeyDown={(event) => { if (event.key === 'Enter') saveNote(); if (event.key === 'Escape') resetEditor(); }} />
                <button type="button" onClick={saveNote} style={overview.doneNotesBtn}>Save</button>
                <button type="button" onClick={resetEditor} style={overview.cancelNotesBtn}>Cancel</button>
              </div>
            ) : (
              <>
                <label style={overview.todoLabel}>
                  <input type="checkbox" checked={note.done} onChange={() => setNotes((previous) => previous.map((item) => item.id === note.id ? { ...item, done: !item.done } : item))} style={overview.checkbox} />
                  <span style={note.done ? { textDecoration: 'line-through', color: '#94a3b8' } : undefined}>{note.notesArray}</span>
                </label>
                {editingMode && <div style={overview.todoActions}>
                  <button type="button" style={overview.editNotesBtn} onClick={() => { setEditingId(note.id); setDraft(note.notesArray); setAdding(false); }}>Edit</button>
                  <button type="button" style={overview.todoDeleteBtn} onClick={() => deleteNote(note.id)}>Delete</button>
                </div>}
              </>
            )}
          </li>
        ))}
        {!notes.length && <li style={overview.todoItem}>No notes for this patient.</li>}
      </ul>
    </section>
  );
}
