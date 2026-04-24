import { Shield } from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayPageShell from '../components/layout/ClayPageShell.jsx'
import { useStatus } from '../context/StatusContext.jsx'

export default function PrivacyPolicy() {
  const { status } = useStatus()
  const html = typeof status?.privacy_policy === 'string' ? status.privacy_policy : null

  return (
    <ClayPageShell>
      <section className="max-w-3xl mx-auto">
        <div className="clay-icon-box !w-16 !h-16 mx-auto mb-6 text-clay-green-200">
          <Shield className="w-7 h-7" strokeWidth={2.5} />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-center mb-4 tracking-tight">
          隐私政策
        </h1>

        <ClayCard>
          {html ? (
            <div
              className="prose prose-lg max-w-none text-clay-ink leading-relaxed"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <div className="space-y-4 text-clay-ink leading-relaxed">
              <h2 className="text-xl font-extrabold">1. 数据收集</h2>
              <p>
                为了向您提供服务,我们会收集账号信息、用量日志、调用记录等必要数据,
                用于计费、审计与问题排查。
              </p>
              <h2 className="text-xl font-extrabold mt-4">2. 数据存储</h2>
              <p>
                您的敏感凭据(如 API Key)以加密方式存储。请求载荷默认不留存,
                除非管理员显式开启了日志记录。
              </p>
              <h2 className="text-xl font-extrabold mt-4">3. 第三方共享</h2>
              <p>
                您的请求会被转发到您选择的上游 AI 提供商。这些提供商的数据处理规则
                由其自身的隐私政策约束。
              </p>
              <h2 className="text-xl font-extrabold mt-4">4. 数据删除</h2>
              <p>
                您可以随时联系管理员注销账号,届时将清除与您账号相关的所有可删除数据。
              </p>
              <p className="text-clay-faint text-sm mt-8">
                管理员可以在 系统设置 → 仪表盘 → 公告 中定制完整的隐私政策内容。
              </p>
            </div>
          )}
        </ClayCard>
      </section>
    </ClayPageShell>
  )
}
