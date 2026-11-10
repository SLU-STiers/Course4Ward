import assert from 'node:assert/strict';
import test from 'node:test';

import { pageItems } from '../src/lib/pagination.ts';
import { triageLevelInfo, triageQueueKey, triageUrgency, triageForDisplay } from '../src/lib/triage.ts';
import { admissionStatus, daysInCare, fullName } from '../src/lib/patient.ts';
import { orderTypeLabel } from '../src/components/orders/orderType.ts';
import { termsInSummary, splitOnTerms } from '../src/components/ai/summaryKeywords.ts';
import { readSessionState, writeSessionState, clearSessionState } from '../src/lib/sessionState.ts';

test('pagination keeps a compact window and represents skipped pages', () => {
  assert.deepEqual(pageItems(7, 200), [1, 'gap', 5, 6, 7, 8, 9, 'gap', 200]);
  assert.deepEqual(pageItems(3, 5), [1, 2, 3, 4, 5]);
});

test('triage describes levels, prioritizes the most urgent, and formats missing vitals', () => {
  assert.equal(triageLevelInfo(1)?.name, 'Resuscitation');
  assert.equal(triageLevelInfo(6), null);
  assert.ok(triageUrgency(1) > triageUrgency(5));
  assert.ok(triageQueueKey(1, '2026-10-01') > triageQueueKey(2, '2026-11-01'));
  assert.deepEqual(triageForDisplay(), {
    level: null,
    time: '—',
    heartRate: '—',
    respRate: '—',
    spo2: '—',
    bp: '—',
    temp: '—',
    pain: '—',
    notes: 'No notes recorded.',
    recordedBy: undefined,
  });
});

test('patient helpers and order labels cover expected display defaults', () => {
  assert.equal(fullName({ firstName: 'Ana', lastName: 'Reyes' }), 'Ana Reyes');
  assert.equal(admissionStatus(null), 'admitted');
  assert.equal(admissionStatus('2026-11-01'), 'discharged');
  assert.equal(daysInCare('2026-11-01', '2026-11-03'), 3);
  assert.equal(orderTypeLabel('ADMISSION'), 'Admission');
  assert.equal(orderTypeLabel(undefined), 'General');
});

test('summary keyword matching highlights order details without highlighting generic terms', () => {
  const summary = 'Paracetamol 500 mg PO every 6 hours was administered.';
  assert.deepEqual(termsInSummary('Administer paracetamol 500 mg PO q6h', summary), [
    'Paracetamol 500 mg PO every 6 hours',
  ]);
  assert.deepEqual(
    splitOnTerms(summary, [{ id: 'order-1', orderContent: 'CBC and paracetamol 500 mg PO' }]),
    ['', 'Paracetamol 500 mg PO every 6 hours', ' was administered.'],
  );
});

test('session state is available until cleared', () => {
  clearSessionState();
  assert.equal(readSessionState('filter', 'all'), 'all');
  writeSessionState('filter', 'pending');
  assert.equal(readSessionState('filter', 'all'), 'pending');
  clearSessionState();
  assert.equal(readSessionState('filter', 'all'), 'all');
});
