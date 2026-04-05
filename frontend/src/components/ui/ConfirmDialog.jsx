export default function ConfirmDialog({
  isOpen, title, message, onConfirm, onCancel,
  confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="rv-card w-full max-w-md shadow-2xl">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-1)' }}>{title}</h3>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>{message}</p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg text-sm transition-colors rv-btn-ghost">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'rv-btn-primary'
            }`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
