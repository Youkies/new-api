export default function ClayDivider({ label, className = '' }) {
  if (!label) {
    return (
      <div
        className={`h-px w-full my-6 ${className}`}
        style={{
          background:
            'linear-gradient(to right, transparent, rgba(163,177,198,0.4), transparent)',
        }}
      />
    )
  }
  return (
    <div className={`flex items-center gap-4 my-6 text-clay-faint text-xs font-bold uppercase tracking-wider ${className}`}>
      <span className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(163,177,198,0.4))' }} />
      <span>{label}</span>
      <span className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(163,177,198,0.4))' }} />
    </div>
  )
}
