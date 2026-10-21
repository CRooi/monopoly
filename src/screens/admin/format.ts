import type { ReplayGameInfo } from '@shared/types'

export const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('zh-CN', { hour12: false })
export const fmtDateTime = (ts: number) =>
  new Date(ts).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

export const gameStatus = (g: Pick<ReplayGameInfo, 'status' | 'winner'>): [string, string] =>
  g.status === 'playing'
    ? ['进行中', 'bg-[#d3f0dc] text-[#17703c]']
    : g.status === 'aborted'
      ? ['已终止', 'bg-ink/10 text-ink/60']
      : [`${g.winner ?? '?'} 获胜`, 'bg-gold/40 text-ink']

export const duration = (g: Pick<ReplayGameInfo, 'startedAt' | 'endedAt'>) =>
  g.endedAt ? `用时 ${Math.max(1, Math.round((g.endedAt - g.startedAt) / 60000))} 分钟` : '进行中'
