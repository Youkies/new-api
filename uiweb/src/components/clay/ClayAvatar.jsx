const PALETTES = [
  'bg-clay-pink-200 text-[#8a4860]',
  'bg-clay-blue-200 text-[#43658b]',
  'bg-clay-green-200 text-[#3d6b4f]',
  'bg-clay-purple-200 text-[#6b4d83]',
  'bg-clay-yellow-200 text-[#8a6a32]',
]

function hashIdx(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 1024
  return h % PALETTES.length
}

export default function ClayAvatar({ name = '?', src, size = 40, className = '' }) {
  const initial = (name || '?').trim().slice(0, 1).toUpperCase()
  const palette = PALETTES[hashIdx(String(name))]
  const style = { width: size, height: size }
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={style}
        className={`rounded-full object-cover shadow-clay ${className}`}
      />
    )
  }
  return (
    <div
      style={style}
      className={`rounded-full flex items-center justify-center font-black shadow-clay ${palette} ${className}`}
    >
      {initial}
    </div>
  )
}
