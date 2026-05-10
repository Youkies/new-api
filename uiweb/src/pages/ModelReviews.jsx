import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  ChevronRight,
  Coins,
  Heart,
  Loader2,
  Medal,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
} from 'lucide-react'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayCheckbox from '../components/clay/ClayCheckbox.jsx'
import ClayInput from '../components/clay/ClayInput.jsx'
import ClayModal from '../components/clay/ClayModal.jsx'
import ClayPageShell from '../components/layout/ClayPageShell.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useUser } from '../context/UserContext.jsx'
import {
  getModelReviewEligibility,
  getModelReviewRankings,
  listModelReviews,
  markModelReviewHelpful,
  redeemModelReviewPoints,
  saveModelReview,
} from '../services/modelReviews.js'

const SCENARIOS = ['代码', '写作', '翻译', '总结', '长文', '角色扮演', '工具调用', '闲聊']
const TAGS = ['代码强', '中文好', '速度快', '便宜', '长文稳', '脑洞大', '少废话', '容易跑偏', '适合酒馆', '性价比高']

const emptyForm = {
  model_name: '',
  rating: 5,
  scenario: '',
  tags: [],
  pros: '',
  cons: '',
  content: '',
  anonymous: false,
  hide_usage: false,
}

function getData(res) {
  return res?.data ?? null
}

function formatRating(value) {
  const n = Number(value || 0)
  if (!n) return '暂无'
  return n.toFixed(1)
}

function formatScore(value) {
  const n = Number(value || 0)
  return n.toFixed(1)
}

function qualityLabel(score) {
  if (score >= 80) return '硬菜'
  if (score >= 60) return '可放心点'
  if (score >= 40) return '有参考'
  return '待试吃'
}

function pointsToQuotaText(points, setting) {
  const per = Number(setting?.points_per_quota || 1000)
  if (!points || !per) return '¥0'
  return `约 ¥${(points / per).toFixed(2)}`
}

