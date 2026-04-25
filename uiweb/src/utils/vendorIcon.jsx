import * as LobeIcons from '@lobehub/icons/es/icons'

const FallbackIcon = LobeIcons.AiMass

export function getLobeHubIcon(iconName, size = 14) {
  if (typeof iconName === 'string') iconName = iconName.trim()
  if (!iconName) {
    return <FallbackIcon size={size} />
  }

  const segments = String(iconName).split('.')
  const baseKey = segments[0]
  const BaseIcon = LobeIcons[baseKey]

  let IconComponent = undefined
  let propStartIndex = 1

  if (BaseIcon && segments.length > 1 && BaseIcon[segments[1]]) {
    IconComponent = BaseIcon[segments[1]]
    propStartIndex = 2
  } else {
    IconComponent = LobeIcons[baseKey]
    propStartIndex = 1
  }

  if (
    !IconComponent ||
    (typeof IconComponent !== 'function' && typeof IconComponent !== 'object')
  ) {
    return <FallbackIcon size={size} />
  }

  const props = {}

  const parseValue = (raw) => {
    if (raw == null) return true
    let v = String(raw).trim()
    if (v.startsWith('{') && v.endsWith('}')) v = v.slice(1, -1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      return v.slice(1, -1)
    if (v === 'true') return true
    if (v === 'false') return false
    if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v)
    return v
  }

  for (let i = propStartIndex; i < segments.length; i++) {
    const seg = segments[i]
    if (!seg) continue
    const eqIdx = seg.indexOf('=')
    if (eqIdx === -1) {
      props[seg.trim()] = true
      continue
    }
    const key = seg.slice(0, eqIdx).trim()
    const valRaw = seg.slice(eqIdx + 1).trim()
    props[key] = parseValue(valRaw)
  }

  if (props.size == null && size != null) props.size = size

  return <IconComponent {...props} />
}
