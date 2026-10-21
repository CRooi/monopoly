import { useState, type ReactNode } from 'react'
import type { StateView } from '@shared/types'
import { useSpiceReveal } from '@/hooks/useSpiceReveal'
import { cn } from '@/lib/utils'
import { Board } from './Board'
import { LogPanel, PlayersPanel } from './Panels'
import { TileDialog } from './TileDialog'
import { TurnPanel } from './TurnPanel'

const noop = () => {}

/** 只读的对局画面：大屏、后台实时观看和回放共用；extraTab 为右侧额外的标签页（如回放时间轴） */
export function WatchView({
  state: live,
  extraTab,
  className,
  live: isLive,
}: {
  state: StateView
  extraTab?: { label: string; content: ReactNode }
  className?: string
  /** 实时画面，播放音效；回放时静音 */
  live?: boolean
}) {
  // 实时画面里重庆火锅辣度跳动期间先不揭晓扣钱；回放直接显示
  const reveal = useSpiceReveal(live.game, !!isLive)
  const state = { ...live, game: reveal.game }
  const g = state.game
  const [tab, setTab] = useState<'players' | 'log' | 'extra'>(extraTab ? 'extra' : 'players')
  const [tile, setTile] = useState<number | null>(null)
  if (!g) return <div className="py-20 text-center font-display text-paper">还没有开始对局</div>
  const tabs = [
    ...(extraTab ? [['extra', extraTab.label] as const] : []),
    ['players', '玩家'] as const,
    ['log', '记录'] as const,
  ]
  return (
    <div className={cn('flex h-full min-h-0 flex-col gap-4 lg:flex-row', className)}>
      <div className="mx-auto aspect-square h-auto w-full max-w-[min(100%,calc(100dvh-8rem))] shrink-0 lg:mx-0 lg:h-full lg:w-auto lg:max-w-[calc(100%-22rem)]">
        <Board game={g} onTileClick={setTile} quiet={!isLive}>
          <TurnPanel state={state} spin={reveal.spin} spinStage={reveal.stage} send={noop} confirm={noop} onAssets={noop} />
        </Board>
      </div>
      <aside className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex gap-1 rounded-xl bg-black/20 p-1">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn('flex-1 rounded-lg py-1.5 font-display text-sm transition', tab === k ? 'bg-paper text-ink shadow-sm' : 'text-paper/80 hover:bg-white/10')}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {tab === 'players' && <PlayersPanel state={state} />}
          {tab === 'log' && <LogPanel game={g} />}
          {tab === 'extra' && extraTab?.content}
        </div>
      </aside>
      <TileDialog game={g} tile={tile} send={noop} onClose={() => setTile(null)} />
    </div>
  )
}
