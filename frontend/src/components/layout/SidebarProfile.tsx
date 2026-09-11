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
      <div className="ui-sidebar-profile__details">
        <div className="ui-sidebar-profile__name">{name}</div>
        <div className="ui-sidebar-profile__subtitle">{subtitle}</div>
      </div>
      <Button
        variant="danger"
        size="sm"
        className="ui-sidebar-profile__logout"
        onClick={() => setLogoutOpen(true)}
      >
        Log out
      </Button>
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
