import { forwardRef } from 'react'

const Stub = forwardRef(({ children, ...props }, ref) =>
  children != null ? children : null
)

export const Center = Stub
export const Flexbox = Stub
export default {}
