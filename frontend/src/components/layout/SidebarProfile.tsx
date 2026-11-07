import { useState } from 'react';
import { Button, Modal } from '../ui';

export interface SidebarProfileProps {
  initials: string;
  name: string;
  subtitle: string;
  onLogout: () => void;
  avatarSrc?: string;
  /** Hospital login id, shown separately from the role. */
  accountId?: string;
  /** Role label. Falls back to `subtitle` when the sidebar already shows the role. */
  roleLabel?: string;
  /**
   * Assigned names for this account. `null` while they are still loading.
   * Omit the prop when this role has no assignment row.
   */
  wards?: string[] | null;
  /** Row title for `wards`. Nurses use Ward; physicians use Specialty. */
  assignmentLabel?: string;
  /** Shown in the assignment row when the list could not be loaded. */
  wardUnavailable?: boolean;
}

export function SidebarProfile({
  initials,
  name,
  subtitle,
  onLogout,
  avatarSrc = '/144523.png',
  accountId,
  roleLabel,
  wards,
  assignmentLabel = 'Ward',
  wardUnavailable = false,
}: SidebarProfileProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="ui-sidebar-profile">
      <div className="ui-sidebar-profile__avatar">
        {!imageFailed ? (
          <img
            className="ui-sidebar-profile__image"
            src={avatarSrc}
            alt=""
            onError={() => setImageFailed(true)}
          />
        ) : null}
        {imageFailed ? <span className="ui-sidebar-profile__initials">{initials}</span> : null}
      </div>
      <button
        type="button"
        className="ui-sidebar-profile__details"
        aria-label={`View account details for ${name}`}
        title="View account details"
        onClick={() => setProfileOpen(true)}
      >
        <div className="ui-sidebar-profile__name">{name}</div>
        <div className="ui-sidebar-profile__subtitle">{subtitle}</div>
      </button>
      <Button
        variant="danger"
        size="sm"
        className="ui-sidebar-profile__logout"
        onClick={() => setLogoutOpen(true)}
      >
        Log out
      </Button>
      <Modal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="Account details"
        size="sm"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setProfileOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="ui-account">
          <div className="ui-account__identity">
            <div className="ui-account__avatar" aria-hidden="true">
              {!imageFailed ? (
                <img className="ui-sidebar-profile__image" src={avatarSrc} alt="" />
              ) : (
                <span className="ui-sidebar-profile__initials">{initials}</span>
              )}
            </div>
            <div className="ui-account__who">
              <p className="ui-account__name">{name}</p>
              <p className="ui-account__role">{roleLabel ?? subtitle}</p>
            </div>
          </div>
          <dl className="ui-account__rows">
            {accountId ? (
              <div className="ui-account__row">
                <dt>User ID</dt>
                <dd>{accountId}</dd>
              </div>
            ) : null}
            <div className="ui-account__row">
              <dt>Role</dt>
              <dd>{roleLabel ?? subtitle}</dd>
            </div>
            {wards !== undefined ? (
              <div className="ui-account__row">
                <dt>{assignmentLabel}</dt>
                <dd>
                  {wardUnavailable ? (
                    <span className="ui-account__muted">{assignmentLabel} could not be loaded</span>
                  ) : wards === null ? (
                    <span className="ui-account__muted">Loading {assignmentLabel.toLowerCase()}...</span>
                  ) : wards.length === 0 ? (
                    <span className="ui-account__muted">No {assignmentLabel.toLowerCase()} assigned</span>
                  ) : (
                    <span className="ui-account__wards">
                      {wards.map((ward) => (
                        <span key={ward} className="ui-account__ward">
                          {ward}
                        </span>
                      ))}
                    </span>
                  )}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </Modal>
      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Log out?"
        description="Are you sure you want to end your session?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setLogoutOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setLogoutOpen(false);
                onLogout();
              }}
            >
              Log out
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </div>
  );
}
