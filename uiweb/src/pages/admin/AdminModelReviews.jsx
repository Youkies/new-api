import { useEffect, useMemo, useState } from 'react'
import {
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Sparkles,
  Star,
  Trophy,
} from 'lucide-react'
import ClayAlert from '../../components/clay/ClayAlert.jsx'
import ClayButton from '../../components/clay/ClayButton.jsx'
import ClayCard from '../../components/clay/ClayCard.jsx'
import ClayInput from '../../components/clay/ClayInput.jsx'
import ClayToggle from '../../components/clay/ClayToggle.jsx'
import ClayAdminShell from '../../components/layout/ClayAdminShell.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import {
  adminGetModelReviewSettings,
  adminListModelReviews,
  adminPatchModelReview,
  adminSaveModelReviewSettings,
} from '../../services/modelReviews.js'

const defaultSettings = {
  enabled: true,
  require_admin_review: false,
  points_per_quota: 1000,
  base_review_points: 500,
  quality_reward_min_score: 40,
  quality_reward_max: 1500,
  helpful_points: 20,
  helpful_reward_limit: 500,
  featured_review_points: 3000,
  daily_points_cap: 3000,
  weekly_points_cap: 10000,
  reward_multiplier: 100,
  min_redeem_points: 1000,
}

function getData(res) {
  return res?.data ?? null
}

function numeric(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.trunc(n)
}

