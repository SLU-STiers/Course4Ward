import { useState } from 'react';
import { Button, Modal } from '../ui';

export interface SidebarProfileProps {
  initials: string;
  name: string;
  subtitle: string;
  onLogout: () => void;
  avatarSrc?: string;
}

export function SidebarProfile({
  initials,
  name,
  subtitle,
  onLogout,
  avatarSrc = '/144523.png',
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
        <dl className="ui-sidebar-profile__account-details">
          <div>
            <dt>Name</dt>
            <dd>{name}</dd>
          </div>
          <div>
            <dt>Role / account</dt>
            <dd>{subtitle}</dd>
          </div>
        </dl>
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
