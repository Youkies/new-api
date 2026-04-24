import { Link } from 'react-router-dom'
import { ArrowRight, Cloud, Layers, Smile } from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayPageShell from '../components/layout/ClayPageShell.jsx'
import { useUser } from '../context/UserContext.jsx'

export default function Home() {
  const { user } = useUser()

  return (
    <ClayPageShell>
      {/* Hero */}
      <section className="grid md:grid-cols-2 gap-12 md:gap-16 items-center min-h-[60vh]">
        <div>
          <span className="clay-badge mb-6">AI Gateway · Clay Edition</span>
          <h1 className="text-5xl md:text-6xl font-black leading-tight mb-5 tracking-tight">
            柔软、圆润、
            <br />
            <span className="text-clay-blue-200">可触摸。</span>
          </h1>
          <p className="text-clay-faint text-lg leading-relaxed mb-7 max-w-lg">
            把 40+ AI 提供商聚合到同一个体验统一的接入点。Claymorphism 让数字工具也有触感。
          </p>
          <div className="flex flex-wrap gap-4 items-center">
            {user ? (
              <Link to="/dashboard">
                <ClayButton variant="secondary">
                  进入控制台 <ArrowRight className="w-4 h-4" />
                </ClayButton>
              </Link>
            ) : (
              <Link to="/register">
                <ClayButton variant="secondary">
                  立即开始 <ArrowRight className="w-4 h-4" />
                </ClayButton>
              </Link>
            )}
            <Link to="/pricing">
              <ClayButton variant="ghost">查看价格</ClayButton>
            </Link>
          </div>
        </div>

        {/* Floating blobs */}
        <div className="relative h-[360px] md:h-[400px] flex items-center justify-center">
          <div className="absolute w-56 h-56 md:w-64 md:h-64 bg-clay-blue-100 shadow-clay animate-float z-20" />
          <div
            className="absolute w-40 h-40 md:w-44 md:h-44 bg-clay-pink-100 shadow-clay animate-float z-10"
            style={{ top: '20px', right: '40px', animationDelay: '1s' }}
          />
          <div
            className="absolute w-24 h-24 md:w-28 md:h-28 bg-clay-green-100 shadow-clay animate-float z-30"
            style={{ bottom: '30px', left: '40px', animationDelay: '2s' }}
          />
        </div>
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-8 my-16">
        <ClayCard interactive>
          <div className="clay-icon-box mb-5 text-clay-blue-200">
            <Cloud className="w-6 h-6" strokeWidth={2.5} />
          </div>
          <h3 className="text-2xl font-extrabold mb-3">多厂商聚合</h3>
          <p className="text-clay-faint">
            OpenAI、Claude、Gemini、Bedrock 等 40+ 厂商统一 API,按需切换。
          </p>
        </ClayCard>

        <ClayCard interactive>
          <div className="clay-icon-box mb-5 text-clay-pink-200">
            <Layers className="w-6 h-6" strokeWidth={2.5} />
          </div>
          <h3 className="text-2xl font-extrabold mb-3">分层计费</h3>
          <p className="text-clay-faint">
            精细到每一次调用的计费、额度、分层规则,开箱即用。
          </p>
        </ClayCard>

        <ClayCard interactive>
          <div className="clay-icon-box mb-5 text-clay-green-200">
            <Smile className="w-6 h-6" strokeWidth={2.5} />
          </div>
          <h3 className="text-2xl font-extrabold mb-3">亲切体验</h3>
          <p className="text-clay-faint">
            后台工具也能温柔。用户页面告别冰冷的企业感。
          </p>
        </ClayCard>
      </section>
    </ClayPageShell>
  )
}
