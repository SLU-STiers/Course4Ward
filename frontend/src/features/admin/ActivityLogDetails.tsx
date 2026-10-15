/** Part of the admin dashboard — see index.tsx for the screen shell. */

import { Fragment } from 'react';
import { Modal, StatusBadge } from '../../components/ui';
import { formatDateShort, formatTimeLocale } from '../../lib/format';
import { actionMeta, roleLabel } from './activityLabels';
import type { AuditLogEntry } from '../../types';

interface ActivityLogDetailsProps {
  entry: AuditLogEntry | null;
  onClose: () => void;
}

/**
 * What one activity log entry actually did.
 *
 * The action alone ("Patient record updated", "Account updated") cannot say
 * whether a room changed or a doctor joined the care team, or which account
 * fields were edited. The backend stores that as `details` on each entry; this
 * dialog shows it: the one-line summary, the facts recorded with it, and a
 * before/after table for edits.
 */
export function ActivityLogDetails({ entry, onClose }: ActivityLogDetailsProps) {
  if (!entry) return null;

  const meta = actionMeta(entry.action);
  const timestamp = new Date(entry.timeStamp);
  const details = entry.details;
  const items = details?.items ?? [];
  const changes = details?.changes ?? [];

  return (
    <Modal open onClose={onClose} title="Activity details" description={meta.description} size="lg">
      <div className="admin-log-details">
        <div className="admin-log-details__headline">
          <StatusBadge status={meta.badge} label={meta.label} />
          <p className="admin-log-details__summary">
            {details?.summary ?? meta.description}
          </p>
        </div>

        <dl className="admin-log-details__grid">
          <dt>Performed by</dt>
          <dd>
            {entry.user.firstName} {entry.user.lastName}{' '}
            <span className="admin-log-details__muted">
              ({entry.user.userId} · {roleLabel(entry.user.role)})
            </span>
          </dd>
          <dt>When</dt>
          <dd>
            {formatDateShort(timestamp)}, {formatTimeLocale(timestamp)}
          </dd>
          <dt>Log ID</dt>
          <dd className="admin-log-details__mono">{entry.id}</dd>
          {items.map((item) => (
            <Fragment key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </Fragment>
          ))}
        </dl>

        {changes.length > 0 ? (
          <section>
            <h3 className="admin-log-details__heading">What changed</h3>
            <div className="admin-log-details__changes-scroll">
              <table className="admin-log-details__changes">
                <thead>
                  <tr>
                    <th scope="col">Field</th>
                    <th scope="col">Before</th>
                    <th scope="col">After</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((change) => (
                    <tr key={change.field}>
                      <th scope="row">{change.field}</th>
                      <td className="admin-log-details__before">{change.from}</td>
                      <td className="admin-log-details__after">{change.to}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {!details ? (
          <p className="admin-log-details__muted">
            No further details were recorded for this entry. It was logged before the system
            started recording what each action changed.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
