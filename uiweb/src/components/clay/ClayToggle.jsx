export default function ClayToggle({ checked = false, onChange }) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onChange?.(!checked)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          onChange?.(!checked)
        }
      }}
      className={`clay-toggle ${checked ? 'is-on' : ''}`}
    >
      <div className="clay-toggle-handle" />
    </div>
  )
}
