import { forwardRef } from 'react';

const Stub = forwardRef(({ children }) => (children != null ? children : null));

export const Center = Stub;
export const Flexbox = Stub;
export default {};
