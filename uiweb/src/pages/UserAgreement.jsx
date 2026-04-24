import { ScrollText } from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayPageShell from '../components/layout/ClayPageShell.jsx'
import { useStatus } from '../context/StatusContext.jsx'

export default function UserAgreement() {
  const { status } = useStatus()
  const html = typeof status?.user_agreement === 'string' ? status.user_agreement : null

  return (
    <ClayPageShell>
      <section className="max-w-3xl mx-auto">
        <div className="clay-icon-box !w-16 !h-16 mx-auto mb-6 text-clay-purple-200">
          <ScrollText className="w-7 h-7" strokeWidth={2.5} />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-center mb-4 tracking-tight">
          用户协议
        </h1>

        <ClayCard>
          {html ? (
            <div
              className="prose prose-lg max-w-none text-clay-ink leading-relaxed"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <div className="space-y-4 text-clay-ink leading-relaxed">
              <h2 className="text-xl font-extrabold">1. 服务说明</h2>
              <p>
                New API 是一个 AI API 聚合服务。使用本服务前,请仔细阅读并同意本协议的全部条款。
              </p>
              <h2 className="text-xl font-extrabold mt-4">2. 账号与安全</h2>
              <p>
                请妥善保管您的账号及 API Key,由账号泄露造成的损失由账号持有人自行承担。
              </p>
              <h2 className="text-xl font-extrabold mt-4">3. 使用规范</h2>
              <p>
                禁止使用本服务进行任何违反法律法规、侵害他人合法权益的行为。一经发现,
                服务方有权立即封禁账号。
              </p>
              <p className="text-clay-faint text-sm mt-8">
                管理员可以在 系统设置 → 仪表盘 → 公告 中定制完整的用户协议内容。
              </p>
            </div>
          )}
        </ClayCard>
      </section>
    </ClayPageShell>
  )
}
