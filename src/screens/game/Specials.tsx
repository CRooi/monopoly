import { useEffect, useRef } from 'react'
import { BellRing, Gavel, Megaphone, Swords } from 'lucide-react'
import {
  AUCTION_MS,
  DUEL_PICK_MS,
  DUEL_ROLL_MS,
  EGG_INFO,
  RENT_CLAIM_MS,
  boardFor,
  type ClientMessage,
  type GamePlayer,
  type GameView,
} from '@shared/types'
import { Avatar } from '@/components/art/Avatar'
import { ChanceMark, Chest, Die } from '@/components/art/icons'
import { TileMark } from '@/components/art/TileMark'
import { EggMark } from '@/components/game/EggMark'
import { Button } from '@/components/ui/button'
import { useCountdown } from '@/hooks/useCountdown'
import { money } from '@/lib/rules'
import { sfx } from '@/lib/sound'
import { cn } from '@/lib/utils'

// 棋盘中央的几种特殊局面：房东收租、拍卖、对决、选择题卡、城市彩蛋、全城事件

type Send = (m: ClientMessage) => void

const playerOf = (g: GameView, id: string) => g.players.find((p) => p.id === id)!

/** 倒计时条 */
function TimeBar({ remaining, total, tone = 'red' }: { remaining: number; total: number; tone?: 'red' | 'gold' }) {
  const pct = Math.max(0, Math.min(1, remaining / total)) * 100
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
      <div className={cn('h-full rounded-full transition-[width] duration-100 ease-linear', tone === 'red' ? 'bg-brick' : 'bg-gold')} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** 新出现时响一声 */
function useChime(id: number | undefined, play: () => void, enabled = true) {
  const seen = useRef(id)
  useEffect(() => {
    if (id === undefined || id === seen.current) return
    seen.current = id
    if (enabled) play()
  }, [id, play, enabled])
}

// ---------------- 房东收租 ----------------

export function ClaimView({ game, meId, send }: { game: GameView; meId: string; send: Send }) {
  const c = game.rentClaim!
  const remaining = useCountdown(c.until, game.now)
  const owner = playerOf(game, c.to)
  const payer = playerOf(game, c.from)
  const isOwner = meId === c.to
  useChime(c.id, sfx.ring, isOwner)
  return (
    <div className="w-full space-y-2">
      {isOwner ? (
        <Button variant="red" size="lg" className="h-12 w-full animate-[heartbeat_0.9s_ease-in-out_infinite] text-lg" onClick={() => send({ type: 'claimRent' })}>
          <BellRing /> 收租！{money(c.amount)}
        </Button>
      ) : (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Avatar index={owner.avatar} size={24} ring={owner.color} className="border-white" />
          <span>
            {meId === payer.id ? '屏住呼吸，' : ''}看 {owner.name} 喊不喊收租
          </span>
        </div>
      )}
      <TimeBar remaining={remaining} total={RENT_CLAIM_MS} />
    </div>
  )
}

// ---------------- 拍卖 ----------------

export function AuctionView({ game, me, send }: { game: GameView; me?: GamePlayer; send: Send }) {
  const a = game.auction!
  const remaining = useCountdown(a.until, game.now)
  const tile = boardFor(game.theme)[a.tile]!
  const high = a.high ? playerOf(game, a.high.player) : null
  useChime(a.high?.amount, sfx.ring)
  const base = a.high?.amount ?? 0
  const canBid = me && !me.bankrupt
  return (
    <div className="w-full space-y-2">
      <div className="flex items-center gap-2 rounded-lg border border-ink/10 bg-paper px-3 py-2">
        <Gavel className="size-4 text-ink/60" />
        <TileMark tile={tile} size={22} />
        <span className="text-sm font-medium">{tile.name}</span>
        <span className="ml-auto text-xs text-ink/55">拍卖中</span>
      </div>
      <div className="flex items-center justify-center gap-2">
        {high ? (
          <>
            <Avatar index={high.avatar} size={28} ring={high.color} className="border-white" />
            <span className="text-sm">{high.name}</span>
            <span key={a.high!.amount} className="animate-pop text-xl font-bold tabular-nums text-cash">
              {money(a.high!.amount)}
            </span>
          </>
        ) : (
          <span className="text-sm text-ink/55">还没人出价，起拍 $10</span>
        )}
      </div>
      <TimeBar remaining={remaining} total={AUCTION_MS} tone="gold" />
      {canBid && (
        <div className="grid grid-cols-3 gap-1.5">
          {[10, 50, 100].map((inc) => {
            const amount = base + inc
            return (
              <Button
                key={inc}
                variant={a.high?.player === me!.id ? 'paper' : 'green'}
                size="sm"
                disabled={amount > me!.cash}
                onClick={() => send({ type: 'bid', amount })}
              >
                +{inc}
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------- 对决 ----------------

function DuelSide({ game, id, align }: { game: GameView; id: string; align: 'left' | 'right' }) {
  const d = game.duel!
  const p = playerOf(game, id)
  const dice = d.rolls[id]
  const won = d.done && d.winner === id
  const lost = d.done && d.winner && d.winner !== id
  return (
    <div className={cn('flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5', won && 'bg-[#fff3c4] ring-2 ring-gold', lost && 'opacity-50')}>
      <Avatar index={p.avatar} size={32} ring={p.color} className="border-white" />
      <span className={cn('max-w-full truncate text-xs', align === 'right' && 'text-right')}>{p.name}</span>
      <div key={dice ? 'rolled' : 'idle'} className={cn('flex gap-1', dice ? 'animate-pop' : 'animate-idle-dice')}>
        <Die value={dice?.[0] ?? 0} className="size-7" />
        <Die value={dice?.[1] ?? 0} className="size-7" />
      </div>
      {dice && <span className="text-xs font-semibold tabular-nums">{dice[0] + dice[1]} 点</span>}
    </div>
  )
}

export function DuelView({ game, meId, send }: { game: GameView; meId: string; send: Send }) {
  const d = game.duel!
  const remaining = useCountdown(d.done ? null : d.until, game.now)
  const a = playerOf(game, d.a)
  const rolls = Object.keys(d.rolls).length
  useChime(rolls || undefined, sfx.land)
  if (!d.b) {
    const others = game.players.filter((p) => !p.bankrupt && p.id !== d.a)
    return (
      <div className="w-full space-y-2">
        <div className="flex items-center justify-center gap-1.5 text-sm font-medium">
          <Swords className="size-4 text-brick" /> {meId === d.a ? '挑一个对手，赌注' : `${a.name} 正在挑对手，赌注`} {money(d.stake)}
        </div>
        {meId === d.a && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {others.map((p) => (
              <Button key={p.id} variant="paper" size="sm" onClick={() => send({ type: 'duelPick', target: p.id })}>
                <Avatar index={p.avatar} size={18} ring={p.color} className="border-white" /> {p.name}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => send({ type: 'duelPick', target: null })}>
              不比了
            </Button>
          </div>
        )}
        <TimeBar remaining={remaining} total={DUEL_PICK_MS} />
      </div>
    )
  }
  const inDuel = meId === d.a || meId === d.b
  const winner = d.winner ? playerOf(game, d.winner) : null
  return (
    <div className="w-full space-y-2">
      <div className="flex items-stretch gap-1.5">
        <DuelSide game={game} id={d.a} align="left" />
        <span className="self-center font-display text-lg text-brick">VS</span>
        <DuelSide game={game} id={d.b} align="right" />
      </div>
      {d.done ? (
        <div className="animate-pop text-center text-sm font-semibold">{winner ? `${winner.name} 赢了，拿走 ${money(d.stake)}` : '平局，谁也不赔'}</div>
      ) : (
        <>
          {inDuel && !d.rolls[meId] && (
            <Button variant="red" size="lg" className="w-full" onClick={() => send({ type: 'duelRoll' })}>
              摇！
            </Button>
          )}
          <TimeBar remaining={remaining} total={DUEL_ROLL_MS} />
        </>
      )}
    </div>
  )
}

// ---------------- 选择题卡 ----------------

export function ChoiceView({ game, mine, send }: { game: GameView; mine: boolean; send: Send }) {
  const c = game.choice!
  const chance = c.deck === 'chance'
  return (
    <div className={cn('animate-flip-in w-full space-y-2 rounded-lg border px-3 py-2.5 text-left', chance ? 'border-[#f0b77a] bg-[#fff1e0]' : 'border-[#9fd0ef] bg-[#e8f5fd]')}>
      <div className="flex items-center gap-2">
        {chance ? <ChanceMark className="size-6 shrink-0" /> : <Chest className="size-6 shrink-0" />}
        <span className="text-[13px] font-semibold leading-snug">{c.text}</span>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {c.options.map((o, i) => (
          <Button key={o} variant={i === 0 ? 'paper' : 'gold'} size="sm" className="h-auto min-h-8 py-1.5 whitespace-normal" disabled={!mine} onClick={() => send({ type: 'chooseOption', index: i })}>
            {o}
          </Button>
        ))}
      </div>
    </div>
  )
}

/** 「赌一把」的结果 */
export function GambleView({ game }: { game: GameView }) {
  const r = game.gamble
  useChime(r?.id, r?.win ? sfx.reveal : sfx.land)
  if (!r) return null
  return (
    <div key={r.id} className={cn('animate-pop flex w-full items-center gap-2.5 rounded-lg border px-3 py-2', r.win ? 'border-cash/40 bg-[#e6f6ec]' : 'border-brick/30 bg-[#fff0ee]')}>
      <span className="flex gap-1">
        <Die value={r.dice[0]} className="size-6" />
        <Die value={r.dice[1]} className="size-6" />
      </span>
      <span className={cn('text-sm font-semibold', r.win ? 'text-cash' : 'text-brick')}>{r.text}</span>
    </div>
  )
}

// ---------------- 城市彩蛋 ----------------

/** 刚触发的城市彩蛋（重庆火锅另有辣度卡） */
export function EggCard({ game }: { game: GameView }) {
  const e = game.egg
  useChime(e?.id, sfx.reveal)
  if (!e || e.kind === 'hotpot') return null
  return (
    <div key={e.id} className="animate-flip-in relative w-full overflow-hidden rounded-lg border border-[#b8860b]/60 bg-[#2a1a12] px-3 py-2.5 text-left">
      <div className="flex items-center gap-2.5">
        <EggMark kind={e.kind} className="size-9 shrink-0" iconClassName="size-5" />
        <div className="min-w-0">
          <div className="font-display text-[15px] text-[#f7e08a]">彩蛋：{EGG_INFO[e.kind].title}</div>
          <div className="text-[13px] leading-snug text-[#f3ead6]">{e.text}</div>
        </div>
      </div>
    </div>
  )
}

// ---------------- 全城事件 ----------------

/** 本轮的全城事件，放在回合面板顶上 */
export function EventChip({ game }: { game: GameView }) {
  const e = game.event
  if (!e || e.round !== game.round) return null
  return (
    <div className="flex w-full items-center gap-1.5 rounded-lg bg-[#2a1a12] px-2.5 py-1 text-left text-[12px] text-[#f7e08a]">
      <Megaphone className="size-3.5 shrink-0" />
      <span className="shrink-0 font-semibold">{e.title}</span>
      <span className="truncate text-[#f3ead6]/80">{e.text}</span>
    </div>
  )
}
