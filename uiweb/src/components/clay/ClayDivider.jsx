export default function ClayDivider({ label, className = '' }) {
  const grad = 'linear-gradient(to right, transparent, rgb(var(--clay-line) / 0.18), transparent)'
  const gradL = 'linear-gradient(to right, transparent, rgb(var(--clay-line) / 0.18))'
  const gradR = 'linear-gradient(to left, transparent, rgb(var(--clay-line) / 0.18))'
  if (!label) {
    return (
      <div
        className={`h-px w-full my-6 ${className}`}
        style={{ background: grad }}
      />
    )
  }
  return (
    <div className={`flex items-center gap-4 my-6 text-clay-faint text-xs font-extrabold uppercase tracking-wider ${className}`}>
      <span className="flex-1 h-px" style={{ background: gradL }} />
      <span>{label}</span>
      <span className="flex-1 h-px" style={{ background: gradR }} />
    </div>
  )
}
