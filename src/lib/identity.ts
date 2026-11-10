import { useEffect, useState } from 'react'
import { SLOT } from './session'

/**
 * 名字统一在游戏大厅取，各游戏带着大厅的 cookie 去 /api/me 拿。
 * 线上固定是 game.yowot.cn；本地开发配 VITE_LOBBY_URL 才接入；?slot=N 多开调试时不接入，各槽位自己填名字。
 */
const LOBBY: string =
  SLOT !== null ? '' : (import.meta.env.VITE_LOBBY_URL ?? (location.hostname.endsWith('yowot.cn') ? 'https://game.yowot.cn' : ''))

export interface Identity {
  id: string
  name: string
  emoji: string
  color: string
}

/** 去大厅取名字或改名字，完了回到当前页面 */
export const lobbyNameUrl = () => `${LOBBY}/?name&back=${encodeURIComponent(location.href)}`

/**
 * 大厅里的身份。loading 还在取；null 没接入大厅或大厅连不上，用自己填的名字。
 * 大厅说还没取过名字时直接跳去大厅取名。
 */
export function useIdentity(): Identity | null | 'loading' {
  const [state, setState] = useState<Identity | null | 'loading'>(LOBBY ? 'loading' : null)
  useEffect(() => {
    if (!LOBBY) return
    let alive = true
    fetch(`${LOBBY}/api/me`, { credentials: 'include', signal: AbortSignal.timeout(4000) })
      .then((r) => (r.ok ? (r.json() as Promise<{ player: Identity | null }>) : Promise.reject(r.status)))
      .then(({ player }) => {
        if (!player) return location.replace(lobbyNameUrl())
        if (alive) setState(player)
      })
      .catch(() => alive && setState(null))
    return () => {
      alive = false
    }
  }, [])
  return state
}
