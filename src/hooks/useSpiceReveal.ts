import { useEffect, useState } from 'react'
import { SPICE_LEVELS, type GameView } from '@shared/types'
import { sfx } from '@/lib/sound'

/** 辣度像转盘：先快转两圈，越转越慢，最后几下一顿一顿地停在摇出的那档（约 3～4 秒） */
const SPIN_LAPS = 2
const SPIN_FAST_MS = 40
const SPIN_SLOW_MS = 600
/** 停住以后先不报倍数，心跳两下再揭晓 */
const PAUSE_MS = 1300

export type SpiceStage = 'spin' | 'pause'

interface Hold {
  id: number
  /** 摇辣度之前每个人的现金 */
  cash: Record<string, number>
  /** 摇辣度之前的最后一条记录 */
  logId: number
  /** 摇辣度之前已经揭晓过的彩蛋；第一次揭晓时，格子上的提示等动画放完再换 */
  seen: number[]
}

/**
 * 重庆火锅的揭晓：服务端摇出辣度时租金已经扣了，
 * 这里在转辣度、停顿的这段时间先显示扣钱之前的现金和记录、不出操作按钮，揭晓后再一起显示。
 * spin 为当前停在哪一档，stage 为 null 表示已经揭晓（或没有在摇辣度）。
 */
export function useSpiceReveal<G extends GameView | null>(
  g: G,
  enabled = true,
): { game: G; spin: number | null; stage: SpiceStage | null } {
  const [prev, setPrev] = useState(g)
  const [hold, setHold] = useState<Hold | null>(null)
  const [spin, setSpin] = useState<number | null>(null)
  const [stage, setStage] = useState<SpiceStage | null>(null)

  // 在渲染时比较上一局面，新的辣度一出现就压住，避免先闪一下扣钱
  if (g !== prev) {
    if (enabled && g && prev && g.spice && g.spice.id !== prev.spice?.id && prev.id === g.id) {
      setHold({
        id: g.spice.id,
        cash: Object.fromEntries(prev.players.map((p) => [p.id, p.cash])),
        logId: prev.log.at(-1)?.id ?? 0,
        seen: prev.eggsSeen,
      })
      setSpin(0)
      setStage('spin')
    }
    setPrev(g)
  }

  const holdId = hold?.id
  const target = Math.max(0, SPICE_LEVELS.findIndex((s) => s.level === g?.spice?.level))
  useEffect(() => {
    if (holdId === undefined) return
    const frames = SPIN_LAPS * SPICE_LEVELS.length + target
    let i = 0
    let timer: ReturnType<typeof setTimeout>
    const reveal = () => {
      sfx.reveal()
      setStage(null)
      setSpin(null)
      setHold(null)
    }
    const next = () => {
      i++
      if (i > frames) {
        // 停住了：先心跳两下，再揭晓倍数
        setStage('pause')
        sfx.heartbeat()
        timer = setTimeout(() => {
          sfx.heartbeat()
          timer = setTimeout(reveal, PAUSE_MS / 2)
        }, PAUSE_MS / 2)
        return
      }
      sfx.tap()
      setSpin(i % SPICE_LEVELS.length)
      // 越往后越慢，最后几下一顿一顿的
      const k = i / frames
      timer = setTimeout(next, SPIN_FAST_MS + (SPIN_SLOW_MS - SPIN_FAST_MS) * k ** 4)
    }
    timer = setTimeout(next, SPIN_FAST_MS)
    return () => clearTimeout(timer)
    // 只在新的辣度出现时开始转
  }, [holdId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!hold || !g) return { game: g, spin: null, stage: null }
  return {
    game: {
      ...g,
      players: g.players.map((p) => ({ ...p, cash: hold.cash[p.id] ?? p.cash })),
      log: g.log.filter((l) => l.id <= hold.logId),
      eggsSeen: hold.seen,
      // 付不起进了欠款，也等揭晓之后再显示
      debt: null,
      phase: g.phase === 'debt' ? 'end' : g.phase,
    } as G,
    spin,
    stage,
  }
}
