import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Download, Eye, FileVideo, History, LogOut, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import type { ReplayGameInfo, StateView } from '@shared/types'
import { Logo } from '@/components/art/icons'
import { ConnBadge } from '@/components/game/ConnBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSpectator } from '@/hooks/useSpectator'
import { cn } from '@/lib/utils'
import { WatchView } from '../game/WatchView'
import { AuthError, adminApi, downloadReplay, type AdminGame, type AdminRoom, type GameEvent } from './adminApi'
import { duration, fmtDateTime, gameStatus } from './format'
import { ReplayPlayer } from './ReplayPlayer'

type View = { kind: 'list' } | { kind: 'live'; code: string } | { kind: 'replay'; id: string }

/** 后台面板：只打包进受保护的 admin.js，登录后才会下载（见 AdminEntry） */
export function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [view, setView] = useState<View>({ kind: 'list' })
  const [tab, setTab] = useState<'rooms' | 'games'>('rooms')
  const [rooms, setRooms] = useState<AdminRoom[]>([])
  const [fetchedAt, setFetchedAt] = useState(0)
  const [games, setGames] = useState<AdminGame[]>([])

  const guard = useCallback(
    (e: unknown) => {
      if (e instanceof AuthError) {
        toast.error(e.message)
        onLogout()
      } else toast.error((e as Error).message)
    },
    [onLogout],
  )

  const refresh = useCallback(() => {
    adminApi<AdminRoom[]>('/api/admin/rooms').then((r) => {
      setRooms(r)
      setFetchedAt(Date.now())
    }, guard)
    adminApi<AdminGame[]>('/api/admin/games').then(setGames, guard)
  }, [guard])

  useEffect(() => {
    if (view.kind !== 'list') return
    refresh()
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [view.kind, refresh])

  return (
    <div className="flex h-dvh flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-3 text-paper">
        {view.kind !== 'list' ? (
          <Button variant="paper" size="sm" onClick={() => setView({ kind: 'list' })}>
            <ArrowLeft /> 返回
          </Button>
        ) : (
          <Logo className="size-10" />
        )}
        <h1 className="text-title font-display text-2xl">
          {view.kind === 'list' ? '管理后台' : view.kind === 'live' ? `实时观看 · 房间 ${view.code}` : '对局回放'}
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {view.kind === 'list' && (
            <>
              <Button variant="ghost" size="sm" className="text-paper hover:bg-white/10 hover:text-paper" asChild>
                <a href="?replay" target="_blank" rel="noreferrer">
                  <FileVideo /> 本地回放查看器
                </a>
              </Button>
              <Button variant="paper" size="sm" onClick={refresh}>
                <RefreshCw /> 刷新
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" className="text-paper hover:bg-white/10 hover:text-paper" onClick={onLogout}>
            <LogOut /> 退出
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {view.kind === 'live' && <LiveView code={view.code} token={token} onAuthFail={onLogout} />}
        {view.kind === 'replay' && <ServerReplay id={view.id} onError={guard} />}
        {view.kind === 'list' && (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="flex gap-2">
              {(
                [
                  ['rooms', `房间（进行中 ${rooms.filter((r) => r.inGame).length}）`],
                  ['games', `对局记录（${games.length}）`],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={cn('rounded-full px-4 py-1.5 text-sm font-medium transition', tab === k ? 'bg-paper text-ink shadow-sm' : 'bg-black/20 text-paper/80')}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-2">
              {tab === 'rooms' ? (
                <RoomList rooms={rooms} fetchedAt={fetchedAt} onOpen={(code) => setView({ kind: 'live', code })} />
              ) : (
                <GameList games={games} onOpen={(id) => setView({ kind: 'replay', id })} onError={guard} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RoomList({ rooms, fetchedAt, onOpen }: { rooms: AdminRoom[]; fetchedAt: number; onOpen: (code: string) => void }) {
  if (!rooms.length) return <div className="py-16 text-center text-paper/80">暂无房间</div>
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
      {rooms.map((r) => (
        <div key={r.code} className="panel flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl tracking-widest text-brick">{r.code}</span>
            <span className={cn('ml-auto rounded-full px-2 py-0.5 text-xs', r.inGame ? 'bg-[#d3f0dc] text-[#17703c]' : 'bg-ink/10 text-ink/60')}>
              {r.inGame ? `第 ${r.round} 轮` : '未开局'}
            </span>
          </div>
          <div className="text-sm text-ink/70">
            房主 {r.host} · 玩家 {r.players}（在线 {r.online}）
            {r.spectators > 0 && ` · 观战 ${r.spectators}`}
          </div>
          <IdleInfo room={r} now={fetchedAt} />
          <Button variant={r.inGame ? 'red' : 'paper'} size="sm" className="mt-1" onClick={() => onOpen(r.code)}>
            <Eye /> 实时观看
          </Button>
        </div>
      ))}
    </div>
  )
}

/** 最后操作时间与自动解散倒计时（列表每 5 秒刷新一次） */
function IdleInfo({ room, now }: { room: AdminRoom; now: number }) {
  const idle = Math.max(0, now - room.lastActiveAt)
  const left = Math.max(0, room.idleTimeoutMs - idle)
  const mins = (ms: number) => (ms < 60_000 ? '不到 1 分钟' : `${Math.floor(ms / 60_000)} 分钟`)
  return (
    <div className={cn('text-xs', left < 5 * 60_000 ? 'text-brick' : 'text-ink/60')}>
      最后操作 {idle < 60_000 ? '刚刚' : `${mins(idle)}前`} · {mins(left)}后无操作将自动解散
    </div>
  )
}

/** 对局列表：每次开局算一局，同一房间的多局分别列出 */
function GameList({ games, onOpen, onError }: { games: AdminGame[]; onOpen: (id: string) => void; onError: (e: unknown) => void }) {
  const [q, setQ] = useState('')
  const shown = q ? games.filter((g) => g.code.includes(q)) : games
  return (
    <div className="space-y-3">
      <Input
        value={q}
        inputMode="numeric"
        placeholder="按房间号筛选"
        onChange={(e) => setQ(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="h-9 max-w-xs border-ink/15 bg-white shadow-none"
      />
      {shown.length === 0 ? (
        <div className="py-16 text-center text-paper/80">{games.length ? '没有匹配的对局' : '还没有对局记录'}</div>
      ) : (
        <div className="panel divide-y divide-ink/10 overflow-hidden p-0">
          {shown.map((g) => {
            const [label, cls] = gameStatus(g)
            return (
              <div key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <div className="w-28 shrink-0">
                  <div className="font-display text-lg">第 {g.round} 局</div>
                  <div className="text-xs text-ink/60">房间 {g.code}</div>
                </div>
                <span className={cn('w-24 shrink-0 truncate rounded-full px-2 py-0.5 text-center text-xs', cls)}>{label}</span>
                <span className="text-ink/70">{fmtDateTime(g.startedAt)} 开局</span>
                <span className="text-ink/70">{duration(g)}</span>
                <span className="min-w-0 truncate text-ink/70">
                  {g.players.join('、')} · {g.events} 个事件
                </span>
                <div className="ml-auto flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => downloadReplay(g.id).catch(onError)} aria-label="下载回放">
                    <Download /> 下载
                  </Button>
                  <Button variant="paper" size="sm" onClick={() => onOpen(g.id)}>
                    <History /> 回放
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------- 实时观看 ----------------

function LiveView({ code, token, onAuthFail }: { code: string; token: string; onAuthFail: () => void }) {
  const { state, status, gone } = useSpectator(code, token)
  useEffect(() => {
    if (gone?.includes('登录')) onAuthFail()
  }, [gone, onAuthFail])
  if (gone && !state) return <div className="py-20 text-center text-lg text-paper">{gone}</div>
  if (!state) return <div className="py-20 text-center text-paper">正在连接…</div>
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex justify-end">
        <ConnBadge status={status} className="text-xs text-paper/80" />
      </div>
      <div className="min-h-0 flex-1">
        <WatchView state={state} />
      </div>
    </div>
  )
}

// ---------------- 回放 ----------------

interface GameDetail extends ReplayGameInfo {
  events: GameEvent[]
}

/** 后台回放：从服务端按需加载每个时间点的局面 */
function ServerReplay({ id, onError }: { id: string; onError: (e: unknown) => void }) {
  const [detail, setDetail] = useState<GameDetail | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    adminApi<GameDetail>(`/api/admin/games/${id}`).then(setDetail, onError)
  }, [id, onError])
  const loadView = useCallback((seq: number) => adminApi<StateView>(`/api/admin/games/${id}/events/${seq}`), [id])
  if (!detail) return <div className="py-20 text-center text-paper">正在加载对局…</div>
  return (
    <ReplayPlayer
      key={id}
      game={detail}
      events={detail.events}
      loadView={loadView}
      onError={onError}
      actions={
        <Button
          variant="paper"
          size="sm"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            downloadReplay(id)
              .catch(onError)
              .finally(() => setBusy(false))
          }}
        >
          <Download /> {busy ? '正在打包…' : '下载回放'}
        </Button>
      }
    />
  )
}
