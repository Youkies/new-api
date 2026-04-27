import { useState, useRef, useCallback } from 'react'
import {
  User,
  ShieldCheck,
  Bell,
  Palette,
  Save,
  LogOut,
  Trash2,
  KeyRound,
  Camera,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayField from '../components/clay/ClayField.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayTabs from '../components/clay/ClayTabs.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import ClayToggle from '../components/clay/ClayToggle.jsx'
import ClayModal from '../components/clay/ClayModal.jsx'
import ClayAvatar from '../components/clay/ClayAvatar.jsx'
import Cropper from 'react-easy-crop'
import ClaySelect from '../components/clay/ClaySelect.jsx'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import { useUser } from '../context/UserContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import {
  self as apiSelf,
  updateSelf,
  updateSetting,
  deleteSelf,
  uploadAvatar,
  deleteAvatar,
} from '../services/user.js'
import { logout as apiLogout } from '../services/auth.js'

const TABS = [
  { value: 'account', label: '账号', icon: User },
  { value: 'security', label: '安全', icon: ShieldCheck },
  { value: 'notifications', label: '通知', icon: Bell },
  { value: 'preferences', label: '偏好', icon: Palette },
]

export default function PersonalSetting() {
  const { user, setUser, logout } = useUser()
  const toast = useToast()
  const [tab, setTab] = useState('account')

  return (
    <ClayConsoleShell title="个人设置" subtitle="管理账号资料、安全策略与偏好">
      <ClayTabs value={tab} onChange={setTab} items={TABS} className="mb-6" />

      {tab === 'account' && <AccountTab user={user} setUser={setUser} toast={toast} logout={logout} />}
      {tab === 'security' && <SecurityTab toast={toast} />}
      {tab === 'notifications' && <NotificationsTab user={user} setUser={setUser} toast={toast} />}
      {tab === 'preferences' && <PreferencesTab user={user} setUser={setUser} toast={toast} />}
    </ClayConsoleShell>
  )
}

