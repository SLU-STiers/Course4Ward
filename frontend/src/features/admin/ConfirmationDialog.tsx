/** Part of the admin dashboard — see index.tsx for the screen shell. */

import { styles } from './styles';

export function ConfirmationDialog({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={styles.confirmationModal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.confirmationHeader}>
          <h3 style={styles.confirmationTitle}>{title}</h3>
        </div>
        <p style={styles.confirmationMessage}>{message}</p>
        <div style={styles.confirmationActions}>
          <button style={styles.secondaryButton} onClick={onCancel}>Cancel</button>
          <button style={styles.primaryButton} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
