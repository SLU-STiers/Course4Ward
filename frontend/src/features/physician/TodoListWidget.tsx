/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { overview } from './styles';

import { INITIAL_TODOS } from './patient';

export function TodoListWidget() {
  const [todos, setTodos] = useState(
    INITIAL_TODOS.map((text) => ({ text, done: false })),
  );
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingMode, setEditingMode] = useState(false);

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    if (editingIndex === null) {
      setTodos((prev) => [...prev, { text, done: false }]);
    } else {
      setTodos((prev) =>
        prev.map((item, index) =>
          index === editingIndex ? { ...item, text } : item,
        ),
      );
      setEditingIndex(null);
    }
    setDraft("");
    setAdding(false);
  };

  const cancelNoteEdit = () => {
    setDraft("");
    setAdding(false);
    setEditingIndex(null);
  };

  return (
    <section style={{ ...overview.widget, flex: 1 }}>
      <div style={overview.todoHeader}>
        <h3 style={{ ...overview.sectionTitle, margin: 0 }}>To do List</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            style={overview.addNotesBtn}
            onClick={() => {
              setEditingIndex(null);
              setDraft("");
              setAdding(true);
            }}
          >
            Add Notes +
          </button>
          <button
            type="button"
            style={editingMode ? overview.doneNotesBtn : overview.editNotesBtn}
            onClick={() => {
              setEditingMode((value) => !value);
              cancelNoteEdit();
            }}
          >
            {editingMode ? "Done" : "Edit"}
          </button>
        </div>
      </div>
      {adding && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="New note"
            style={overview.addNoteInput}
            onKeyDown={(e) => e.key === "Enter" && addNote()}
          />
          <button type="button" onClick={addNote} style={overview.addNotesBtn}>
            {editingIndex === null ? "Save" : "Update"}
          </button>
          <button
            type="button"
            onClick={cancelNoteEdit}
            style={overview.cancelNotesBtn}
          >
            Cancel
          </button>
        </div>
      )}
      <ul style={overview.todoList}>
        {todos.map((item, idx) => (
          <li
            key={`${item.text}-${idx}`}
            style={{
              ...overview.todoItem,
              ...(editingMode ? overview.todoItemEditing : {}),
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <label style={overview.todoLabel}>
              <input
                type="checkbox"
                checked={item.done}
                onChange={() =>
                  setTodos((prev) =>
                    prev.map((t, i) =>
                      i === idx ? { ...t, done: !t.done } : t,
                    ),
                  )
                }
                style={overview.checkbox}
              />
              <span
                style={{
                  ...(item.done
                    ? { textDecoration: "line-through", color: "#94a3b8" }
                    : {}),
                  ...(editingMode ? { cursor: "pointer" } : {}),
                }}
                onClick={(event) => {
                  if (!editingMode) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setEditingIndex(idx);
                  setDraft(item.text);
                  setAdding(true);
                }}
              >
                {item.text}
              </span>
            </label>
            <div style={overview.todoActions}>
              {editingMode && (
                <button
                  type="button"
                  style={overview.todoDeleteBtn}
                  onClick={() =>
                    setTodos((prev) => prev.filter((_, index) => index !== idx))
                  }
                >
                  Delete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
