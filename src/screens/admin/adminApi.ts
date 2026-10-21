import type { ReplayEvent, ReplayGameInfo } from '@shared/types'
import { loadAdminToken } from './token'

export class AuthError extends Error {}

/** 带管理员令牌的请求；令牌失效时抛出 AuthError */
export async function adminApi<T>(path: string, body?: unknown): Promise<T> {
  const token = loadAdminToken()
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) throw new AuthError(data.error ?? '请重新登录')
  if (!res.ok) throw new Error(data.error ?? '网络错误')
  return data as T
}

export interface AdminRoom {
  code: string
  host: string
  players: number
  online: number
  spectators: number
  inGame: boolean
  round: number | null
  gameId: string | null
  createdAt: number
  lastActiveAt: number
  idleTimeoutMs: number
}

export interface AdminGame extends ReplayGameInfo {
  events: number
  host: string
  players: string[]
}

/** 时间轴事件 */
export type GameEvent = ReplayEvent

/** 下载整局回放文件（.mfreplay） */
export async function downloadReplay(id: string) {
  const token = loadAdminToken()
  const res = await fetch(`/api/admin/games/${id}/export`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (res.status === 401) throw new AuthError('请重新登录')
  if (!res.ok) throw new Error('下载失败')
  const cd = res.headers.get('Content-Disposition') ?? ''
  const name = decodeURIComponent(/filename\*=UTF-8''([^;]+)/.exec(cd)?.[1] ?? `monopoly-${id}.mfreplay`)
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
