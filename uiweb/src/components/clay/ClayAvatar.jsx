const PALETTES = [
  'bg-clay-pink-200 text-clay-pink-ink',
  'bg-clay-blue-200 text-clay-blue-ink',
  'bg-clay-green-200 text-clay-green-ink',
  'bg-clay-purple-200 text-clay-purple-ink',
  'bg-clay-yellow-200 text-clay-yellow-ink',
]

function hashIdx(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 1024
  return h % PALETTES.length
}

export default function ClayAvatar({ name = '?', src, size = 40, className = '' }) {
  const initial = (name || '?').trim().slice(0, 1).toUpperCase()
  const palette = PALETTES[hashIdx(String(name))]
  const shadowCls = size <= 36 ? 'shadow-clay-sm' : 'shadow-clay'
  const style = { width: size, height: size }
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={style}
        className={`rounded-full object-cover ${shadowCls} ${className}`}
      />
    )
  }
  return (
    <div
      style={style}
      className={`rounded-full flex items-center justify-center font-black ${shadowCls} ${palette} ${className}`}
    >
      {initial}
    </div>
  )
}
