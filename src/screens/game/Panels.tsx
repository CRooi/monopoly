import { useEffect, useRef } from 'react'
import { ArrowLeftRight, Award, Crown, KeyRound, Lock, UserX, WifiOff } from 'lucide-react'
import { boardFor, type ClientMessage, type Emote, type GamePlayer, type GameView, type StateView } from '@shared/types'
import { Avatar } from '@/components/art/Avatar'
import { TileMark } from '@/components/art/TileMark'
import { Buildings } from '@/components/art/icons'
import { CashTicker } from '@/components/game/CashTicker'
import { Button } from '@/components/ui/button'
import { money, ownedTiles, tileSwatch, worth } from '@/lib/rules'
import { cn } from '@/lib/utils'
import { PropertyActions } from './PropertyActions'

export function PlayersPanel({
  state,
  onTrade,
  onKick,
  emotes,
}: {
  state: StateView
  /** 每个人头上正在飘的表情 */
  emotes?: Record<string, Emote>
  /** 和某人发起交易 */
  onTrade?: (id: string) => void
  /** 房主请出玩家（掉线卡住时用） */
  onKick?: (id: string, name: string) => void
}) {
  const g = state.game!
  const online = Object.fromEntries(state.room.members.map((m) => [m.id, m.online]))
  const me = g.players.find((p) => p.id === state.me.id)
  return (
    <div className="space-y-2">
      {g.players.map((p, i) => {
        const tiles = ownedTiles(g, p.id)
        const active = i === g.turn && g.phase !== 'over'
        return (
          <div
            key={p.id}
            className={cn('panel-flat flex flex-col gap-1.5 px-3 py-2', active && 'bg-[#fff8dc] ring-2 ring-gold', p.bankrupt && 'opacity-55')}
          >
            <div className="flex items-center gap-2">
              <Avatar index={p.avatar} size={34} ring={p.color} className="border-white" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate font-medium">{p.name}</span>
                  {p.id === state.me.id && <span className="text-xs text-ink/50">（你）</span>}
                  {p.id === state.room.hostId && <Crown className="size-3.5 shrink-0 text-[#b8860b]" />}
                  {online[p.id] === false && !p.bankrupt && <WifiOff className="size-3.5 shrink-0 text-brick" />}
                  {emotes?.[p.id] && (
                    <span key={emotes[p.id]!.id} className="animate-pop shrink-0 rounded-full border border-ink/15 bg-white px-1.5 text-[11px] leading-4 font-semibold whitespace-nowrap shadow-sm">
                      {emotes[p.id]!.text}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-ink/60">
                  {p.bankrupt ? (
                    <span>已破产</span>
                  ) : (
                    <>
                      <span>总资产 {money(worth(g, p))}</span>
                      {p.inJail && (
                        <span className="flex items-center gap-0.5 text-brick">
                          <Lock className="size-3" /> 监狱
                        </span>
                      )}
                      {p.jailCards > 0 && (
                        <span className="flex items-center gap-0.5">
                          <KeyRound className="size-3" /> {p.jailCards}
                        </span>
                      )}
                      {p.skipTurns > 0 && <span className="text-[#a0522d]">排队中</span>}
                    </>
                  )}
                </div>
                <Badges badges={p.badges} />
              </div>
              {!p.bankrupt && <CashTicker value={p.cash} className="text-lg font-semibold text-cash" />}
            </div>
            {tiles.length > 0 && (
              <div className="flex flex-wrap gap-0.5">
                {tiles.map((t) => (
                  <span
                    key={t}
                    title={boardFor(g.theme)[t]!.name}
                    className={cn('h-2.5 w-3.5 rounded-[2px] border border-ink/40', g.owners[t]!.mortgaged && 'opacity-35')}
                    style={{ background: tileSwatch(boardFor(g.theme)[t]!) }}
                  />
                ))}
              </div>
            )}
            {g.phase !== 'over' && !p.bankrupt && p.id !== state.me.id && (onTrade || onKick) && (
              <div className="flex gap-1.5">
                {onTrade && me && !me.bankrupt && (
                  <Button size="xs" variant="paper" onClick={() => onTrade(p.id)}>
                    <ArrowLeftRight /> 交易
                  </Button>
                )}
                {onKick && state.room.members.some((m) => m.id === p.id) && (
                  <Button size="xs" variant="ghost" className="text-brick" onClick={() => onKick(p.id, p.name)}>
                    <UserX /> 请出
                  </Button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** 徽章：小小的金色标签 */
export function Badges({ badges }: { badges?: string[] }) {
  if (!badges?.length) return null
  return (
    <div className="mt-0.5 flex flex-wrap gap-1">
      {badges.map((b) => (
        <span key={b} className="flex items-center gap-0.5 rounded-full border border-[#c99400]/50 bg-[#fff3c4] px-1.5 text-[10px] leading-4 font-semibold text-[#8a5d00]">
          <Award className="size-2.5" /> {b}
        </span>
      ))}
    </div>
  )
}

export function AssetsPanel({ game, me, send, onTile }: { game: GameView; me: GamePlayer; send: (m: ClientMessage) => void; onTile: (i: number) => void }) {
  const tiles = ownedTiles(game, me.id)
  return (
    <div className="space-y-3">
      <div className="panel-flat flex items-center justify-between px-3 py-2">
        <span className="text-sm text-ink/70">现金</span>
        <CashTicker value={me.cash} className="text-lg font-semibold text-cash" />
        <span className="text-sm text-ink/70">总资产</span>
        <span className="text-lg font-semibold tabular-nums">{money(worth(game, me))}</span>
      </div>
      {tiles.length === 0 && <div className="py-8 text-center text-sm text-paper/80">还没有地产</div>}
      {tiles.map((i) => {
        const t = boardFor(game.theme)[i]!
        const own = game.owners[i]!
        return (
          <div key={i} className={cn('panel-flat overflow-hidden', own.mortgaged && 'bg-[#efe7d6]')}>
            <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left" onClick={() => onTile(i)}>
              <span className="h-6 w-1.5 shrink-0 rounded-sm" style={{ background: tileSwatch(t) }} />
              <TileMark tile={t} size={22} />
              <span className="font-medium">{t.name}</span>
              {own.houses > 0 && <Buildings houses={own.houses} className="h-3.5" />}
              {own.mortgaged && <span className="ml-auto rounded bg-ink px-1.5 text-xs text-paper">抵押中</span>}
            </button>
            <div className="px-3 pb-2 empty:hidden">
              <PropertyActions game={game} me={me} tile={i} send={send} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function LogPanel({ game, limit }: { game: GameView; /** 只显示最近几条 */ limit?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const colorOf = Object.fromEntries(game.players.map((p) => [p.id, p.color]))
  const last = game.log.at(-1)?.id
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' })
  }, [last])
  return (
    <div className="space-y-1">
      {(limit ? game.log.slice(-limit) : game.log).map((l) => (
        <div key={l.id} className="flex gap-2 rounded-md bg-paper/90 px-2.5 py-1 text-[13px] leading-snug">
          <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: l.who ? colorOf[l.who] : '#b5a88e' }} />
          <span>{l.text}</span>
        </div>
      ))}
      <div ref={ref} />
    </div>
  )
}