export default function ModelReviews() {
  const toast = useToast()
  const { user } = useUser()
  const [rankings, setRankings] = useState([])
  const [settings, setSettings] = useState(null)
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [redeeming, setRedeeming] = useState(false)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedModel, setSelectedModel] = useState(null)
  const [reviews, setReviews] = useState([])
  const [reviewLoading, setReviewLoading] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [usage, setUsage] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const fetchRankings = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getModelReviewRankings()
      if (res?.success === false) throw new Error(res.message || '必吃榜加载失败')
      const data = getData(res) || {}
      setRankings(Array.isArray(data.entries) ? data.entries : [])
      setSettings(data.settings || null)
      setAccount(data.my_account || null)
    } catch (err) {
      setError(err?.response?.data?.message || err.message || '必吃榜加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRankings()
  }, [])

  const filteredRankings = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return rankings.filter((item) => {
      if (kw && !item.model_name?.toLowerCase().includes(kw)) return false
      if (filter === 'eligible') return item.eligible
      if (filter === 'reviewed') return Boolean(item.my_review)
      if (filter === 'featured') return Number(item.featured_count || 0) > 0
      return true
    })
  }, [rankings, keyword, filter])

  const openModel = async (entry, startReview = false) => {
    setSelectedModel(entry)
    setReviews([])
    setReviewLoading(true)
    try {
      const res = await listModelReviews({ model_name: entry.model_name, page_size: 20 })
      if (res?.success === false) throw new Error(res.message || '评价加载失败')
      setReviews(getData(res)?.items || [])
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '评价加载失败', 'error')
    } finally {
      setReviewLoading(false)
    }
    if (startReview) openReviewForm(entry)
  }

  const openReviewForm = async (entry) => {
    if (!user) {
      toast('登录后使用过模型就能评价', 'info')
      return
    }
    const myReview = entry?.my_review
    const nextForm = {
      ...emptyForm,
      ...(myReview ? {
        rating: myReview.rating || 5,
        scenario: myReview.scenario || '',
        tags: myReview.tag_list || [],
        pros: myReview.pros || '',
        cons: myReview.cons || '',
        content: myReview.content || '',
        anonymous: Boolean(myReview.anonymous),
        hide_usage: Boolean(myReview.hide_usage),
      } : {}),
      model_name: entry.model_name,
    }
    setForm(nextForm)
    setUsage(entry.my_usage || null)
    setModalOpen(true)
    try {
      const res = await getModelReviewEligibility(entry.model_name)
      if (res?.success === false) throw new Error(res.message || '使用记录读取失败')
      setUsage(getData(res))
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '使用记录读取失败', 'error')
    }
  }

  const toggleTag = (tag) => {
    setForm((prev) => {
      const exists = prev.tags.includes(tag)
      return {
        ...prev,
        tags: exists ? prev.tags.filter((item) => item !== tag) : [...prev.tags, tag],
      }
    })
  }

  const submitReview = async () => {
    setSaving(true)
    try {
      const res = await saveModelReview(form)
      if (res?.success === false) throw new Error(res.message || '评价保存失败')
      const data = getData(res) || {}
      setAccount(data.account || account)
      toast('食评已保存，积分奖励已按规则结算', 'success')
      setModalOpen(false)
      await fetchRankings()
      if (selectedModel?.model_name === form.model_name) {
        await openModel({ ...selectedModel, model_name: form.model_name }, false)
      }
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '评价保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const helpful = async (review) => {
    try {
      const res = await markModelReviewHelpful(review.id)
      if (res?.success === false) throw new Error(res.message || '操作失败')
      const updated = getData(res)?.review
      if (updated) {
        setReviews((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      }
      toast('已标记有帮助', 'success')
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '操作失败', 'error')
    }
  }

  const redeem = async () => {
    const points = Number(settings?.min_redeem_points || settings?.points_per_quota || 1000)
    if (!account?.available_points || account.available_points < points) {
      toast(`至少 ${points} 食评积分起兑`, 'info')
      return
    }
    setRedeeming(true)
    try {
      const res = await redeemModelReviewPoints(points)
      if (res?.success === false) throw new Error(res.message || '兑换失败')
      setAccount(getData(res)?.account || account)
      toast(`已兑换 ${points} 食评积分`, 'success')
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '兑换失败', 'error')
    } finally {
      setRedeeming(false)
    }
  }

  const heroStats = useMemo(() => {
    const reviewed = rankings.filter((item) => item.review_count > 0).length
    const canReview = rankings.filter((item) => item.eligible).length
    const helpfulCount = rankings.reduce((sum, item) => sum + Number(item.helpful_count || 0), 0)
    return { reviewed, canReview, helpfulCount }
  }, [rankings])

  return (
    <ClayPageShell>
      <div className="grid lg:grid-cols-[1.3fr_0.7fr] gap-5 mb-6">
        <ClayCard className="!p-7 bg-gradient-to-br from-clay-yellow-50 to-clay-bg">
          <div className="flex items-start gap-4">
            <div className="clay-icon-box !w-14 !h-14 text-clay-yellow-300 shrink-0">
              <Trophy className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-clay-faint mb-2">Model Taste Board</p>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-3">Youkies 必吃榜</h1>
              <p className="text-clay-faint font-semibold leading-relaxed max-w-2xl">
                真实使用后才能评价。五星、场景、优缺点和有帮助反馈会一起塑造模型口碑，认真食评可以获得食评积分并兑换额度。
              </p>
            </div>
          </div>
        </ClayCard>

        <ClayCard className="!p-6">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <p className="text-sm text-clay-faint font-bold">我的食评积分</p>
              <p className="text-3xl font-black">{account?.available_points || 0}</p>
            </div>
            <div className="clay-icon-box !w-12 !h-12 text-clay-green-300">
              <Coins className="w-5 h-5" strokeWidth={2.5} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <MiniStat label="已覆盖模型" value={heroStats.reviewed} />
            <MiniStat label="可评价" value={heroStats.canReview} />
            <MiniStat label="有帮助" value={heroStats.helpfulCount} />
            <MiniStat label="兑换价值" value={pointsToQuotaText(account?.available_points || 0, settings)} />
          </div>
          <ClayButton
            variant="accent"
            onClick={redeem}
            disabled={!user || redeeming || !account?.available_points}
            className="w-full !px-5"
          >
            {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
            积分兑换额度
          </ClayButton>
        </ClayCard>
      </div>

      {error && <ClayAlert tone="error" className="mb-5">{error}</ClayAlert>}

      <ClayCard className="!p-4 md:!p-5 mb-6">
        <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-clay-faint" />
            <ClayInput
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索模型名"
              className="!pl-12"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto clay-scrollbar-none pb-1 md:pb-0">
            {[
              ['all', '全部'],
              ['eligible', '我能评价'],
              ['reviewed', '我评过'],
              ['featured', '精选'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`shrink-0 px-5 py-3 rounded-clay-pill font-black text-sm transition-all ${
                  filter === key ? 'bg-clay-blue-100 text-[#43658b] shadow-clay' : 'bg-clay-bg shadow-clay-inset text-clay-faint'
                }`}
              >
                {label}
              </button>
            ))}
            <ClayButton variant="ghost" onClick={fetchRankings} disabled={loading} className="!px-4 !py-3">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </ClayButton>
          </div>
        </div>
      </ClayCard>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16 text-clay-faint">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="font-semibold">正在端菜…</p>
        </div>
      ) : (
        <div className="grid xl:grid-cols-[1fr_380px] gap-6">
          <div className="grid md:grid-cols-2 gap-5">
            {filteredRankings.map((entry, index) => (
              <RankingCard
                key={entry.model_name}
                entry={entry}
                rank={index + 1}
                onOpen={() => openModel(entry)}
                onReview={() => openModel(entry, true)}
              />
            ))}
          </div>

          <aside className="xl:sticky xl:top-6 self-start">
            <ModelReviewPanel
              user={user}
              entry={selectedModel}
              reviews={reviews}
              loading={reviewLoading}
              onReview={() => selectedModel && openReviewForm(selectedModel)}
              onHelpful={helpful}
            />
          </aside>
        </div>
      )}

      <ReviewModal
        open={modalOpen}
        form={form}
        usage={usage}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        onToggleTag={toggleTag}
        onSubmit={submitReview}
      />
    </ClayPageShell>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-clay bg-clay-bg shadow-clay-inset p-3">
      <p className="text-xs font-black text-clay-faint mb-1">{label}</p>
      <p className="font-black text-lg truncate">{value}</p>
    </div>
  )
}

