import assert from 'node:assert/strict';
import test from 'node:test';

import { isNurseVisiblePatient, admissionStatusOf } from '../src/features/nurse/patientClass.ts';
import { triageForDisplay, triageQueueKey } from '../src/lib/triage.ts';

test('a registered emergency admission is visible to nurses with its triage assessment and queue priority', () => {
  const patient = {
    restricted: false,
    admissions: [{ patientClass: 'EMERGENCY', dischargeDate: null }],
  };
  const assessment = {
    triage: {
      triageLevel: 2,
      triageTime: '10:15',
      heartRate: 118,
      respRate: 24,
      spo2: 93,
      bpSystolic: 130,
      bpDiastolic: 85,
      temperature: 38,
      painScore: 7,
      recordedBy: { firstName: 'Nina', lastName: 'Santos' },
    },
    initialAssessment: 'Chest pain',
  };

  assert.equal(isNurseVisiblePatient(patient), true);
  assert.equal(admissionStatusOf(patient.admissions[0]), 'Emergency');
  assert.deepEqual(triageForDisplay(assessment), {
    level: 2,
    time: '10:15',
    heartRate: '118',
    respRate: '24',
    spo2: '93',
    bp: '130/85',
    temp: '38.0',
    pain: '7',
    notes: 'Chest pain',
    recordedBy: 'Nina Santos',
  });
  assert.ok(triageQueueKey(2, '2026-11-10T10:00:00') > triageQueueKey(4, '2026-11-10T09:00:00'));
});
