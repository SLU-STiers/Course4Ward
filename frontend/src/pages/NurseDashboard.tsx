import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patientsApi, ordersApi } from '../services/domainApi';
import type { Patient } from '../types';

export function NurseDashboard() {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showIntake, setShowIntake] = useState(false);

  const qc = useQueryClient();
  const { data: patients } = useQuery({
    queryKey: ['assigned-patients'],
    queryFn: () => patientsApi.assignedToMe().then((r) => r.data),
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
      <aside>
        <h3>My Patients</h3>
        <button onClick={() => setShowIntake(true)} style={{ marginBottom: 12 }}>
          + New patient intake
        </button>
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
        </div>
      </aside>

      <section>
        {showIntake && (
          <IntakeForm
            onDone={() => {
              setShowIntake(false);
              qc.invalidateQueries({ queryKey: ['assigned-patients'] });
            }}
          />
        )}
        {selectedPatient && !showIntake && <NurseOrdersView patient={selectedPatient} />}
        {!selectedPatient && !showIntake && (
          <p style={{ color: '#64748b' }}>Select a patient or start a new intake.</p>
        )}
      </section>
    </div>
  );
}

function IntakeForm({ onDone }: { onDone: () => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('Female');
  const [dob, setDob] = useState('');
  const [assessment, setAssessment] = useState('');

  const createPatient = useMutation({
    mutationFn: () =>
      patientsApi.create({
        firstName,
        lastName,
        gender,
        dateOfBirth: dob,
        initialAssessment: assessment,
      } as any),
    onSuccess: onDone,
  });

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, maxWidth: 480 }}>
      <h4 style={{ marginTop: 0 }}>New patient intake</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <select value={gender} onChange={(e) => setGender(e.target.value)}>
          <option>Female</option>
          <option>Male</option>
          <option>Other</option>
        </select>
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        <textarea
          placeholder="Initial assessment"
          value={assessment}
          onChange={(e) => setAssessment(e.target.value)}
          rows={3}
        />
        <button
          disabled={!firstName || !lastName || !dob}
          onClick={() => createPatient.mutate()}
        >
          Save patient
        </button>
      </div>
    </div>
  );
}

function NurseOrdersView({ patient }: { patient: Patient }) {
  const qc = useQueryClient();
  const [physicianId, setPhysicianId] = useState('');
  const [orderType, setOrderType] = useState('MEDICATION');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState('');

  const { data: orders } = useQuery({
    queryKey: ['orders', patient.id],
    queryFn: () => ordersApi.forPatient(patient.id).then((r) => r.data),
  });

  const createOrder = useMutation({
    mutationFn: () =>
      ordersApi.create({
        patientId: patient.id,
        orderingPhysicianId: physicianId,
        type: orderType,
        description,
        frequency: frequency || undefined,
      }),
    onSuccess: () => {
      setDescription('');
      setFrequency('');
      qc.invalidateQueries({ queryKey: ['orders', patient.id] });
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2>
        {patient.firstName} {patient.lastName}
      </h2>

      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
        <h4 style={{ marginTop: 0 }}>Enter order on physician's behalf</h4>
        <p style={{ fontSize: 12, color: '#64748b', marginTop: -8 }}>
          Order stays attributed to the ordering physician for the record.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="Ordering physician ID (UUID)"
            value={physicianId}
            onChange={(e) => setPhysicianId(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <select value={orderType} onChange={(e) => setOrderType(e.target.value)}>
            <option value="MEDICATION">Medication</option>
            <option value="ADMISSION">Admission</option>
            <option value="DISCHARGE">Discharge</option>
            <option value="DIAGNOSTIC">Diagnostic</option>
            <option value="OTHER">Other</option>
          </select>
          <input
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <input
            placeholder="Frequency (optional)"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
          />
          <button
            disabled={!physicianId || !description}
            onClick={() => createOrder.mutate()}
          >
            Submit order
          </button>
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
        <h4 style={{ marginTop: 0 }}>Physician's orders</h4>
        <ul>
          {orders?.map((o) => (
            <li key={o.id} style={{ fontSize: 13, marginBottom: 6 }}>
              [{o.type}] {o.description} {o.frequency ? `— ${o.frequency}` : ''}{' '}
              <span style={{ color: '#64748b' }}>
                ({o.enteredByRole === 'NURSE_ON_BEHALF' ? 'entered by nurse' : 'entered by physician'})
              </span>
            </li>
          ))}
          {!orders?.length && <p style={{ color: '#64748b', fontSize: 13 }}>No orders yet.</p>}
        </ul>
      </div>
    </div>
  );
}
