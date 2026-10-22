import { useEffect, useRef, useState } from 'react'
import type { Emote, GameView } from '@shared/types'
import { sfx } from '@/lib/sound'

/** 表情气泡停留多久 */
const SHOW_MS = 2800

/** 每个人当前头上飘着的表情；刚进页面时已有的旧表情不再弹 */
export function useEmotes(game: GameView | null) {
  const [shown, setShown] = useState<Record<string, Emote>>({})
  const seen = useRef(game?.emotes.at(-1)?.id ?? 0)
  const emotes = game?.emotes
  useEffect(() => {
    if (!emotes) return
    const fresh = emotes.filter((e) => e.id > seen.current)
    if (!fresh.length) return
    seen.current = fresh.at(-1)!.id
    sfx.tap()
    // 下一条表情来了也不能取消上一条的收起，否则气泡会一直挂着，所以这里不做清理
    for (const e of fresh) {
      setTimeout(() => setShown((cur) => ({ ...cur, [e.from]: e })), 0)
      setTimeout(() => setShown((cur) => (cur[e.from]?.id === e.id ? Object.fromEntries(Object.entries(cur).filter(([k]) => k !== e.from)) : cur)), SHOW_MS)
    }
  }, [emotes])
  return shown
}