function Stars({ value, onChange, size = 'md' }) {
  const cls = size === 'lg' ? 'w-8 h-8' : 'w-4 h-4'
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          className={onChange ? 'transition-transform hover:scale-110' : 'cursor-default'}
          aria-label={`${star} 星`}
        >
          <Star
            className={`${cls} ${star <= value ? 'fill-clay-yellow-300 text-clay-yellow-300' : 'text-clay-faint/40'}`}
            strokeWidth={2.5}
          />
        </button>
      ))}
    </div>
  )
}

function RankingCard({ entry, rank, onOpen, onReview }) {
  const tone = rank === 1 ? 'text-clay-yellow-300' : rank === 2 ? 'text-clay-blue-300' : rank === 3 ? 'text-clay-pink-300' : 'text-clay-purple-300'
  return (
    <ClayCard interactive className="!p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-4 min-w-0">
          <div className={`clay-icon-box !w-12 !h-12 ${tone} shrink-0`}>
            {rank <= 3 ? <Medal className="w-5 h-5" strokeWidth={2.5} /> : <Sparkles className="w-5 h-5" strokeWidth={2.5} />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-clay-faint mb-1">#{rank} · 必吃指数 {formatScore(entry.score)}</p>
            <h2 className="text-xl font-black break-words leading-tight">{entry.model_name}</h2>
          </div>
        </div>
        {entry.my_review && <span className="shrink-0 clay-badge">已评</span>}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <ScoreCell label="评分" value={formatRating(entry.average_rating)} />
        <ScoreCell label="食评" value={entry.review_count || 0} />
        <ScoreCell label="状态" value={qualityLabel(entry.average_quality)} />
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {entry.featured_count > 0 && <Badge>精选 {entry.featured_count}</Badge>}
        {entry.helpful_count > 0 && <Badge>有帮助 {entry.helpful_count}</Badge>}
        {entry.eligible && <Badge tone="green">可评价</Badge>}
        {!entry.has_enough_sample && <Badge tone="yellow">样本较少</Badge>}
      </div>

      <div className="flex items-center gap-3">
        <ClayButton variant="ghost" onClick={onOpen} className="flex-1 !px-4 !py-2.5 !text-sm">
          看评价
          <ChevronRight className="w-4 h-4" />
        </ClayButton>
        <ClayButton variant={entry.eligible ? 'primary' : 'secondary'} onClick={onReview} className="flex-1 !px-4 !py-2.5 !text-sm">
          {entry.my_review ? '修改食评' : '写食评'}
        </ClayButton>
      </div>
    </ClayCard>
  )
}

function ScoreCell({ label, value }) {
  return (
    <div className="rounded-clay bg-clay-bg shadow-clay-inset p-3 min-w-0">
      <p className="text-[11px] font-black text-clay-faint mb-1">{label}</p>
      <p className="text-lg font-black truncate">{value}</p>
    </div>
  )
}

function Badge({ children, tone = 'blue' }) {
  const cls = {
    blue: 'bg-clay-blue-100 text-[#43658b]',
    green: 'bg-clay-green-100 text-[#3d6b4f]',
    yellow: 'bg-clay-yellow-100 text-[#8a6a32]',
  }[tone]
  return <span className={`px-3 py-1 rounded-clay-pill text-xs font-black ${cls}`}>{children}</span>
}

function ModelReviewPanel({ user, entry, reviews, loading, onReview, onHelpful }) {
  if (!entry) {
    return (
      <ClayCard className="!p-6">
        <div className="clay-icon-box !w-12 !h-12 text-clay-blue-300 mb-4">
          <ShieldCheck className="w-5 h-5" strokeWidth={2.5} />
        </div>
        <h2 className="text-xl font-black mb-2">选择一个模型</h2>
        <p className="text-sm text-clay-faint font-semibold leading-relaxed">
          点开模型后可以看真实食评。登录后只要用过一次，就能给它打星和写评价。
        </p>
      </ClayCard>
    )
  }
  return (
    <ClayCard className="!p-6">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <p className="text-xs font-black text-clay-faint mb-1">当前模型</p>
          <h2 className="text-xl font-black break-words">{entry.model_name}</h2>
        </div>
        <Stars value={Math.round(entry.average_rating || 0)} />
      </div>
      <ClayButton variant={entry.eligible ? 'primary' : 'secondary'} onClick={onReview} className="w-full !px-5 mb-5">
        <Send className="w-4 h-4" />
        {entry.my_review ? '修改我的食评' : user ? '写一条食评' : '登录后评价'}
      </ClayButton>
      {loading ? (
        <div className="flex items-center justify-center py-8 text-clay-faint">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm font-semibold text-clay-faint py-6">还没有公开食评。</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} onHelpful={onHelpful} />
          ))}
        </div>
      )}
    </ClayCard>
  )
}

