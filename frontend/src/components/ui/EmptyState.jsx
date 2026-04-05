export default function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-1)' }}>{title}</h3>
      {description && (
        <p className="text-sm mb-6 max-w-sm" style={{ color: 'var(--text-3)' }}>{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="rv-btn-primary">
          {action.label}
        </button>
      )}
    </div>
  );
}
