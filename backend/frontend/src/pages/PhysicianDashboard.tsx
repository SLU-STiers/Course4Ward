import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  patientsApi,
  ordersApi,
  notesApi,
  courseInWardApi,
} from '../services/domainApi';
import { useAuthStore } from '../store/authStore';
import type { Patient, CourseInWard } from '../types';

export function PhysicianDashboard() {
  const user = useAuthStore((s) => s.user)!;
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const { data: patients } = useQuery({
    queryKey: ['assigned-patients'],
    queryFn: () => patientsApi.assignedToMe().then((r) => r.data),
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
      <aside>
        <h3>My Patients</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {patients?.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPatient(p)}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: selectedPatient?.id === p.id ? '#ecfdf5' : 'white',
                cursor: 'pointer',
              }}
            >
              {p.lastName}, {p.firstName}
            </button>
          ))}
          {!patients?.length && <p style={{ color: '#64748b', fontSize: 13 }}>No assigned patients yet.</p>}
        </div>
      </aside>

      <section>
        {selectedPatient ? (
          <PatientDetail patient={selectedPatient} physicianId={user.id} />
        ) : (
          <p style={{ color: '#64748b' }}>Select a patient to view orders and notes.</p>
        )}
      </section>
    </div>
  );
}

function PatientDetail({ patient, physicianId }: { patient: Patient; physicianId: string }) {
  const qc = useQueryClient();
  const [orderDesc, setOrderDesc] = useState('');
  const [orderType, setOrderType] = useState('MEDICATION');
  const [frequency, setFrequency] = useState('');
  const [noteText, setNoteText] = useState('');

  const { data: orders } = useQuery({
    queryKey: ['orders', patient.id],
    queryFn: () => ordersApi.forPatient(patient.id).then((r) => r.data),
  });

  const { data: summaries } = useQuery({
    queryKey: ['summaries', patient.id],
    queryFn: () => courseInWardApi.forPatient(patient.id).then((r) => r.data),
  });

  const createOrder = useMutation({
    mutationFn: () =>
      ordersApi.create({
        patientId: patient.id,
        orderingPhysicianId: physicianId,
        type: orderType,
        description: orderDesc,
        frequency: frequency || undefined,
      }),
    onSuccess: () => {
      setOrderDesc('');
      setFrequency('');
      qc.invalidateQueries({ queryKey: ['orders', patient.id] });
    },
  });

  const createNote = useMutation({
    mutationFn: () => notesApi.create({ patientId: patient.id, content: noteText }),
    onSuccess: () => setNoteText(''),
  });

  const generateSummary = useMutation({
    mutationFn: () => courseInWardApi.generate(patient.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['summaries', patient.id] }),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2 style={{ marginBottom: 4 }}>
          {patient.firstName} {patient.lastName}
        </h2>
        <p style={{ color: '#64748b', fontSize: 13 }}>
          {patient.gender} · DOB {patient.dateOfBirth?.slice(0, 10)}
        </p>
      </div>

      <Card title="Place an order">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={orderType} onChange={(e) => setOrderType(e.target.value)}>
            <option value="MEDICATION">Medication</option>
            <option value="ADMISSION">Admission</option>
            <option value="DISCHARGE">Discharge</option>
            <option value="DIAGNOSTIC">Diagnostic</option>
            <option value="OTHER">Other</option>
          </select>
          <input
            placeholder="Description (e.g. Paracetamol 500mg)"
            value={orderDesc}
            onChange={(e) => setOrderDesc(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <input
            placeholder="Frequency (optional)"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
          />
          <button disabled={!orderDesc} onClick={() => createOrder.mutate()}>
            Add order
          </button>
        </div>
        <ul style={{ marginTop: 12 }}>
          {orders?.map((o) => (
            <li key={o.id} style={{ fontSize: 13, marginBottom: 4 }}>
              [{o.type}] {o.description} {o.frequency ? `— ${o.frequency}` : ''}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Physician notes / reminders">
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="Add a note or reminder"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            style={{ flex: 1 }}
          />
          <button disabled={!noteText} onClick={() => createNote.mutate()}>
            Add note
          </button>
        </div>
      </Card>

      <Card title="Course in the Ward — AI Summary">
        <button onClick={() => generateSummary.mutate()} disabled={generateSummary.isPending}>
          {generateSummary.isPending ? 'Generating…' : 'Generate today\'s summary (AI)'}
        </button>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {summaries?.map((s) => (
            <SummaryCard key={s.id} summary={s} patientId={patient.id} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({ summary, patientId }: { summary: CourseInWard; patientId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(summary.currentText);

  const edit = useMutation({
    mutationFn: () => courseInWardApi.edit(summary.id, text),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['summaries', patientId] });
    },
  });

  const regenerate = useMutation({
    mutationFn: () => courseInWardApi.regenerate(summary.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['summaries', patientId] }),
  });

  const approve = useMutation({
    mutationFn: () => courseInWardApi.approve(summary.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['summaries', patientId] }),
  });

  useEffect(() => setText(summary.currentText), [summary.currentText]);

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
        <span>{new Date(summary.summaryDate).toLocaleString()}</span>
        <StatusBadge status={summary.status} />
      </div>

      {editing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          style={{ width: '100%', marginTop: 8 }}
        />
      ) : (
        <p style={{ marginTop: 8 }}>{summary.currentText}</p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {editing ? (
          <button onClick={() => edit.mutate()}>Save edit</button>
        ) : (
          <button onClick={() => setEditing(true)}>Edit manually</button>
        )}
        <button onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
          Regenerate (AI)
        </button>
        {summary.status !== 'APPROVED' && (
          <button onClick={() => approve.mutate()} style={{ marginLeft: 'auto' }}>
            Approve
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT_AI: '#f59e0b',
    DRAFT_EDITED: '#3b82f6',
    APPROVED: '#16a34a',
  };
  return (
    <span style={{ color: colors[status] ?? '#64748b', fontWeight: 600 }}>
      {status.replace('_', ' ')}
    </span>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
      <h4 style={{ marginTop: 0 }}>{title}</h4>
      {children}
    </div>
  );
}
