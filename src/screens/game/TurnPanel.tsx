import { Crown, DoorOpen, Flag as FlagIcon, KeyRound, Landmark, Plane } from 'lucide-react'
import { BAIL, BOARD, GROUP_COLOR, isBuyable, type ClientMessage, type GameView, type StateView } from '@shared/types'
import { Avatar } from '@/components/art/Avatar'
import { Flag } from '@/components/art/Flag'
import { ChanceMark, Chest, Die } from '@/components/art/icons'
import { Button } from '@/components/ui/button'
import type { ConfirmRequest } from '@/components/game/ConfirmDialog'
import { money } from '@/lib/rules'
import { cn } from '@/lib/utils'

function Dice({ game }: { game: GameView }) {
  const roll = game.lastRoll
  const [a, b] = roll?.dice ?? [1, 1]
  const size = 'size-[clamp(30px,7cqw,50px)]'
  return (
    <div key={roll?.id ?? 0} className="flex gap-2.5">
      <Die value={a} className={cn(size, roll && 'animate-tumble')} />
      <Die value={b} className={cn(size, roll && 'animate-tumble')} />
    </div>
  )
}

function CardView({ game }: { game: GameView }) {
  const card = game.card
  if (!card) return null
  const chance = card.deck === 'chance'
  return (
    <div
      key={card.id}
      className={cn(
        'animate-pop flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left',
        chance ? 'border-[#f0b77a] bg-[#fff1e0]' : 'border-[#9fd0ef] bg-[#e8f5fd]',
      )}
    >
      {chance ? <ChanceMark className="size-7 shrink-0" /> : <Chest className="size-7 shrink-0" />}
      <div className="min-w-0">
        <div className={cn('text-[11px] font-semibold', chance ? 'text-[#c46a14]' : 'text-[#1c63c9]')}>{chance ? '机会' : '命运'}</div>
        <div className="text-[13px] leading-snug">{card.text}</div>
      </div>
    </div>
  )
}

