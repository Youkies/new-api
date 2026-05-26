// IndexedDB-backed local store for Playground image history.
//
// Schema (object store `images`):
//   id: string (uuid)
//   blob: Blob
//   mime: string
//   prompt: string
//   model: string
//   group_name: string
//   size: string
//   quality: string
//   style: string
//   created_at: number (unix seconds)
//
// Indices: created_at desc, used to list newest first.

const DB_NAME = 'uiweb.playground.images'
const STORE = 'images'
const VERSION = 1
const MAX_ITEMS = 60

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

let _dbPromise = null
function openDB() {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.reject(new Error('IndexedDB not supported'))
  }
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('created_at', 'created_at', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _dbPromise
}

async function withStore(mode, fn) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    let result
    try {
      result = fn(store)
    } catch (e) {
      reject(e); return
    }
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function saveImage({ blob, mime, prompt, model, group_name, size, quality, style }) {
  if (!blob) throw new Error('blob required')
  const id = makeId()
  const item = {
    id,
    blob,
    mime: mime || blob.type || 'image/png',
    prompt: prompt || '',
    model: model || '',
    group_name: group_name || '',
    size: size || '',
    quality: quality || '',
    style: style || '',
    created_at: Math.floor(Date.now() / 1000),
  }
  await withStore('readwrite', (s) => s.put(item))
  await pruneOld(MAX_ITEMS)
  return item
}

export async function listImages(limit = MAX_ITEMS) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)
      const idx = store.index('created_at')
      const out = []
      const cur = idx.openCursor(null, 'prev')
      cur.onsuccess = (e) => {
        const c = e.target.result
        if (!c || out.length >= limit) { resolve(out); return }
        out.push(c.value)
        c.continue()
      }
      cur.onerror = () => reject(cur.error)
    } catch (e) { reject(e) }
  })
}

export async function deleteImage(id) {
  if (!id) return
  await withStore('readwrite', (s) => s.delete(id))
}

export async function getImage(id) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(id)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    } catch (e) { reject(e) }
  })
}

export async function pruneOld(maxCount = MAX_ITEMS) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const idx = store.index('created_at')
      const toDelete = []
      let i = 0
      const cur = idx.openCursor(null, 'prev')
      cur.onsuccess = (e) => {
        const c = e.target.result
        if (!c) {
          for (const id of toDelete) store.delete(id)
          resolve(toDelete.length); return
        }
        if (i >= maxCount) toDelete.push(c.value.id)
        i++
        c.continue()
      }
      cur.onerror = () => reject(cur.error)
    } catch (e) { reject(e) }
  })
}

export function decodeBase64ToBlob(b64, mime = 'image/png') {
  let raw = b64
  let m = mime
  if (raw.startsWith('data:')) {
    const idx = raw.indexOf(',')
    if (idx >= 0) {
      const head = raw.slice(5, idx)
      raw = raw.slice(idx + 1)
      const semi = head.indexOf(';')
      const detected = semi >= 0 ? head.slice(0, semi) : head
      if (detected.startsWith('image/')) m = detected
    }
  }
  const bin = atob(raw)
  const len = bin.length
  const arr = new Uint8Array(len)
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: m })
}

// Fetch a remote URL via the backend proxy (avoids CORS, applies SSRF guard).
export async function fetchImageBlobViaProxy(remoteUrl) {
  const res = await fetch(`/api/ui/playground/image-proxy?url=${encodeURIComponent(remoteUrl)}`, {
    credentials: 'include',
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { const j = await res.json(); msg = j?.message || msg } catch (_) {}
    throw new Error(msg)
  }
  return await res.blob()
}