function ReviewCard({ review, onHelpful }) {
  return (
    <div className="rounded-clay bg-clay-bg shadow-clay-inset p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-black text-sm">{review.display_name}</p>
            {review.featured && <Badge tone="yellow">精选</Badge>}
            <Badge tone="green">{review.usage_label}</Badge>
          </div>
          <Stars value={review.rating || 0} />
        </div>
        <button
          type="button"
          onClick={() => onHelpful(review)}
          disabled={!review.can_mark_helpful || review.helpful_by_me}
          className={`shrink-0 px-3 py-2 rounded-clay-pill text-xs font-black flex items-center gap-1 ${
            review.helpful_by_me ? 'bg-clay-pink-100 text-[#8a4860]' : 'bg-clay-bg shadow-clay'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${review.helpful_by_me ? 'fill-current' : ''}`} />
          {review.helpful_count || 0}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {review.scenario && <Badge>{review.scenario}</Badge>}
        {(review.tag_list || []).map((tag) => <Badge key={tag}>{tag}</Badge>)}
      </div>
      {review.pros && <p className="text-sm font-semibold leading-relaxed mb-1">优点：{review.pros}</p>}
      {review.cons && <p className="text-sm font-semibold leading-relaxed mb-1">不足：{review.cons}</p>}
      {review.content && <p className="text-sm text-clay-faint font-semibold leading-relaxed whitespace-pre-wrap">{review.content}</p>}
    </div>
  )
}

