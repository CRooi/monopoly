import { useEffect, useState } from 'react'
import type { GameView, Ownership } from '@shared/types'
import { sfx } from '@/lib/sound'

/** 小故事每句停多久 */
export const STORY_LINE_MS = 1500
/** 揭晓后结果卡停多久 */
export const STORY_REVEAL_MS = 2600

type Event = NonNullable<GameView['event']>

export interface EventStory {
  event: Event
  /** 播到第几句；等于句数时是揭晓 */
  step: number
}

interface Hold {
  id: number
  cash: Record<string, number>
  owners: Record<number, Ownership>
  logId: number
}

/**
 * 全城事件的揭晓：服务端翻事件时红包、交税、拆房已经生效了，
 * 这里先一句一句播小故事，期间显示事件之前的现金、房子和记录，揭晓时再一起显示。
 * 进页面时已经翻过的事件不再播。
 */
export function useEventReveal<G extends GameView | null>(g: G, enabled = true): { game: G; story: EventStory | null } {
  const [prev, setPrev] = useState(g)
  const [hold, setHold] = useState<Hold | null>(null)
  const [step, setStep] = useState(0)

  if (g !== prev) {
    if (enabled && g && prev && g.event && g.event.id !== prev.event?.id && prev.id === g.id) {
      setHold({
        id: g.event.id,
        cash: Object.fromEntries(prev.players.map((p) => [p.id, p.cash])),
        owners: prev.owners,
        logId: prev.log.at(-1)?.id ?? 0,
      })
      setStep(0)
    }
    setPrev(g)
  }

  const holdId = hold?.id
  const lines = g?.event?.story?.length ?? 0
  useEffect(() => {
    if (holdId === undefined) return
    const timers: ReturnType<typeof setTimeout>[] = []
    sfx.tap()
    for (let i = 1; i <= lines; i++) {
      timers.push(
        setTimeout(() => {
          setStep(i)
          if (i === lines) sfx.reveal()
          else sfx.tap()
        }, i * STORY_LINE_MS),
      )
    }
    timers.push(setTimeout(() => setHold(null), lines * STORY_LINE_MS + STORY_REVEAL_MS))
    return () => timers.forEach(clearTimeout)
    // 只在新的事件出现时开始播
  }, [holdId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!hold || !g || !g.event) return { game: g, story: null }
  const revealed = step >= lines
  return {
    game: revealed
      ? g
      : ({
          ...g,
          players: g.players.map((p) => ({ ...p, cash: hold.cash[p.id] ?? p.cash })),
          owners: hold.owners,
          log: g.log.filter((l) => l.id <= hold.logId),
          // 回合面板顶上的事件提示条也等揭晓
          event: null,
        } as G),
    story: { event: g.event, step },
  }
}