function AccountTab({ user, setUser, toast, logout }) {
  const [form, setForm] = useState({
    username: user?.username ?? '',
    display_name: user?.display_name ?? '',
    email: user?.email ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [avatarKey, setAvatarKey] = useState(Date.now())
  const fileRef = useRef(null)

  // Crop state
  const [cropSrc, setCropSrc] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState(null)
  const [uploading, setUploading] = useState(false)

  const avatarSrc = user?.has_avatar
    ? `/api/user/avatar/${user.id}?t=${avatarKey}`
    : undefined

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedArea(areaPixels)
  }, [])

  const onFilePick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const url = URL.createObjectURL(file)
    setCropSrc(url)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }

  const getCroppedBlob = (imageSrc, pixelCrop, maxBytes) =>
    new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = Math.min(pixelCrop.width, pixelCrop.height, 512)
        canvas.width = size
        canvas.height = size
        canvas.getContext('2d').drawImage(
          img,
          pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
          0, 0, size, size,
        )
        let quality = 0.92
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (blob.size > maxBytes && quality > 0.1) {
                quality -= 0.1
                tryCompress()
              } else {
                resolve(blob)
              }
            },
            'image/jpeg',
            quality,
          )
        }
        tryCompress()
      }
      img.src = imageSrc
    })

  const onCropConfirm = async () => {
    if (!croppedArea || !cropSrc) return
    setUploading(true)
    try {
      const blob = await getCroppedBlob(cropSrc, croppedArea, 200 * 1024)
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
      const res = await uploadAvatar(file)
      if (res?.success) {
        toast('头像已更新', 'success')
        const t = Date.now()
        setAvatarKey(t)
        const r = await apiSelf()
        if (r?.data) setUser({ ...r.data, _avatar_t: t })
      } else {
        toast(res?.message ?? '上传失败', 'error')
      }
    } catch (err) {
      toast(err?.response?.data?.message ?? err.message ?? '上传失败', 'error')
    } finally {
      setUploading(false)
      URL.revokeObjectURL(cropSrc)
      setCropSrc(null)
    }
  }

  const onCropCancel = () => {
    URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  const onSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await updateSelf({
        display_name: form.display_name,
      })
      if (res?.success) {
        toast('资料已更新', 'success')
        const r = await apiSelf()
        if (r?.data) setUser(r.data)
      } else {
        toast(res?.message ?? '保存失败', 'error')
      }
    } catch (err) {
      toast(err?.response?.data?.message ?? err.message ?? '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    try {
      const res = await deleteSelf()
      if (res?.success) {
        toast('账号已注销', 'info')
        try {
          await apiLogout()
        } catch (_) {}
        logout()
        setTimeout(() => window.location.replace('/'), 500)
      } else {
        toast(res?.message ?? '注销失败', 'error')
      }
    } catch (err) {
      toast(err?.response?.data?.message ?? err.message ?? '注销失败', 'error')
    }
  }

  return (
    <>
      <div className="grid lg:grid-cols-[1fr_2fr] gap-6">
        <ClayCard className="text-center">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={onFilePick}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative mx-auto mb-4 group cursor-pointer block"
            style={{ width: 96, height: 96 }}
          >
            <ClayAvatar name={form.display_name || form.username} src={avatarSrc} size={96} />
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-6 h-6 text-white" />
            </div>
          </button>
          {user?.has_avatar && (
            <button
              type="button"
              className="text-xs text-clay-faint hover:text-clay-pink-200 transition-colors mb-3"
              onClick={async () => {
                try {
                  const res = await deleteAvatar()
                  if (res?.success) {
                    toast('头像已移除', 'success')
                    setAvatarKey(Date.now())
                    const r = await apiSelf()
                    if (r?.data) setUser({ ...r.data, _avatar_t: Date.now() })
                  } else {
                    toast(res?.message ?? '移除失败', 'error')
                  }
                } catch (err) {
                  toast(err?.response?.data?.message ?? err.message ?? '移除失败', 'error')
                }
              }}
            >
              移除头像
            </button>
          )}
          <div className="font-black text-xl">{form.display_name || form.username}</div>
          <div className="text-sm text-clay-faint">ID {user?.id ?? '-'}</div>
          <div className="text-sm text-clay-faint mt-1">{form.email || '未绑定邮箱'}</div>
          <div className="mt-5 flex flex-col gap-3">
            <ClayButton
              variant="ghost"
              onClick={async () => {
                try {
                  await apiLogout()
                } catch (_) {}
                logout()
                toast('已退出登录', 'info')
                window.location.replace('/login')
              }}
            >
              <LogOut className="w-4 h-4" /> 退出登录
            </ClayButton>
            <ClayButton
              variant="secondary"
              onClick={() => setConfirmDelete(true)}
              className="!bg-clay-pink-100 !text-[#8a4860]"
            >
              <Trash2 className="w-4 h-4" /> 注销账号
            </ClayButton>
          </div>
        </ClayCard>

        <ClayCard>
          <h2 className="text-xl font-black mb-5">基本资料</h2>
          <form onSubmit={onSave}>
            <ClayField
              label="用户名"
              value={form.username}
              placeholder="用户名注册后不可修改"
              disabled
              hint="用户名是账号唯一标识,创建后不可修改"
            />
            <ClayField
              label="显示名称"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              placeholder="仪表盘问候会用到"
            />
            <ClayField
              label="邮箱"
              value={form.email}
              disabled
              hint="邮箱在注册时绑定,暂不支持修改"
            />
            <ClayButton variant="primary" type="submit" disabled={saving} className="mt-2">
              {saving ? '保存中…' : (<><Save className="w-4 h-4" /> 保存</>)}
            </ClayButton>
          </form>
        </ClayCard>
      </div>

      <ClayModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="确认注销账号"
        footer={
          <>
            <ClayButton variant="ghost" onClick={() => setConfirmDelete(false)}>
              取消
            </ClayButton>
            <ClayButton
              variant="secondary"
              onClick={onDelete}
              className="!bg-clay-pink-200 !text-white"
            >
              确定注销
            </ClayButton>
          </>
        }
      >
        <ClayAlert tone="warning" className="mb-4">
          注销后账号数据将被清理,此操作不可恢复。
        </ClayAlert>
        <p className="text-sm text-clay-ink">确认要注销账号 <strong>{user?.username}</strong> 吗?</p>
      </ClayModal>

      {/* Avatar crop modal */}
      <ClayModal
        open={!!cropSrc}
        onClose={onCropCancel}
        title="裁剪头像"
        footer={
          <>
            <ClayButton variant="ghost" onClick={onCropCancel}>
              取消
            </ClayButton>
            <ClayButton
              variant="primary"
              onClick={onCropConfirm}
              disabled={uploading}
            >
              {uploading ? '上传中...' : '确认上传'}
            </ClayButton>
          </>
        }
      >
        <div className="relative w-full" style={{ height: 320 }}>
          {cropSrc && (
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>
        <div className="flex items-center gap-3 mt-4 px-2">
          <ZoomOut className="w-4 h-4 text-clay-faint flex-shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-clay-blue-200"
          />
          <ZoomIn className="w-4 h-4 text-clay-faint flex-shrink-0" />
        </div>
      </ClayModal>
    </>
  )
}

function SecurityTab({ toast }) {
  const [form, setForm] = useState({
    original_password: '',
    password: '',
    confirmPassword: '',
  })
  const [saving, setSaving] = useState(false)

  const onSave = async (e) => {
    e.preventDefault()
    if (!form.password) {
      toast('请输入新密码', 'error')
      return
    }
    if (form.password.length < 8) {
      toast('新密码至少 8 个字符', 'error')
      return
    }
    if (form.password !== form.confirmPassword) {
      toast('两次输入的新密码不一致', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await updateSelf({
        original_password: form.original_password,
        password: form.password,
      })
      if (res?.success) {
        toast('密码已更新', 'success')
        setForm({ original_password: '', password: '', confirmPassword: '' })
      } else {
        toast(res?.message ?? '修改失败', 'error')
      }
    } catch (err) {
      toast(err?.response?.data?.message ?? err.message ?? '修改失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ClayCard className="max-w-2xl">
      <div className="flex items-center gap-2 mb-5">
        <KeyRound className="w-5 h-5 text-clay-blue-300" />
        <h2 className="text-xl font-black">修改密码</h2>
      </div>
      <form onSubmit={onSave}>
        <ClayField
          label="当前密码"
          type="password"
          value={form.original_password}
          onChange={(e) => setForm({ ...form, original_password: e.target.value })}
          placeholder="如果从未设置过密码可留空"
        />
        <ClayField
          label="新密码"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="至少 8 个字符"
        />
        <ClayField
          label="确认新密码"
          type="password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          placeholder="再次输入新密码"
        />
        <ClayButton variant="primary" type="submit" disabled={saving} className="mt-2">
          {saving ? '保存中…' : (<><Save className="w-4 h-4" /> 修改密码</>)}
        </ClayButton>
      </form>
    </ClayCard>
  )
}

function NotificationsTab({ user, setUser, toast }) {
  const setting = user?.setting ? safeJSON(user.setting) : {}
  const [form, setForm] = useState({
    notify_email: !!setting.notify_email,
    notify_webhook: !!setting.notify_webhook,
    webhook_url: setting.webhook_url ?? '',
  })
  const [saving, setSaving] = useState(false)

  const onSave = async () => {
    setSaving(true)
    try {
      const res = await updateSetting(form)
      if (res?.success) {
        toast('通知偏好已更新', 'success')
        const r = await apiSelf()
        if (r?.data) setUser(r.data)
      } else {
        toast(res?.message ?? '保存失败', 'error')
      }
    } catch (err) {
      toast(err?.response?.data?.message ?? err.message ?? '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ClayCard>
      <h2 className="text-xl font-black mb-5">通知偏好</h2>

      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-bold">邮箱通知</div>
            <div className="text-sm text-clay-faint">余额、异常用量等重要事件通过邮件通知</div>
          </div>
          <ClayToggle
            checked={form.notify_email}
            onChange={(v) => setForm({ ...form, notify_email: v })}
          />
        </div>

        <div className="h-px bg-black/5" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-bold">Webhook 通知</div>
            <div className="text-sm text-clay-faint">把事件推送到你指定的 URL</div>
          </div>
          <ClayToggle
            checked={form.notify_webhook}
            onChange={(v) => setForm({ ...form, notify_webhook: v })}
          />
        </div>

        {form.notify_webhook && (
          <ClayField
            label="Webhook URL"
            value={form.webhook_url}
            onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
            placeholder="https://your.webhook/path"
          />
        )}
      </div>

      <div className="mt-6">
        <ClayButton variant="primary" onClick={onSave} disabled={saving}>
          {saving ? '保存中…' : (<><Save className="w-4 h-4" /> 保存</>)}
        </ClayButton>
      </div>
    </ClayCard>
  )
}

function PreferencesTab({ user, setUser, toast }) {
  const { mode, resolvedTheme, setMode } = useTheme()
  const setting = user?.setting ? safeJSON(user.setting) : {}
  const [form, setForm] = useState({
    language: setting.language ?? 'zh-CN',
    theme: mode,
  })
  const [saving, setSaving] = useState(false)

  const onSave = async () => {
    setSaving(true)
    try {
      const res = await updateSetting({ ...form, theme: mode })
      if (res?.success) {
        toast('偏好已保存', 'success')
        const r = await apiSelf()
        if (r?.data) setUser(r.data)
      } else {
        toast(res?.message ?? '保存失败', 'error')
      }
    } catch (err) {
      toast(err?.response?.data?.message ?? err.message ?? '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ClayCard className="max-w-2xl">
      <h2 className="text-xl font-black mb-5">偏好设置</h2>

      <div className="space-y-5">
        <div>
          <label className="block ml-4 mb-2 font-bold text-sm">界面语言</label>
          <ClaySelect
            value={form.language}
            onChange={(v) => setForm({ ...form, language: v })}
            options={[
              { value: 'zh-CN', label: '简体中文' },
              { value: 'zh-TW', label: '繁體中文' },
              { value: 'en', label: 'English' },
              { value: 'ja', label: '日本語' },
              { value: 'fr', label: 'Français' },
              { value: 'ru', label: 'Русский' },
              { value: 'vi', label: 'Tiếng Việt' },
            ]}
          />
        </div>

        <div>
          <label className="block ml-4 mb-2 font-bold text-sm">主题</label>
          <ClaySelect
            value={mode}
            onChange={(v) => {
              setMode(v)
              setForm({ ...form, theme: v })
            }}
            options={[
              { value: 'system', label: '跟随系统', subtitle: '按设备外观自动切换' },
              { value: 'light', label: '浅色黏土', subtitle: '明亮马卡龙色' },
              { value: 'dark', label: 'Moon Clay 夜间黏土', subtitle: '暗灰蓝泥面与柔和高光' },
            ]}
          />
          <p className="text-xs text-clay-faint ml-4 mt-2">
            当前生效：{resolvedTheme === 'dark' ? 'Moon Clay 夜间黏土' : '浅色黏土'}。
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ClayButton variant="primary" onClick={onSave} disabled={saving}>
          {saving ? '保存中…' : (<><Save className="w-4 h-4" /> 保存</>)}
        </ClayButton>
      </div>
    </ClayCard>
  )
}

function safeJSON(str) {
  try {
    return JSON.parse(str ?? '{}')
  } catch (_) {
    return {}
  }
}
