import ClayInput from './ClayInput.jsx'

export default function ClayField({
  label,
  error,
  hint,
  required = false,
  className = '',
  inputClassName = '',
  as: Component = ClayInput,
  ...inputProps
}) {
  return (
    <div className={`mb-5 ${className}`}>
      {label && (
        <label className="block ml-4 mb-2 font-bold text-sm text-clay-ink">
          {label}
          {required && <span className="ml-1 text-clay-pink-300">*</span>}
        </label>
      )}
      <Component className={inputClassName} {...inputProps} />
      {error ? (
        <p className="ml-4 mt-2 text-xs font-semibold text-clay-pink-400">{error}</p>
      ) : hint ? (
        <p className="ml-4 mt-2 text-xs text-clay-faint">{hint}</p>
      ) : null}
    </div>
  )
}