function ReviewModal({ open, form, usage, saving, onClose, onChange, onToggleTag, onSubmit }) {
  const eligible = usage?.eligible || usage?.count > 0
  return (
    <ClayModal
      open={open}
      onClose={onClose}
      title="写模型食评"
      size="lg"
      footer={(
        <>
          <ClayButton variant="ghost" onClick={onClose} disabled={saving}>取消</ClayButton>
          <ClayButton variant="primary" onClick={onSubmit} disabled={saving || !eligible}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            保存食评
          </ClayButton>
        </>
      )}
    >
      <div className="space-y-5">
        <ClayAlert tone={eligible ? 'success' : 'warning'}>
          {eligible ? `已验证使用 ${usage?.count || 0} 次，可选择隐藏使用次数。` : '这个模型还没有你的成功使用记录，用一次后就能评价。'}
        </ClayAlert>

        <div>
          <p className="text-xs font-black text-clay-faint mb-2">模型</p>
          <p className="text-xl font-black break-words">{form.model_name}</p>
        </div>

        <div>
          <p className="text-xs font-black text-clay-faint mb-2">评分</p>
          <Stars value={form.rating} onChange={(rating) => onChange({ rating })} size="lg" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <label>
            <span className="block text-xs font-black text-clay-faint mb-2">使用场景</span>
            <select
              className="clay-input"
              value={form.scenario}
              onChange={(e) => onChange({ scenario: e.target.value })}
            >
              <option value="">选择场景</option>
              {SCENARIOS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs font-black text-clay-faint mb-2">一句话评价</span>
            <input
              className="clay-input"
              value={form.content}
              onChange={(e) => onChange({ content: e.target.value })}
              placeholder="例如：长文很稳，但速度偏慢。"
            />
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <label>
            <span className="block text-xs font-black text-clay-faint mb-2">优点</span>
            <textarea
              className="clay-input min-h-[96px] resize-y"
              value={form.pros}
              onChange={(e) => onChange({ pros: e.target.value })}
              placeholder="哪里好吃？"
            />
          </label>
          <label>
            <span className="block text-xs font-black text-clay-faint mb-2">不足</span>
            <textarea
              className="clay-input min-h-[96px] resize-y"
              value={form.cons}
              onChange={(e) => onChange({ cons: e.target.value })}
              placeholder="哪里需要避雷？"
            />
          </label>
        </div>

        <div>
          <p className="text-xs font-black text-clay-faint mb-3">标签</p>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tag) => {
              const active = form.tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onToggleTag(tag)}
                  className={`px-4 py-2 rounded-clay-pill text-sm font-black transition-all ${
                    active ? 'bg-clay-pink-100 text-[#8a4860] shadow-clay' : 'bg-clay-bg shadow-clay-inset text-clay-faint'
                  }`}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <ClayCheckbox checked={form.anonymous} onChange={(value) => onChange({ anonymous: value })} label="匿名评价" />
          <ClayCheckbox checked={form.hide_usage} onChange={(value) => onChange({ hide_usage: value })} label="隐藏使用次数" />
        </div>
      </div>
    </ClayModal>
  )
}
