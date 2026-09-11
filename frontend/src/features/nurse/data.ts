/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import type { AdmissionRecord, NursePatient, OrderSet, PatientChart, TriageAssessment } from './types';

export const MOCK_PATIENTS: NursePatient[] = [
  { id: '1', name: 'Sarah Brown', patientId: '1123', recordId: 'SH-2024-0123', admissionDate: '15/04/2026', color: '#ef4444', age: 28, gender: 'Female', initials: 'SB' },
  { id: '2', name: 'Michael Owen', patientId: '1122', recordId: 'SH-2024-0122', admissionDate: '15/04/2026', color: '#22c55e', age: 45, gender: 'Male', initials: 'MO' },
  { id: '3', name: 'Mary Jane', patientId: '1121', recordId: 'SH-2024-0121', admissionDate: '14/04/2026', color: '#84cc16', age: 32, gender: 'Female', initials: 'MJ' },
  { id: '4', name: 'Peter Doolie', patientId: '1120', recordId: 'SH-2024-0120', admissionDate: '14/04/2026', color: '#6366f1', age: 50, gender: 'Male', initials: 'PD' },
  { id: '5', name: 'Peter Doolie', patientId: '1119', recordId: 'SH-2024-0119', admissionDate: '14/04/2026', color: '#ef4444', age: 50, gender: 'Male', initials: 'PD' },
  { id: '6', name: 'Liam Park', patientId: '1117', recordId: 'SH-2024-0117', admissionDate: '15/04/2026', color: '#eab308', age: 41, gender: 'Male', initials: 'LP' },
  { id: '7', name: 'Nora Reyes', patientId: '1116', recordId: 'SH-2024-0116', admissionDate: '16/04/2026', color: '#d946ef', age: 36, gender: 'Female', initials: 'NR' },
  { id: '8', name: 'James Cruz', patientId: '1115', recordId: 'SH-2024-0115', admissionDate: '16/04/2026', color: '#06b6d4', age: 29, gender: 'Male', initials: 'JC' },
];
export const AVAILABLE_DOCTORS = [
  'Dr. Mike Mentzer',
  'Dr. Agcaoili Diddy',
  'Dr. Jecy Guillian',
  'Dr. John Doe',
];
const DEFAULT_TRIAGE: TriageAssessment = {
  time: '08:00 AM',
  heartRate: '86 bpm',
  respRate: '18 /min',
  spo2: '97%',
  bp: '120/80 mmHg',
  temp: '36.8 °C',
  pain: '2/10',
  notes: 'Stable on arrival. No acute distress.',
};
function buildChart(
  name: string,
  extras: Partial<PatientChart> & { triage?: Partial<TriageAssessment> } = {}
): PatientChart {
  const fromList = MOCK_PATIENTS.find((p) => p.name === name);
  return {
    name,
    age: extras.age ?? fromList?.age ?? 40,
    gender: extras.gender ?? fromList?.gender ?? '—',
    admissionDate: extras.admissionDate ?? fromList?.admissionDate ?? '15/04/2026',
    recordId: extras.recordId ?? fromList?.recordId ?? 'SH-2024-0000',
    assignedDoctors: extras.assignedDoctors ?? ['Dr. Mike Mentzer'],
    triage: { ...DEFAULT_TRIAGE, ...extras.triage },
  };
}
export const INITIAL_CHARTS: Record<string, PatientChart> = {
  'Sarah Brown': buildChart('Sarah Brown', {
    assignedDoctors: ['Dr. Mike Mentzer'],
    triage: {
      time: '08:12 AM',
      heartRate: '98 bpm',
      respRate: '22 /min',
      spo2: '94%',
      bp: '128/82 mmHg',
      temp: '38.2 °C',
      pain: '6/10',
      notes: 'Fever and productive cough. Priority 2 triage.',
    },
  }),
  'Michael Owen': buildChart('Michael Owen', {
    assignedDoctors: ['Dr. Mike Mentzer'],
    triage: {
      time: '07:40 AM',
      heartRate: '88 bpm',
      respRate: '16 /min',
      spo2: '98%',
      bp: '148/92 mmHg',
      temp: '36.9 °C',
      pain: '1/10',
      notes: 'Hypertension on arrival. Alert and oriented.',
    },
  }),
  'Mary Jane': buildChart('Mary Jane', {
    assignedDoctors: ['Dr. Jecy Guillian'],
    triage: {
      time: '04:10 PM',
      heartRate: '76 bpm',
      respRate: '16 /min',
      spo2: '99%',
      bp: '118/76 mmHg',
      temp: '36.6 °C',
      pain: '3/10',
      notes: 'Post-op recovery. Wound clean and dry.',
    },
  }),
};
export const INITIAL_ADMISSIONS: AdmissionRecord[] = [
  { id: 'ADM-0001', name: 'Sarah Brown', admittedOn: '15 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0002', name: 'Michael Owen', admittedOn: '15 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0003', name: 'Mary Jane', admittedOn: '14 Apr 2026', dischargedOn: '20 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0004', name: 'Peter Doolie', admittedOn: '14 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0005', name: 'Liam Park', admittedOn: '15 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0006', name: 'Nora Reyes', admittedOn: '16 Apr 2026', dischargedOn: '22 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0007', name: 'James Cruz', admittedOn: '16 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0008', name: 'Elena Santos', admittedOn: '17 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0009', name: 'Carlos Vega', admittedOn: '17 Apr 2026', dischargedOn: '25 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0010', name: 'Ava Lim', admittedOn: '18 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0011', name: 'Ben Torres', admittedOn: '10 Apr 2026', dischargedOn: '18 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0012', name: 'Mia Chen', admittedOn: '09 Apr 2026', dischargedOn: '16 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0013', name: 'Owen Blake', admittedOn: '08 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0014', name: 'Ruby Diaz', admittedOn: '07 Apr 2026', dischargedOn: '14 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0015', name: 'Noah Kim', admittedOn: '06 Apr 2026', dischargedOn: '12 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0016', name: 'Ivy Morales', admittedOn: '05 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0017', name: 'Leo Santos', admittedOn: '04 Apr 2026', dischargedOn: '11 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0018', name: 'Paula Reed', admittedOn: '03 Apr 2026', dischargedOn: '10 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0019', name: 'Grace Tan', admittedOn: '19 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0020', name: 'Hugo Ramos', admittedOn: '19 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0021', name: 'Iris Mendoza', admittedOn: '20 Apr 2026', dischargedOn: '28 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0022', name: 'Jules Navarro', admittedOn: '20 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0023', name: 'Kara Villanueva', admittedOn: '21 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0024', name: 'Marco Dela Cruz', admittedOn: '21 Apr 2026', dischargedOn: '29 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0025', name: 'Nina Flores', admittedOn: '22 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0026', name: 'Oscar Bautista', admittedOn: '22 Apr 2026', dischargedOn: '30 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0027', name: 'Pia Gonzales', admittedOn: '23 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0028', name: 'Quinn Herrera', admittedOn: '23 Apr 2026', dischargedOn: '01 May 2026', status: 'Discharged' },
];
export const DEFAULT_ORDER_SETS: Record<string, OrderSet[]> = {
  '1': [
    {
      dateKey: '2026-04-15',
      dateLabel: 'April 15, 2026',
      time: '8:00 AM',
      doctor: 'Dr. Mike Mentzer',
      orders: [
        'IV Ceftriaxone 1g q12h',
        'Paracetamol 500mg PRN for fever',
        'Monitor vital signs every 2 hours',
        'Chest X-ray',
      ],
    },
    {
      dateKey: '2026-04-15',
      dateLabel: 'April 15, 2026',
      time: '1:00 PM',
      doctor: 'Dr. Agcaoili Diddy',
      orders: ['Continue oxygen support at 2L/min', 'CBC repeat at 6 PM', 'Encourage oral fluids'],
    },
    {
      dateKey: '2026-04-14',
      dateLabel: 'April 14, 2026',
      time: '4:30 PM',
      doctor: 'Dr. Jecy Guillian',
      orders: ['Continue antibiotics', 'Observe for respiratory distress'],
    },
    {
      dateKey: '2026-04-13',
      dateLabel: 'April 13, 2026',
      time: '9:00 AM',
      doctor: 'Dr. Mike Mentzer',
      orders: ['Start IV fluids', 'NPO until further notice', 'Chest physiotherapy q8h'],
    },
  ],
  '2': [
    {
      dateKey: '2026-04-15',
      dateLabel: 'April 15, 2026',
      time: '7:50 AM',
      doctor: 'Dr. Mike Mentzer',
      orders: ['Amlodipine 5mg once daily', 'Monitor BP every 4 hours', 'Low-salt diet'],
    },
    {
      dateKey: '2026-04-14',
      dateLabel: 'April 14, 2026',
      time: '6:00 PM',
      doctor: 'Dr. John Doe',
      orders: ['Hold antihypertensives if SBP < 110', 'Repeat ECG in the morning'],
    },
  ],
  '3': [
    {
      dateKey: '2026-04-14',
      dateLabel: 'April 14, 2026',
      time: '4:30 PM',
      doctor: 'Dr. Jecy Guillian',
      orders: ['Continue oral antibiotics', 'Wound dressing daily', 'Ambulate as tolerated'],
    },
    {
      dateKey: '2026-04-13',
      dateLabel: 'April 13, 2026',
      time: '10:15 AM',
      doctor: 'Dr. Jecy Guillian',
      orders: ['Post-op vital signs q2h', 'Incentive spirometry'],
    },
  ],
};
export const DEFAULT_SUMMARIES: Record<string, string> = {
  '1':
    'Patient was maintained on IV Ceftriaxone every 12 hours, with Paracetamol given as needed for fever. Oxygen support was continued at 2L/min, and repeat laboratory tests were requested. Vital signs were monitored regularly, and the patient remained stable throughout the day.',
  '2': 'Patient presented with mild hypertension. Routine medications were administered and blood pressure remained stable.',
  '3': 'Patient recovering well post-operation. Current orders focus on antibiotics, wound care, and gradual ambulation.',
};
export function resolveChart(name: string, charts: Record<string, PatientChart>): PatientChart {
  return charts[name] ?? buildChart(name);
}
