/**
 * Tutorial registry. Each entry describes one tour:
 *   - title / subtitle: shown in modal header
 *   - steps: array of { image, caption } — images live in /public/tutorials/...
 *
 * When shipping a new feature, append an entry here and point the relevant
 * page's <TutorialButton> at it via the `tour` prop. No component changes
 * needed — the modal renders any tour by id.
 */
export const tutorials = {
  'archive-create': {
    title: '新建模型别名存档',
    subtitle: '把不同分组的模型重命名后统一在 Key 上调用',
    steps: [
      { image: '/tutorials/archive/create-1.jpg', caption: '在首页右上角点击菜单按钮' },
      { image: '/tutorials/archive/create-2.jpg', caption: '侧边栏选择「存档」' },
      { image: '/tutorials/archive/create-3.jpg', caption: '点击「+ 新建存档」按钮' },
      { image: '/tutorials/archive/create-4.jpg', caption: '随便填一个名称，其他字段留空，点保存' },
      { image: '/tutorials/archive/create-5.jpg', caption: '进入存档详情页，点「+ 新建别名」' },
      { image: '/tutorials/archive/create-6.jpg', caption: '别名 = 你想用的名字；源分组 = 已有的分组；源模型 = 真实模型名。如此反复添加常用模型' },
      { image: '/tutorials/archive/create-7.jpg', caption: '回到「令牌」页面，点「+ 新建令牌」' },
      { image: '/tutorials/archive/create-8.jpg', caption: '在「绑定方式」一栏切换到「自定义存档」' },
      { image: '/tutorials/archive/create-9.jpg', caption: '从下拉里选择刚才新建的存档，保存即可' },
    ],
  },
  'archive-import': {
    title: '导入他人分享的存档',
    subtitle: '用一个分享码就能复用别人配好的别名集',
    steps: [
      { image: '/tutorials/archive/import-1.jpg', caption: '从侧边栏菜单进入「存档」页' },
      { image: '/tutorials/archive/import-2.jpg', caption: '点击左侧「导入」按钮' },
      { image: '/tutorials/archive/import-3.jpg', caption: '把别人分享的分享码贴进去，点「预览」' },
      { image: '/tutorials/archive/import-4.jpg', caption: '划到最下面，按需要重新命名，点「导入」即可' },
    ],
  },
  'archive-share': {
    title: '分享存档给其他人',
    subtitle: '生成一个分享码，对方按导入流程即可复用',
    steps: [
      { image: '/tutorials/archive/share-1.jpg', caption: '在存档详情页，找到「分享」卡片' },
      { image: '/tutorials/archive/share-2.jpg', caption: '打开开关 → 点「复制分享链接」就能把整个存档分享给别人' },
    ],
  },
}

export function getTutorial(id) {
  return tutorials[id] || null
}

/**
 * Warm the browser cache by issuing parallel image requests for a tour's
 * steps. The Image objects are discarded immediately — the browser caches
 * the response (subject to the same Cache-Control headers as the real
 * <img> requests later), so when the user actually opens the modal each
 * step renders instantly.
 *
 * Safe to call multiple times: subsequent calls for an already-prefetched
 * tour are no-ops. Calls are scheduled via requestIdleCallback so they
 * don't compete with critical page loads.
 */
const prefetched = new Set()

function schedule(fn) {
  if (typeof window === 'undefined') return () => {}
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(fn, { timeout: 2000 })
    return () => window.cancelIdleCallback?.(id)
  }
  const id = window.setTimeout(fn, 200)
  return () => window.clearTimeout(id)
}

export function prefetchTutorial(id) {
  const t = getTutorial(id)
  if (!t) return () => {}
  if (prefetched.has(id)) return () => {}
  prefetched.add(id)
  return schedule(() => {
    for (const step of t.steps) {
      const img = new Image()
      img.decoding = 'async'
      img.src = step.image
    }
  })
}

export function prefetchTutorials(ids = []) {
  const cancels = ids.map(prefetchTutorial)
  return () => cancels.forEach((c) => c?.())
}
