const FAVICON_COUNT = 4
const KEY = '_fav_idx'

export function getFaviconSrc() {
  let i = sessionStorage.getItem(KEY)
  if (!i) {
    i = Math.floor(Math.random() * FAVICON_COUNT) + 1
    sessionStorage.setItem(KEY, i)
  }
  return `/favicon-${i}.png`
}
