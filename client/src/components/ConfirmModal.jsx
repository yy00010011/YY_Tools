import React from 'react';

/**
 * 自定义确认对话框 — 深色主题，替代浏览器原生 confirm()
 * @param {{ title: string, message: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean, onConfirm: () => void, onCancel: () => void }} props
 */
export default function ConfirmModal({
  title,
  message,
  confirmLabel = '确认',
  cancelLabel = '取消',
  danger = false,
  onConfirm,
  onCancel
}) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box confirm-modal" onClick={e => e.stopPropagation()}>
        <h4>{title}</h4>
        <p>{message}</p>
        <div className="modal-actions">
          <button
            className={`stage-btn-sm${danger ? ' danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button className="stage-btn-sm" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
