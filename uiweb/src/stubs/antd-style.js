import { forwardRef } from 'react'

const noop = () => ({})
const Stub = forwardRef((props, ref) => null)

export const createStyles = () => () => ({ styles: {}, cx: (...a) => a.join(' ') })
export const useTheme = () => ({})
export const useThemeMode = () => ({ themeMode: 'light' })
export default {}
