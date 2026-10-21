import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { GROUP_COLOR } from '@shared/types'
import { Die, Logo } from '@/components/art/icons'
import { clearUpgradedParam, justUpgraded } from '@/lib/upgrade'

/** 更新后刷新回来时，提示至少展示这么久，避免一闪而过 */
const MIN_MS = 1000
/** 最多展示这么久，迟迟连不上时交给普通的重连提示 */
const MAX_MS = 3000

/** 刷新回来的提示只处理一次；计时从页面加载算起，组件换位置重新挂载也不会重新计时 */
let handled = false
const pageStart = Date.now()

const STEPS = ['正在重新洗牌', '正在清点银行金库', '正在摆回各位的棋子', '正在恢复对局进度']

/**
 * 「系统更新中」全屏提示：
 * - upgrading：后端通知即将重启，断线期间显示；
 * - 后端更新后页面自动刷新回来时显示 1～3 秒，等 ready（收到房间状态）后回到游戏。
 */
export function SystemUpdating({ upgrading, ready }: { upgrading: boolean; ready: boolean }) {
  const [returning, setReturning] = useState(() => justUpgraded && !handled)

  useEffect(() => {
    if (!returning) return
    const finish = () => {
      handled = true
      setReturning(false)
      clearUpgradedParam()
      toast.success('系统更新完成')
    }
    const elapsed = Date.now() - pageStart
    const t = setTimeout(finish, Math.max(0, (ready ? MIN_MS : MAX_MS) - elapsed))
    return () => clearTimeout(t)
  }, [returning, ready])

  if (!upgrading && !returning) return null
  return <UpdatingScreen />
}

const RING = Object.values(GROUP_COLOR)

function UpdatingScreen() {
  const [step, setStep] = useState(0)
  const [faces, setFaces] = useState([3, 5])
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 700)
    const d = setInterval(() => setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]), 450)
    return () => {
      clearInterval(t)
      clearInterval(d)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 overflow-hidden bg-felt-deep px-6 text-center animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgb(0_0_0/0.06)_0_2px,transparent_2px_7px)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgb(242_183_5/0.22),transparent_55%)]" />

      {/* 一圈色块组成的棋盘边 + 中间的标志 */}
      <div className="relative flex size-64 items-center justify-center">
        <div className="animate-halo absolute inset-8 rounded-full bg-[radial-gradient(circle,rgb(255_224_102/0.45),transparent_70%)] blur-md" />
        <svg viewBox="0 0 200 200" className="animate-orbit absolute inset-0 size-full">
          {Array.from({ length: 24 }, (_, i) => (
            <g key={i} transform={`rotate(${i * 15} 100 100)`}>
              <rect x="93" y="2" width="14" height="20" rx="2.5" fill="#fbf5e6" stroke="#2b2118" strokeWidth="1.5" />
              <rect x="93" y="2" width="14" height="6" rx="2" fill={RING[i % RING.length]} stroke="#2b2118" strokeWidth="1.5" />
            </g>
          ))}
        </svg>
        <svg viewBox="0 0 200 200" className="animate-orbit-rev absolute inset-9 size-[calc(100%-4.5rem)] text-gold/70">
          <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="30 12 4 12" />
        </svg>
        <div className="relative flex size-32 items-center justify-center rounded-full border-[3px] border-ink bg-paper shadow-[0_5px_0_#2b2118]">
          <Logo className="animate-float size-20" />
        </div>
        <Die value={faces[0]!} className="absolute -bottom-2 left-6 size-11 -rotate-12 drop-shadow-lg" />
        <Die value={faces[1]!} className="absolute -bottom-4 right-8 size-11 rotate-[18deg] drop-shadow-lg" />
      </div>

      <div className="relative space-y-3">
        <div className="text-title font-display text-4xl tracking-[0.3em] sm:text-5xl">系统更新中</div>
        <div key={step} className="animate-rise h-5 text-sm tracking-widest text-paper/85">
          {STEPS[step]}…
        </div>
      </div>

      {/* 进度扫光 */}
      <div className="relative h-2 w-64 max-w-full overflow-hidden rounded-full border-2 border-ink bg-black/30">
        <div className="animate-scan absolute inset-y-0 w-2/5 rounded-full bg-[linear-gradient(90deg,transparent,#ffe066,#f2b705,transparent)]" />
      </div>

      <p className="relative text-xs text-paper/70">请稍候，马上回到游戏，对局进度会自动保留</p>
    </div>
  )
}
