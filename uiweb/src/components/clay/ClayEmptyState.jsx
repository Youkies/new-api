export default function ClayEmptyState({
  icon = null,
  title = '',
  description = '',
  action = null,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center gap-3 py-10 px-6 rounded-clay-lg shadow-clay-inset-sm ${className}`}
      style={{ backgroundColor: 'rgb(var(--clay-input) / 0.5)' }}
    >
      {icon && (
        <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-clay-sm bg-clay-surface text-clay-faint">
          {icon}
        </div>
      )}
      {title && <div className="text-base font-extrabold text-clay-ink">{title}</div>}
      {description && <div className="text-sm font-bold text-clay-faint max-w-md">{description}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
