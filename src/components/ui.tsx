import type { ReactNode } from 'react';
import type { ProjectStatus, ScheduleStatus } from '../types';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  processing: 'Processing',
  ready: 'Ready',
  scheduled: 'Scheduled',
  published: 'Published',
  failed: 'Failed',
};

export function StatusPill({ status }: { status: ProjectStatus | ScheduleStatus | string }) {
  return <span className={`status-pill ${status}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-icon">{icon}</div>}
      <b>{title}</b>
      {children && <p>{children}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function SectionHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="modal confirm-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-body">
          <h2>{title}</h2>
          <div className="confirm-body">{body}</div>
          <div className="confirm-actions">
            <button className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button className={`btn ${danger ? 'btn-danger' : 'btn-lime'}`} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