/** 棋盘中央：当前回合、骰子、抽到的卡和自己能做的操作 */
export function TurnPanel({
  state,
  send,
  confirm,
  onAssets,
  onDone,
}: {
  state: StateView
  send: (m: ClientMessage) => void
  confirm: (r: ConfirmRequest) => void
  /** 打开自己的资产面板（欠款时卖房、抵押） */
  onAssets: () => void
  /** 看完结果回到房间 */
  onDone?: () => void
}) {
  const g = state.game!
  if (g.phase === 'over') return <Result game={g} onDone={onDone} />

  const cur = g.players[g.turn]!
  const me = g.players.find((p) => p.id === state.me.id)
  const mine = me?.id === cur.id
  const tile = BOARD[cur.pos]!

  let status: string
  switch (g.phase) {
    case 'roll':
      status = cur.inJail ? '在监狱中' : g.again ? '双数，再掷一次' : '准备掷骰子'
      break
    case 'buy':
      status = '考虑是否购买'
      break
    case 'debt':
      status = '正在凑钱'
      break
    default:
      status = '经营中'
  }

  return (
    <div className="flex w-[min(19rem,86%)] flex-col items-center gap-3 rounded-2xl border border-ink/10 bg-white/92 p-3.5 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)] backdrop-blur-sm sm:p-4">
      <div className="flex w-full items-center gap-2.5">
        <Avatar index={cur.avatar} size={36} ring={cur.color} className="border-white" />
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-[15px] leading-tight font-semibold">{mine ? '你的回合' : cur.name}</div>
          <div className="text-xs leading-tight text-ink/55">{status}</div>
        </div>
        <span className="shrink-0 rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink/60">第 {g.round} 轮</span>
      </div>

      <Dice game={g} />
      <CardView game={g} />

      {g.phase === 'buy' && isBuyable(tile) && (
        <div className="flex w-full items-center gap-2 rounded-lg border border-ink/10 bg-paper px-3 py-2">
          {tile.kind === 'country' && <span className="h-5 w-1 rounded-full" style={{ background: GROUP_COLOR[tile.group] }} />}
          {tile.kind === 'country' ? <Flag iso={tile.iso} className="w-6" /> : tile.kind === 'airline' ? <Plane className="size-4 text-[#1c63c9]" /> : null}
          <span className="text-sm font-medium">{tile.name}</span>
          <span className="ml-auto text-sm font-semibold tabular-nums text-cash">{money(tile.price)}</span>
        </div>
      )}

      {g.phase === 'debt' && g.debt && (
        <div className="w-full rounded-lg border border-brick/25 bg-[#fff0ee] px-3 py-2 text-left text-[13px] leading-snug">
          <div className="flex justify-between">
            <span>{g.debt.reason}</span>
            <span className="font-semibold tabular-nums">{money(g.debt.amount)}</span>
          </div>
          {cur.cash < g.debt.amount && (
            <div className="flex justify-between text-brick">
              <span>还差</span>
              <span className="font-semibold tabular-nums">{money(g.debt.amount - cur.cash)}</span>
            </div>
          )}
        </div>
      )}

      {mine && (
        <div className="flex w-full flex-wrap justify-center gap-2">
          {g.phase === 'roll' && (
            <>
              <Button variant="red" size="lg" className="min-w-24 flex-1" onClick={() => send({ type: 'roll' })}>
                掷骰子
              </Button>
              {cur.inJail && (
                <Button variant="paper" size="lg" disabled={cur.cash < BAIL} onClick={() => send({ type: 'payBail' })}>
                  <Landmark /> 保释 {money(BAIL)}
                </Button>
              )}
              {cur.inJail && cur.jailCards > 0 && (
                <Button variant="paper" size="lg" onClick={() => send({ type: 'useJailCard' })}>
                  <KeyRound /> 出狱卡
                </Button>
              )}
            </>
          )}
          {g.phase === 'buy' && isBuyable(tile) && (
            <>
              <Button variant="green" size="lg" className="flex-1" disabled={cur.cash < tile.price} onClick={() => send({ type: 'buy' })}>
                购买
              </Button>
              <Button variant="paper" size="lg" className="flex-1" onClick={() => send({ type: 'pass' })}>
                不买
              </Button>
            </>
          )}
          {g.phase === 'debt' && g.debt && (
            <>
              <Button variant="green" size="lg" className="flex-1" disabled={cur.cash < g.debt.amount} onClick={() => send({ type: 'payDebt' })}>
                付款
              </Button>
              <Button variant="paper" size="lg" className="flex-1" onClick={onAssets}>
                卖房 / 抵押
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-brick"
                onClick={() =>
                  confirm({
                    title: '宣告破产？',
                    description: g.debt!.to.length === 1 ? '你的现金和地产都会交给债主，之后只能观战。' : '你的地产会收归银行，之后只能观战。',
                    confirmText: '破产',
                    onConfirm: () => send({ type: 'bankrupt' }),
                  })
                }
              >
                <FlagIcon /> 宣告破产
              </Button>
            </>
          )}
          {g.phase === 'end' && (
            <Button variant="red" size="lg" className="min-w-24 flex-1" onClick={() => send({ type: 'endTurn' })}>
              结束回合
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function Result({ game, onDone }: { game: GameView; onDone?: () => void }) {
  const res = game.result!
  const won = res.reason !== 'aborted'
  return (
    <div className="flex w-[min(20rem,88%)] flex-col items-center gap-3 rounded-2xl border border-ink/10 bg-white/92 p-4 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)]">
      <div className="font-display text-2xl">{won ? '游戏结束' : '对局已结束'}</div>
      <div className="w-full space-y-1.5">
        {res.standings.map((s, i) => (
          <div
            key={s.id}
            className={cn('flex items-center gap-2 rounded-lg px-2.5 py-1.5', i === 0 && won ? 'bg-[#fff3c4] ring-1 ring-gold' : 'bg-paper')}
          >
            <span className="w-4 text-center text-sm font-semibold text-ink/50">{i + 1}</span>
            <Avatar index={s.avatar} size={28} ring={s.color} className="border-white" />
            <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">{s.name}</span>
            {i === 0 && won && <Crown className="size-4 text-[#b8860b]" />}
            <span className={cn('text-sm tabular-nums', s.bankrupt ? 'text-ink/45' : 'font-semibold text-cash')}>{s.bankrupt ? '破产' : money(s.worth)}</span>
          </div>
        ))}
      </div>
      {onDone && (
        <Button variant="red" size="lg" className="w-full" onClick={onDone}>
          <DoorOpen /> 回到房间
        </Button>
      )}
    </div>
  )
}
