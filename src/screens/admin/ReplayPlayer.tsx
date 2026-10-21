import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import type { ReplayEvent, ReplayGameInfo, StateView } from '@shared/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { WatchView } from '../game/WatchView'
import { duration, fmtDateTime, fmtTime, gameStatus } from './format'

const SPEEDS = [1, 2, 4, 8, 16]
/** 播放时刷新时钟的间隔 */
const TICK_MS = 100

/** 时长显示：m:ss，超过一小时为 h:mm:ss */
function clockText(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** 时钟走到 clock 时，最后一个已经发生的事件 */
function eventAt(offsets: number[], clock: number) {
  let lo = 0
  let hi = offsets.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (offsets[mid]! <= clock) lo = mid
    else hi = mid - 1
  }
  return lo
}

/**
 * 对局回放播放器：按真实时间播放，1× 时事件之间的间隔与当时完全一致。
 * 数据来源可替换：后台按需从服务端加载，本地查看器从文件中读取。
 */
export function ReplayPlayer({
  game,
  events,
  loadView,
  onError,
  actions,
}: {
  game: ReplayGameInfo
  events: ReplayEvent[]
  /** 取某个事件时刻的上帝视角 */
  loadView: (seq: number) => Promise<StateView>
  onError?: (e: unknown) => void
  /** 标题栏右侧的额外按钮（如下载） */
  actions?: ReactNode
}) {
  // 时间轴从第一个事件开始，到最后一个事件结束；clock 是距第一个事件的毫秒数
  const t0 = events[0]?.ts ?? game.startedAt
  const offsets = useMemo(() => events.map((e) => e.ts - t0), [events, t0])
  const total = offsets.at(-1) ?? 0

  const [clock, setClock] = useState(0)
  const [views, setViews] = useState<Record<number, StateView>>({})
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const listRef = useRef<HTMLDivElement>(null)
  const index = events.length ? eventAt(offsets, clock) : 0
  const current = events[index]
  const atEnd = clock >= total

  const seek = (ms: number) => setClock(Math.min(total, Math.max(0, ms)))
  const jump = (i: number) => {
    const j = Math.min(events.length - 1, Math.max(0, i))
    setClock(offsets[j] ?? 0)
  }

  // 按需加载当前时刻的局面，并预取下一个
  useEffect(() => {
    if (!current) return
    for (const ev of [current, events[index + 1]]) {
      if (!ev || views[ev.seq]) continue
      loadView(ev.seq).then((v) => setViews((m) => ({ ...m, [ev.seq]: v })), onError)
    }
  }, [current, events, index, views, loadView, onError])

  // 播放：时钟按真实流逝的时间 × 倍速前进，走到结尾自然停止
  const isPlaying = playing && !atEnd
  useEffect(() => {
    if (!isPlaying) return
    let last = performance.now()
    const t = setInterval(() => {
      const now = performance.now()
      const dt = (now - last) * speed
      last = now
      setClock((c) => Math.min(total, c + dt))
    }, TICK_MS)
    return () => clearInterval(t)
  }, [isPlaying, speed, total])

  // 当前事件滚动到可视区域
  useEffect(() => {
    listRef.current?.querySelector(`[data-seq="${current?.seq}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [current?.seq])

  // ← → 跳到上一个 / 下一个事件，空格播放 / 暂停
  useEffect(() => {
    const go = (i: number) => setClock(offsets[Math.min(offsets.length - 1, Math.max(0, i))] ?? 0)
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return
      // 进度条获得焦点时也按事件跳转，不让它自己挪 100ms
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        go(index + (e.key === 'ArrowLeft' ? -1 : 1))
      } else if (e.key === ' ') {
        e.preventDefault()
        setPlaying((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, offsets])

  // 无快照时显示最近一次已加载的局面，避免闪烁
  const view = (() => {
    for (let i = index; i >= 0; i--) {
      const v = views[events[i]?.seq ?? -1]
      if (v) return v
    }
    return null
  })()

  // 时钟每 100ms 刷新一次，局面只在切换事件时重新渲染
  const board = useMemo(() => {
    if (!view) return <div className="py-20 text-center text-paper">加载局面…</div>
    const timeline = (
      <div ref={listRef} className="space-y-1">
        {events.map((ev, i) => (
          <button
            key={ev.seq}
            data-seq={ev.seq}
            onClick={() => {
              setClock(offsets[i]!)
              setPlaying(false)
            }}
            className={cn(
              'flex w-full gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition',
              i === index ? 'bg-[#fff3c4] ring-2 ring-gold' : i < index ? 'bg-paper' : 'bg-paper/60 text-ink/60 hover:bg-paper',
            )}
          >
            <span className="shrink-0 font-mono text-ink/50">+{clockText(offsets[i]!)}</span>
            <span className="shrink-0 font-medium">{ev.actor}</span>
            <span className="min-w-0 flex-1 break-words">{ev.text}</span>
          </button>
        ))}
      </div>
    )
    return <WatchView state={view} extraTab={{ label: '时间轴', content: timeline }} />
  }, [view, events, offsets, index])

  if (!events.length) return <div className="py-20 text-center text-paper">这局没有记录到事件</div>

  const [statusLabel, statusCls] = gameStatus(game)
  const next = events[index + 1]
  const untilNext = next ? offsets[index + 1]! - clock : 0

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm text-paper">
        <span className="font-display text-xl">
          房间 {game.code} 第 {game.round} 局
        </span>
        <span className={cn('rounded-full px-2 py-0.5 text-xs', statusCls)}>{statusLabel}</span>
        <span className="text-paper/75">
          {fmtDateTime(game.startedAt)} 开局，{duration(game)}，{events.length} 个事件
        </span>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
      <div className="min-h-0 flex-1">{board}</div>

      {/* 时间控制条（只有一个事件时没有过程可回放，不显示） */}
      {events.length > 1 && (
        <div className="panel flex items-center gap-3 px-4 py-3">
          <Button variant="paper" size="icon-lg" onClick={() => jump(clock > offsets[index]! + 1500 ? index : index - 1)} aria-label="上一个事件">
            <ChevronLeft />
          </Button>
          <Button
            variant="red"
            size="icon-lg"
            onClick={() => {
              if (atEnd) setClock(0)
              setPlaying(!isPlaying)
            }}
            aria-label={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? <Pause /> : <Play />}
          </Button>
          <Button variant="paper" size="icon-lg" onClick={() => jump(index + 1)} aria-label="下一个事件">
            <ChevronRight />
          </Button>
          <button
            className="w-10 shrink-0 rounded-full border border-ink/15 bg-white py-0.5 text-xs"
            onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!)}
            aria-label="切换倍速"
          >
            {speed}×
          </button>
          <span className="w-14 shrink-0 text-right font-mono text-xs">{clockText(clock)}</span>
          {/* 时间轴：刻度是每个事件发生的时刻 */}
          <div className="relative h-6 min-w-0 flex-1">
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ink/15" />
            <div className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brick/80" style={{ width: `${total ? (clock / total) * 100 : 0}%` }} />
            {offsets.map((o, i) => (
              <span
                key={events[i]!.seq}
                className={cn('pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2', o <= clock ? 'bg-paper/80' : 'bg-ink/35')}
                style={{ left: `${total ? (o / total) * 100 : 0}%` }}
              />
            ))}
            <input
              type="range"
              min={0}
              max={total}
              step={100}
              value={clock}
              onChange={(e) => seek(Number(e.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="回放进度"
            />
            <span
              className="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brick shadow"
              style={{ left: `${total ? (clock / total) * 100 : 0}%` }}
            />
          </div>
          <span className="w-14 shrink-0 font-mono text-xs text-ink/60">{clockText(total)}</span>
          <span className="w-16 shrink-0 text-right font-mono text-xs text-ink/60">
            {index + 1}/{events.length}
          </span>
        </div>
      )}
      {current && (
        <div className="-mt-1 flex gap-3 truncate px-1 text-sm text-paper">
          <span className="min-w-0 truncate">
            <span className="font-mono text-paper/70">{fmtTime(current.ts)}</span>
            <span className="mx-2 font-medium text-gold">{current.actor}</span>
            {current.text}
          </span>
          {next && isPlaying && <span className="ml-auto shrink-0 text-xs text-paper/70">{clockText(untilNext)} 后：{next.actor}</span>}
        </div>
      )}
    </div>
  )
}
