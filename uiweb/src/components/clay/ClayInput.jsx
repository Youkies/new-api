import { forwardRef } from 'react'

const ClayInput = forwardRef(function ClayInput(
  { className = '', leftIcon = null, rightIcon = null, wrapperClassName = '', ...rest },
  ref,
) {
  if (!leftIcon && !rightIcon) {
    return <input ref={ref} className={`clay-input ${className}`} {...rest} />
  }
  const padLeft = leftIcon ? '!pl-12' : ''
  const padRight = rightIcon ? '!pr-12' : ''
  return (
    <div className={`relative ${wrapperClassName}`}>
      {leftIcon && (
        <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 inline-flex text-clay-faint [&_svg]:w-4 [&_svg]:h-4 [&_svg]:stroke-[2.4]">
          {leftIcon}
        </span>
      )}
      <input
        ref={ref}
        className={`clay-input ${padLeft} ${padRight} ${className}`}
        {...rest}
      />
      {rightIcon && (
        <span className="absolute right-5 top-1/2 -translate-y-1/2 inline-flex text-clay-faint [&_svg]:w-4 [&_svg]:h-4 [&_svg]:stroke-[2.4]">
          {rightIcon}
        </span>
      )}
    </div>
  )
})

export default ClayInput