export default function AdminModelReviews() {
  const toast = useToast()
  const [settings, setSettings] = useState(defaultSettings)
  const [reviews, setReviews] = useState([])
  const [page, setPage] = useState({ page: 1, page_size: 20, total: 0 })
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchSettings = async () => {
    const res = await adminGetModelReviewSettings()
    if (res?.success === false) throw new Error(res.message || '奖励设置加载失败')
    setSettings({ ...defaultSettings, ...(getData(res) || {}) })
  }

  const fetchReviews = async (nextPage = page.page) => {
    const res = await adminListModelReviews({
      p: nextPage,
      page_size: page.page_size,
      keyword: keyword.trim() || undefined,
      status: status || undefined,
    })
    if (res?.success === false) throw new Error(res.message || '评价列表加载失败')
    const data = getData(res) || {}
    setReviews(data.items || [])
    setPage({
      page: data.page || nextPage,
      page_size: data.page_size || page.page_size,
      total: data.total || 0,
    })
  }

  const fetchAll = async () => {
    setLoading(true)
    setError('')
    try {
      await Promise.all([fetchSettings(), fetchReviews(1)])
    } catch (err) {
      const message = err?.response?.data?.message || err.message || '模型评价后台加载失败'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const saveSettings = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = { ...settings }
      Object.keys(payload).forEach((key) => {
        if (typeof payload[key] === 'string') payload[key] = numeric(payload[key])
      })
      const res = await adminSaveModelReviewSettings(payload)
      if (res?.success === false) throw new Error(res.message || '奖励设置保存失败')
      setSettings({ ...defaultSettings, ...(getData(res) || {}) })
      toast('必吃榜奖励设置已保存', 'success')
    } catch (err) {
      const message = err?.response?.data?.message || err.message || '奖励设置保存失败'
      setError(message)
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const patchReview = async (review, payload) => {
    try {
      const res = await adminPatchModelReview(review.id, payload)
      if (res?.success === false) throw new Error(res.message || '操作失败')
      const updated = getData(res)
      setReviews((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      toast('评价状态已更新', 'success')
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '操作失败', 'error')
    }
  }

  const stats = useMemo(() => {
    const visible = reviews.filter((item) => item.status === 'visible').length
    const featured = reviews.filter((item) => item.featured).length
    const points = reviews.reduce((sum, item) => sum + Number(item.total_points_awarded || 0), 0)
    return { visible, featured, points }
  }, [reviews])

  const actions = (
    <>
      <ClayButton variant="ghost" onClick={fetchAll} disabled={loading || saving} className="!px-5">
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        刷新
      </ClayButton>
      <ClayButton variant="primary" onClick={saveSettings} disabled={loading || saving} className="!px-5">
        <Save className="w-4 h-4" />
        {saving ? '保存中' : '保存设置'}
      </ClayButton>
    </>
  )

  return (
    <ClayAdminShell
      title="必吃榜管理"
      subtitle="配置食评积分奖励、每日/每周封顶、兑换比例，并处理模型评价展示。"
      actions={actions}
    >
      {error && <ClayAlert tone="error" className="mb-5">{error}</ClayAlert>}

      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <Stat label="本页公开评价" value={stats.visible} tone="blue" />
        <Stat label="精选评价" value={stats.featured} tone="yellow" />
        <Stat label="本页已发积分" value={stats.points} tone="green" />
      </div>

      <ClayCard className="!p-6 mb-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="clay-icon-box !w-12 !h-12 text-clay-blue-300 shrink-0">
            <Settings2 className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-black mb-1">奖励规则</h2>
            <p className="text-sm text-clay-faint font-semibold leading-relaxed">
              开榜期可以把基础奖励和倍率调高；常驻期只要降低倍率或积分值，不需要改代码。
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-clay-faint">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            <ToggleField
              label="开启必吃榜"
              checked={settings.enabled}
              onChange={(value) => setSettings((prev) => ({ ...prev, enabled: value }))}
            />
            <ToggleField
              label="评价先审后显"
              checked={settings.require_admin_review}
              onChange={(value) => setSettings((prev) => ({ ...prev, require_admin_review: value }))}
            />
            <NumberField label="兑换比例" suffix="积分 = ¥1" value={settings.points_per_quota} onChange={(value) => setSettings((prev) => ({ ...prev, points_per_quota: value }))} />
            <NumberField label="最低起兑" suffix="积分" value={settings.min_redeem_points} onChange={(value) => setSettings((prev) => ({ ...prev, min_redeem_points: value }))} />
            <NumberField label="首次有效评价" suffix="积分" value={settings.base_review_points} onChange={(value) => setSettings((prev) => ({ ...prev, base_review_points: value }))} />
            <NumberField label="高质量最高" suffix="积分" value={settings.quality_reward_max} onChange={(value) => setSettings((prev) => ({ ...prev, quality_reward_max: value }))} />
            <NumberField label="质量起奖分" suffix="/100" value={settings.quality_reward_min_score} onChange={(value) => setSettings((prev) => ({ ...prev, quality_reward_min_score: value }))} />
            <NumberField label="有帮助单次" suffix="积分" value={settings.helpful_points} onChange={(value) => setSettings((prev) => ({ ...prev, helpful_points: value }))} />
            <NumberField label="单评有帮助上限" suffix="积分" value={settings.helpful_reward_limit} onChange={(value) => setSettings((prev) => ({ ...prev, helpful_reward_limit: value }))} />
            <NumberField label="管理员精选" suffix="积分" value={settings.featured_review_points} onChange={(value) => setSettings((prev) => ({ ...prev, featured_review_points: value }))} />
            <NumberField label="每日封顶" suffix="积分" value={settings.daily_points_cap} onChange={(value) => setSettings((prev) => ({ ...prev, daily_points_cap: value }))} />
            <NumberField label="每周封顶" suffix="积分" value={settings.weekly_points_cap} onChange={(value) => setSettings((prev) => ({ ...prev, weekly_points_cap: value }))} />
            <NumberField label="开榜倍率" suffix="%" value={settings.reward_multiplier} onChange={(value) => setSettings((prev) => ({ ...prev, reward_multiplier: value }))} />
          </div>
        )}
      </ClayCard>

      <ClayCard className="!p-5 mb-5">
        <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-clay-faint" />
            <ClayInput
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索模型、用户或评价"
              className="!pl-12"
            />
          </div>
          <select
            className="clay-input md:!w-48"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">全部状态</option>
            <option value="visible">公开</option>
            <option value="pending">待审核</option>
            <option value="hidden">隐藏</option>
          </select>
          <ClayButton variant="secondary" onClick={() => fetchReviews(1)} disabled={loading} className="!px-5">
            查询
          </ClayButton>
        </div>
      </ClayCard>

      <div className="space-y-4">
        {reviews.map((review) => (
          <ReviewAdminCard
            key={review.id}
            review={review}
            onPatch={(payload) => patchReview(review, payload)}
          />
        ))}
        {!loading && reviews.length === 0 && (
          <ClayCard className="!p-10 text-center text-clay-faint font-semibold">
            暂无评价。
          </ClayCard>
        )}
      </div>
    </ClayAdminShell>
  )
}

function Stat({ label, value, tone }) {
  const color = {
    blue: 'text-clay-blue-300',
    green: 'text-clay-green-300',
    yellow: 'text-clay-yellow-300',
  }[tone]
  return (
    <ClayCard className="!p-5">
      <p className="text-sm text-clay-faint font-bold mb-2">{label}</p>
      <p className={`text-3xl font-black ${color}`}>{value}</p>
    </ClayCard>
  )
}

function ToggleField({ label, checked, onChange }) {
  return (
    <div className="rounded-clay bg-clay-bg shadow-clay-inset p-4 flex items-center justify-between gap-4">
      <span className="font-black text-sm">{label}</span>
      <ClayToggle checked={checked} onChange={onChange} />
    </div>
  )
}

function NumberField({ label, value, suffix, onChange }) {
  return (
    <label className="block">
      <span className="block text-xs font-black text-clay-faint mb-2">{label}</span>
      <div className="relative">
        <input
          type="number"
          min="0"
          className="clay-input !pr-24"
          value={value}
          onChange={(e) => onChange(numeric(e.target.value))}
        />
        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-black text-clay-faint">
          {suffix}
        </span>
      </div>
    </label>
  )
}

function ReviewAdminCard({ review, onPatch }) {
  const hidden = review.status === 'hidden'
  return (
    <ClayCard className="!p-6">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center flex-wrap gap-2 mb-2">
            <StatusBadge status={review.status} />
            {review.featured && <span className="px-3 py-1 rounded-clay-pill text-xs font-black bg-clay-yellow-100 text-[#8a6a32]">精选</span>}
            {review.anonymous && <span className="px-3 py-1 rounded-clay-pill text-xs font-black bg-clay-pink-100 text-[#8a4860]">匿名</span>}
          </div>
          <h2 className="text-xl font-black break-words mb-1">{review.model_name}</h2>
          <p className="text-sm text-clay-faint font-semibold mb-3">
            用户 {review.username || review.user_id} · 已使用 {review.usage_count || 0} 次 · 奖励 {review.total_points_awarded || 0} 积分
          </p>
          <div className="flex items-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${star <= review.rating ? 'fill-clay-yellow-300 text-clay-yellow-300' : 'text-clay-faint/30'}`}
              />
            ))}
            <span className="ml-2 text-xs font-black text-clay-faint">质量 {review.quality_score || 0}/100</span>
          </div>
          <div className="text-sm font-semibold leading-relaxed space-y-1">
            {review.scenario && <p>场景：{review.scenario}</p>}
            {review.pros && <p>优点：{review.pros}</p>}
            {review.cons && <p>不足：{review.cons}</p>}
            {review.content && <p className="text-clay-faint whitespace-pre-wrap">{review.content}</p>}
          </div>
        </div>

        <div className="flex flex-wrap lg:flex-col gap-3 lg:w-40">
          <ClayButton
            variant={hidden ? 'primary' : 'ghost'}
            onClick={() => onPatch({ status: hidden ? 'visible' : 'hidden' })}
            className="!px-4 !py-2.5 !text-sm"
          >
            {hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {hidden ? '公开' : '隐藏'}
          </ClayButton>
          <ClayButton
            variant={review.featured ? 'secondary' : 'accent'}
            onClick={() => onPatch({ featured: !review.featured })}
            className="!px-4 !py-2.5 !text-sm"
          >
            <Sparkles className="w-4 h-4" />
            {review.featured ? '取消精选' : '精选'}
          </ClayButton>
        </div>
      </div>
    </ClayCard>
  )
}

function StatusBadge({ status }) {
  const map = {
    visible: ['公开', 'bg-clay-green-100 text-[#3d6b4f]'],
    pending: ['待审核', 'bg-clay-yellow-100 text-[#8a6a32]'],
    hidden: ['隐藏', 'bg-clay-pink-100 text-[#8a4860]'],
  }
  const [label, cls] = map[status] || [status || '未知', 'bg-clay-bg text-clay-faint']
  return <span className={`px-3 py-1 rounded-clay-pill text-xs font-black ${cls}`}>{label}</span>
}
