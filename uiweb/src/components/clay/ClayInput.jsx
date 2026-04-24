import { forwardRef } from 'react'

const ClayInput = forwardRef(function ClayInput(
  { className = '', ...rest },
  ref,
) {
  return <input ref={ref} className={`clay-input ${className}`} {...rest} />
})

export default ClayInput
