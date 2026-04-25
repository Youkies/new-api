import { useEffect, useState } from 'react'
import { Info, BookHeart, Users, MessageCircle } from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayPageShell from '../components/layout/ClayPageShell.jsx'
import { useStatus } from '../context/StatusContext.jsx'

export default function About() {
  const { status } = useStatus()
  const [content, setContent] = useState(null)

  useEffect(() => {
    const about = status?.about
    if (about && typeof about === 'string') setContent(about)
  }, [status])

  return (
    <ClayPageShell>
      <section className="max-w-3xl mx-auto">
        <div className="clay-icon-box !w-16 !h-16 mx-auto mb-6 text-clay-blue-200">
          <Info className="w-7 h-7" strokeWidth={2.5} />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-center mb-4 tracking-tight">
          关于 Youkies API
        </h1>
        <p className="text-center text-clay-faint mb-10 text-lg">
          一个温柔的 AI API 网关。把多个上游模型统一到同一个亲切的界面。
        </p>

        <ClayCard>
          {content ? (
            <div
              className="prose prose-lg max-w-none text-clay-ink"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <div className="space-y-4 text-clay-ink leading-relaxed">
              <p>
                <strong>Youkies API</strong> 是由 <strong>QuantumNous</strong> 维护的开源 AI API
                聚合网关,支持 OpenAI、Claude、Gemini、Bedrock、Azure 等 40+
                上游厂商,在统一协议下提供 API Key 分发、分层计费、用量追踪、渠道分流等能力。
              </p>
              <p>
                这里是 <strong>Clay Edition</strong> —— 由 <strong>Youkies</strong> 适配，黏土风格的用户端,让每次登录都能感受到柔软。
              </p>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-4 mt-10">
            <a
              href="https://xhslink.com/m/2PS41Q0qrIw"
              target="_blank"
              rel="noreferrer"
              className="clay-card !p-5 !rounded-clay-lg hover:-translate-y-1 transition-transform flex items-center gap-3"
            >
              <BookHeart className="w-5 h-5" />
              <span className="font-extrabold">小红书</span>
            </a>
            <a
              href="https://qm.qq.com/q/LZrPnE1uge"
              target="_blank"
              rel="noreferrer"
              className="clay-card !p-5 !rounded-clay-lg hover:-translate-y-1 transition-transform flex items-center gap-3"
            >
              <Users className="w-5 h-5" />
              <span className="font-extrabold">QQ 交流群</span>
            </a>
            <a
              href="https://qm.qq.com/q/m5jzN2Ta2m"
              target="_blank"
              rel="noreferrer"
              className="clay-card !p-5 !rounded-clay-lg hover:-translate-y-1 transition-transform flex items-center gap-3"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="font-extrabold">站长 QQ</span>
            </a>
          </div>
        </ClayCard>
      </section>
    </ClayPageShell>
  )
}
