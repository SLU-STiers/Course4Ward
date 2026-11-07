/** Part of the physician dashboard - see index.tsx for the screen shell. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDateShort, formatTimeMedium } from '../../lib/format';
import { notesApi } from '../../services/domainApi';
import type { PhysicianNote } from '../../types';
import type { DashboardPatient } from './types';
import { overview } from './styles';

type NoteItem = PhysicianNote & { done: boolean };

function Chevron() {
  return (
    <svg className="physician-todo__chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.5 9.5 12 15l5.5-5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TodoListWidget({ patients }: { patients: DashboardPatient[] }) {
  const roster = useMemo(
    () =>
      [...patients].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'admitted' ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [patients],
  );
  const rosterKey = roster.map((patient) => patient.id).join(',');
  const [statusFilter, setStatusFilter] = useState<'admitted' | 'discharged'>('admitted');
  const [viewAll, setViewAll] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusedPatientId, setFocusedPatientId] = useState('');
  const [notesByPatient, setNotesByPatient] = useState<Record<string, NoteItem[]>>({});
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [notePatientId, setNotePatientId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMode, setEditingMode] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const statusPatients = roster.filter((patient) => patient.status === statusFilter);
  const needle = query.trim().toLowerCase();
  const matchedPatients = needle
    ? statusPatients.filter((patient) => patient.name.toLowerCase().includes(needle))
    : statusPatients;
  const visiblePatients = (viewAll
    ? statusPatients
    : statusPatients.filter((patient) => selectedIds.includes(patient.id))
  ).filter((patient) => !needle || patient.name.toLowerCase().includes(needle));
  const focusedId = visiblePatients.some((patient) => patient.id === focusedPatientId)
    ? focusedPatientId
    : '';
  const noteTargetId = visiblePatients.length === 1 ? visiblePatients[0].id : focusedId;
  const noteTarget = visiblePatients.find((patient) => patient.id === noteTargetId);

  useEffect(() => {
    if (!roster.length) {
      setNotesByPatient({});
      return;
    }
    let cancelled = false;
    Promise.all(
      roster.map((patient) =>
        notesApi
          .forPatient(patient.id)
          .then(({ data }) => [patient.id, data] as const)
          .catch(() => [patient.id, [] as PhysicianNote[]] as const),
      ),
    ).then((entries) => {
      if (cancelled) return;
      setNotesByPatient((previous) => {
        const next: Record<string, NoteItem[]> = {};
        for (const [patientId, notes] of entries) {
          const kept = new Map((previous[patientId] ?? []).map((note) => [note.id, note.done]));
          next[patientId] = notes.map((note) => ({ ...note, done: kept.get(note.id) ?? false }));
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // Reload when the patient set changes, not on every live refresh of the same list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterKey]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const triggerLabel = viewAll
    ? statusFilter === 'admitted'
      ? 'All admitted patients'
      : 'All discharged patients'
    : visiblePatients.length === 1
      ? visiblePatients[0].name
      : visiblePatients.length
        ? `${visiblePatients.length} patients`
        : 'Select patients';

  const changeStatus = (next: 'admitted' | 'discharged') => {
    setStatusFilter(next);
    setViewAll(true);
    setSelectedIds([]);
    setFocusedPatientId('');
    setQuery('');
    resetEditor();
  };

  const toggleAll = () => {
    setViewAll((current) => !current);
    setSelectedIds([]);
    setFocusedPatientId('');
  };

  const togglePatient = (id: string) => {
    setFocusedPatientId('');
    if (viewAll) {
      setViewAll(false);
      setSelectedIds(statusPatients.filter((patient) => patient.id !== id).map((patient) => patient.id));
      return;
    }
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const resetEditor = () => {
    setDraft('');
    setAdding(false);
    setEditingId(null);
  };

  const replaceNote = (patientId: string, next: NoteItem) => {
    setNotesByPatient((previous) => ({
      ...previous,
      [patientId]: (previous[patientId] ?? []).map((note) => (note.id === next.id ? { ...note, ...next } : note)),
    }));
  };

  const saveNote = () => {
    const content = draft.trim();
    const patientId = editingId
      ? roster.find((patient) => (notesByPatient[patient.id] ?? []).some((note) => note.id === editingId))?.id
      : notePatientId;
    if (!content || !patientId) return;
    if (editingId) {
      notesApi.update(editingId, { content }).then(({ data }) => {
        replaceNote(patientId, { ...data, done: false });
        resetEditor();
        setEditingMode(false);
      }).catch(() => undefined);
      return;
    }
    notesApi.create({ patientId, content }).then(({ data }) => {
      setNotesByPatient((previous) => ({
        ...previous,
        [patientId]: [{ ...data, done: false }, ...(previous[patientId] ?? [])],
      }));
      resetEditor();
      setEditingMode(false);
    }).catch(() => undefined);
  };

  const deleteNote = (patientId: string, id: string) => {
    notesApi.remove(id).then(() => {
      setNotesByPatient((previous) => ({
        ...previous,
        [patientId]: (previous[patientId] ?? []).filter((note) => note.id !== id),
      }));
      if (editingId === id) resetEditor();
    }).catch(() => undefined);
  };

  const choosePatient = (id: string) => {
    setFocusedPatientId(id);
    setNotePatientId(id);
  };

  const startAdd = () => {
    if (!noteTargetId) return;
    setEditingId(null);
    setDraft('');
    setNotePatientId(noteTargetId);
    setAdding(true);
  };

  return (
    <section style={{ ...overview.widget, flex: 1 }}>
      <h3 style={{ ...overview.sectionTitle, margin: '0 0 10px' }}>To-do list</h3>
      <div className="physician-todo__toolbar">
        <div className="physician-todo__filters" role="group" aria-label="Patient status">
          <button
            type="button"
            className="physician-todo__filter physician-todo__filter--admitted"
            aria-pressed={statusFilter === 'admitted'}
            onClick={() => changeStatus('admitted')}
          >
            Admitted
          </button>
          <button
            type="button"
            className="physician-todo__filter physician-todo__filter--discharged"
            aria-pressed={statusFilter === 'discharged'}
            onClick={() => changeStatus('discharged')}
          >
            Discharged
          </button>
        </div>
        <div className="physician-todo__picker" ref={pickerRef}>
          <button
            type="button"
            className="physician-todo__trigger"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label="Patients for notes"
            onClick={() => setOpen((current) => !current)}
          >
            <span className="physician-todo__trigger-label">{triggerLabel}</span>
            <Chevron />
          </button>
          {open && (
            <div className="physician-todo__menu" role="group" aria-label="Patients for notes">
              <input
                className="physician-todo__search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search patient name"
                aria-label="Search patient name"
                autoFocus
              />
              <label className="physician-todo__option">
                <input type="checkbox" checked={viewAll} onChange={toggleAll} />
                <span className="physician-todo__option-name">All patients</span>
              </label>
              <div className="physician-todo__divider" />
              {matchedPatients.map((patient) => (
                <label key={patient.id} className="physician-todo__option">
                  <input
                    type="checkbox"
                    checked={viewAll || selectedIds.includes(patient.id)}
                    onChange={() => togglePatient(patient.id)}
                  />
                  <span className="physician-todo__option-name">{patient.name}</span>
                </label>
              ))}
              {!statusPatients.length && (
                <p className="physician-todo__empty">
                  No {statusFilter} patients assigned.
                </p>
              )}
              {statusPatients.length > 0 && !matchedPatients.length && (
                <p className="physician-todo__empty">No patient named “{query.trim()}”.</p>
              )}
            </div>
          )}
        </div>
        <div className="physician-todo__actions">
          <button
            type="button"
            style={{ ...overview.addNotesBtn, opacity: noteTargetId ? 1 : 0.45 }}
            onClick={startAdd}
            disabled={!noteTargetId}
          >
            Add note
          </button>
          <button
            type="button"
            style={editingMode ? overview.doneNotesBtn : overview.editNotesBtn}
            onClick={() => {
              setEditingMode((value) => !value);
              resetEditor();
            }}
          >
            {editingMode ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      {visiblePatients.length > 1 && !noteTarget && (
        <p className="physician-todo__hint">Click a patient below before adding a note.</p>
      )}

      {adding && noteTarget && (
        <div className="physician-todo__editor">
          <p className="physician-todo__hint">Note for {noteTarget.name}</p>
          <div className="physician-todo__editor-row">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="New note"
              style={{ ...overview.addNoteInput, height: 38 }}
              onKeyDown={(event) => event.key === 'Enter' && saveNote()}
            />
            <button type="button" onClick={saveNote} style={overview.addNotesBtn}>Save</button>
            <button type="button" onClick={resetEditor} style={overview.cancelNotesBtn}>Cancel</button>
          </div>
        </div>
      )}

      {!visiblePatients.length ? (
        <p className="physician-todo__empty">
          {needle ? `No patient named “${query.trim()}”.` : 'Select one or more patients, or choose all patients.'}
        </p>
      ) : (
        <div className="physician-todo__sections">
          {visiblePatients.map((patient) => {
            const notes = notesByPatient[patient.id] ?? [];
            return (
              <section
                key={patient.id}
                className={
                  patient.id === noteTargetId
                    ? 'physician-todo__section physician-todo__section--selected'
                    : 'physician-todo__section'
                }
              >
                <h4 className="physician-todo__section-title">
                  <button
                    type="button"
                    onClick={() => choosePatient(patient.id)}
                    aria-pressed={patient.id === noteTargetId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      width: '100%',
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      color: 'inherit',
                      font: 'inherit',
                      fontWeight: 800,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{patient.name}</span>
                    {patient.id === noteTargetId ? (
                      <span className="physician-todo__picked">Selected</span>
                    ) : (
                      <span className="physician-todo__count">{notes.length}</span>
                    )}
                  </button>
                </h4>
                {notes.length === 0 ? (
                  <p className="physician-todo__empty">No notes</p>
                ) : (
                  <ul className="physician-todo__notes">
                    {notes.map((note) => (
                      <li key={note.id} className="physician-todo__note">
                        {editingId === note.id ? (
                          <div style={overview.noteInlineEditor}>
                            <input
                              autoFocus
                              value={draft}
                              onChange={(event) => setDraft(event.target.value)}
                              style={overview.noteInlineInput}
                              aria-label={`Edit note for ${patient.name}`}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') saveNote();
                                if (event.key === 'Escape') resetEditor();
                              }}
                            />
                            <button type="button" onClick={saveNote} style={overview.doneNotesBtn}>Save</button>
                            <button type="button" onClick={resetEditor} style={overview.cancelNotesBtn}>Cancel</button>
                          </div>
                        ) : (
                          <>
                            <label className="physician-todo__note-body">
                              {!editingMode && (
                                <input
                                  className="physician-todo__check"
                                  type="checkbox"
                                  checked={note.done}
                                  onChange={() =>
                                    setNotesByPatient((previous) => ({
                                      ...previous,
                                      [patient.id]: (previous[patient.id] ?? []).map((item) =>
                                        item.id === note.id ? { ...item, done: !item.done } : item,
                                      ),
                                    }))
                                  }
                                />
                              )}
                              <span>
                                <span style={note.done ? { textDecoration: 'line-through', color: '#94a3b8' } : undefined}>
                                  {note.notesArray}
                                </span>
                                <time className="physician-todo__stamp" dateTime={note.createdAt}>
                                  {formatDateShort(note.createdAt)} · {formatTimeMedium(note.createdAt)}
                                </time>
                              </span>
                            </label>
                            {editingMode && (
                              <div style={overview.todoActions}>
                                <button
                                  type="button"
                                  style={overview.editNotesBtn}
                                  onClick={() => {
                                    setEditingId(note.id);
                                    setDraft(note.notesArray);
                                    setAdding(false);
                                  }}
                                >
                                  Edit
                                </button>
                                <button type="button" style={overview.todoDeleteBtn} onClick={() => deleteNote(patient.id, note.id)}>
                                  Delete
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
