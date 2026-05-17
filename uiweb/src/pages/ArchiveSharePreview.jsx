import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Layers, ChevronLeft, Download, AlertTriangle, ArrowRight,
  RefreshCw, ShieldCheck, ShieldOff,
} from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayField from '../components/clay/ClayField.jsx'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import { useToast } from '../context/ToastContext.jsx'
import {
  getSharedArchivePreview, importSharedArchive,
} from '../services/archives.js'

export default function ArchiveSharePreview() {
  const toast = useToast()
  const navigate = useNavigate()
  const { code } = useParams()

  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(null)
  const [name, setName] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    getSharedArchivePreview(code).then((res) => {
      if (!res?.success) {
        setError(res?.message ?? '分享码无效或已失效')
      } else {
        setPreview(res.data)
        setName(res.data?.name ? `${res.data.name}（导入）` : '')
      }
    }).catch((e) => {
      setError(e?.response?.data?.message ?? '加载失败')
    }).finally(() => setLoading(false))
  }, [code])

  const onImport = async () => {
    if (!name.trim()) { toast('请输入存档名称', 'error'); return }
    setImporting(true)
    try {
      const res = await importSharedArchive(code, { name })
      if (!res?.success) throw new Error(res?.message ?? '导入失败')
      toast(`已导入 ${res.data?.created_count}/${res.data?.source_count} 个别名`)
      navigate(`/archives/${res.data?.archive_id}`)
    } catch (e) {
      toast(e?.response?.data?.message ?? e.message ?? '导入失败', 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <ClayConsoleShell title="导入分享存档" subtitle="预览后再决定是否导入到自己的账户" compactHeader>
      <div className="mb-4">
        <ClayButton variant="ghost" onClick={() => navigate('/archives')}>
          <ChevronLeft className="w-4 h-4" /> 返回存档列表
        </ClayButton>
      </div>

      {loading && (
        <ClayCard className="!py-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-clay-faint animate-spin" />
            <span className="text-clay-faint font-bold">加载中…</span>
          </div>
        </ClayCard>
      )}

      {!loading && error && (
        <ClayCard className="!py-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
            <span className="font-bold">{error}</span>
            <ClayButton variant="ghost" onClick={() => navigate('/archives')}>
              <ChevronLeft className="w-4 h-4" /> 返回存档列表
            </ClayButton>
          </div>
        </ClayCard>
      )}

      {!loading && !error && preview && (
        <>
          <ClayCard className="!p-5 mb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full shadow-clay bg-clay-blue-100 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-clay-blue-300" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-base">{preview.name}</div>
                <div className="text-xs text-clay-faint mt-0.5">{preview.alias_count} 个别名</div>
              </div>
            </div>
            {preview.description && (
              <div className="text-xs text-clay-faint mt-2">{preview.description}</div>
            )}
            {preview.is_own && (
              <div className="mt-3 px-3 py-2 rounded-clay-sm bg-amber-50 text-amber-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                这是你自己分享的存档，无法导入到自己账户。
              </div>
            )}
          </ClayCard>

          <ClayCard className="!p-0 mb-4 overflow-hidden">
            <div className="px-4 py-3 border-b border-black/5 text-xs font-bold text-clay-faint">
              别名清单
            </div>
            <div className="divide-y divide-black/5">
              {(preview.aliases || []).map((a, idx) => (
                <div key={idx} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm font-bold truncate">{a.alias_name}</div>
                    <div className="text-[11px] text-clay-faint mt-0.5 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded-clay-sm bg-clay-bg shadow-clay-inset font-bold">{a.source_group}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="font-mono truncate">{a.source_model}</span>
                    </div>
                  </div>
                  {a.accessible ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-clay-pill text-[11px] font-bold bg-emerald-100 text-emerald-700 shrink-0">
                      <ShieldCheck className="w-3 h-3" /> 可用
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-clay-pill text-[11px] font-bold bg-amber-100 text-amber-700 shrink-0">
                      <ShieldOff className="w-3 h-3" /> 无权限
                    </span>
                  )}
                </div>
              ))}
            </div>
          </ClayCard>

          {!preview.is_own && (
            <ClayCard className="!p-5">
              <div className="space-y-4">
                <ClayField
                  label="导入到我的账户，命名为"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="存档名称"
                  maxLength={64}
                />
                <div className="text-[11px] text-clay-faint">
                  无权限的别名仍会被导入，但会标记为已禁用，可以在导入后调整。
                </div>
                <div className="flex flex-col-reverse sm:flex-row gap-3 sm:items-center sm:justify-end">
                  <ClayButton variant="ghost" onClick={() => navigate('/archives')}>取消</ClayButton>
                  <ClayButton variant="primary" onClick={onImport} disabled={importing}>
                    <Download className="w-4 h-4" /> {importing ? '导入中…' : '导入'}
                  </ClayButton>
                </div>
              </div>
            </ClayCard>
          )}
        </>
      )}
    </ClayConsoleShell>
  )
}
