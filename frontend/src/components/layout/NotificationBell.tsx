import notificationImg from '../../Img/notification.png';

type NotificationBellProps = {
  count?: string;
  showDot?: boolean;
  onClick?: () => void;
};

export function NotificationBell({ count = '2', showDot = false, onClick }: NotificationBellProps) {
  return (
    <div
      style={{
        position: 'relative',
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06)',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <img src={notificationImg} alt="Notifications" style={{ width: 23, height: 23, objectFit: 'contain' }} />
      {showDot ? (
        <span
          style={{
            position: 'absolute',
            top: 5,
            right: 5,
            width: 9,
            height: 9,
            borderRadius: '50%',
            backgroundColor: '#0284c7',
          }}
        />
      ) : (
        <span
          style={{
            position: 'absolute',
            top: -5,
            right: -5,
            minWidth: 19,
            height: 19,
            padding: '0 5px',
            borderRadius: 10,
            backgroundColor: '#2563eb',
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}
