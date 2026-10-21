import { useEffect, useRef, useState } from 'react'
import { Crown, DoorOpen, Flag as FlagIcon, Flame, KeyRound, Landmark } from 'lucide-react'
import { BAIL, GROUP_COLOR, SPICE_LEVELS, boardFor, themeOf, isBuyable, type ClientMessage, type GameView, type StateView } from '@shared/types'
import { Avatar } from '@/components/art/Avatar'
import { TileMark } from '@/components/art/TileMark'
import { ChanceMark, Chest, Die } from '@/components/art/icons'
import { Button } from '@/components/ui/button'
import type { ConfirmRequest } from '@/components/game/ConfirmDialog'
import { money } from '@/lib/rules'
import type { SpiceStage } from '@/hooks/useSpiceReveal'
import { sfx } from '@/lib/sound'
import { cn } from '@/lib/utils'

/** 摇骰子时每点一下飘出的字，按第几下选，所有人看到的一样 */
const TAP_WORDS = ['运气 +1', '手气 +1', '财运 +1', '大！', '双数 +1', '稳住', '发发发', '好运 +1', '冲！', '六六六', '财神保佑', '人品 +1']

function TapFloats({ taps }: { taps: number }) {
  const [items, setItems] = useState<{ n: number; text: string; x: number; y: number }[]>([])
  const seen = useRef(taps)
  useEffect(() => {
    const from = seen.current
    seen.current = taps
    if (taps <= from) return
    // 一次推来好几下（网络抖动）时最多补 4 个，免得糊成一团
    const fresh = Array.from({ length: Math.min(4, taps - from) }, (_, i) => taps - i).map((n) => ({
      n,
      text: TAP_WORDS[(n * 7) % TAP_WORDS.length]!,
      // 左右错开、起点高低错开，连点时不挤成一团
      x: ((n * 53) % 150) - 75,
      y: (n * 17) % 24,
    }))
    sfx.tap()
    setItems((cur) => [...cur, ...fresh].slice(-12))
    const t = setTimeout(() => setItems((cur) => cur.filter((x) => !fresh.includes(x))), 1300)
    return () => clearTimeout(t)
  }, [taps])
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-0">
      {items.map((it) => (
        <span
          key={it.n}
          className="animate-tap-float absolute left-1/2 font-display text-sm whitespace-nowrap text-brick [text-shadow:0_1px_0_white,0_0_6px_white]"
          style={{ marginLeft: it.x, top: it.y }}
        >
          {it.text}
        </span>
      ))}
    </div>
  )
}

function Dice({ game }: { game: GameView }) {
  const roll = game.lastRoll
  const shaking = game.shakeMs !== null
  const [faces, setFaces] = useState<[number, number]>([1, 1])
  // 摇的时候不停换面、响骰子声，停下时落在真正的点数上
  useEffect(() => {
    if (!shaking) return
    sfx.dice()
    const f = setInterval(() => setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]), 80)
    const s = setInterval(() => sfx.dice(), 750)
    return () => {
      clearInterval(f)
      clearInterval(s)
    }
  }, [shaking])
  const landed = useRef(roll?.id)
  useEffect(() => {
    if (!roll || roll.id === landed.current) return
    landed.current = roll.id
    sfx.land()
  }, [roll])
  // 轮到掷骰子但还没摇（包括双数后再摇一次）：不显示上一次的点数，显示两颗待摇的骰子
  const idle = game.phase === 'roll' && !shaking
  const [a, b] = shaking ? faces : idle ? [0, 0] : (roll?.dice ?? [0, 0])
  const size = 'size-[clamp(34px,8cqw,58px)]'
  const double = !shaking && !idle && roll && roll.dice[0] === roll.dice[1]
  return (
    <div className="relative flex flex-col items-center gap-1">
      <TapFloats taps={game.shakeTaps} />
      <div
        key={shaking ? 'shaking' : idle ? 'idle' : (roll?.id ?? 0)}
        className={cn('flex gap-3', shaking ? 'animate-shake' : idle ? 'animate-idle-dice' : roll && 'animate-pop')}
      >
        <Die value={a} className={size} />
        <Die value={b} className={cn(size, idle && '[animation-delay:-0.6s]')} />
      </div>
      <div className="h-4 text-xs text-ink/55">
        {!shaking && !idle && roll && (
          <>
            {roll.dice[0] + roll.dice[1]} 点{double && <span className="ml-1 font-semibold text-brick">双数</span>}
          </>
        )}
      </div>
    </div>
  )
}

/** 重庆火锅辣度：先在几档之间跳一会儿，再停在摇出的那档 */
/** 辣度条从黄到深红 */
const HEAT = ['#ffd43b', '#ffc233', '#ffa62b', '#ff8a24', '#ff6b1f', '#f04a1a', '#d92b14', '#b8140f', '#8f0008']

function SpiceView({ game, spinning, stage }: { game: GameView; spinning: number | null; stage: SpiceStage | null }) {
  const spice = game.spice
  if (!spice) return null
  const settled = stage === null
  const index = spinning ?? Math.max(0, SPICE_LEVELS.findIndex((s) => s.level === spice.level))
  const shown = SPICE_LEVELS[index]!
  const top = settled && index === SPICE_LEVELS.length - 1
  const name = boardFor(game.theme)[themeOf(game.theme).spicy ?? 39]!.name
  return (
    <div
      className={cn(
        'w-full space-y-1.5 rounded-lg border px-3 py-2 text-left transition-transform',
        stage === 'spin' && 'scale-[1.03] border-[#ff8a24] bg-[#fff6ee] shadow-[0_0_0_3px_rgb(255_138_36/0.25)]',
        stage === 'pause' && 'animate-heartbeat border-[#d92b14] bg-[#fff0eb] shadow-[0_0_18px_rgb(217_43_20/0.35)]',
        settled && (top ? 'animate-[shake_0.25s_linear_5] border-[#8f0008] bg-[#fff0eb]' : 'animate-pop border-[#f5a08a] bg-[#fff0eb]'),
      )}
    >
      <div className="flex items-center gap-1.5">
        <Flame className={cn('size-4 text-[#d63c2f]', settled ? 'fill-[#ff6b35]' : 'animate-pulse fill-[#ffb08a]')} />
        <span className="text-[11px] font-semibold text-brick">{name}火锅</span>
        <span
          key={settled ? 'mult' : 'unknown'}
          className={cn('ml-auto font-bold tabular-nums text-brick', settled ? cn('animate-pop', top ? 'text-xl' : 'text-sm') : 'text-sm opacity-60', stage === 'pause' && 'animate-pulse opacity-100')}
        >
          租金 ×{settled ? shown.mult : '?'}
        </span>
      </div>
      <div className="flex gap-0.5">
        {HEAT.map((c, i) => (
          <span
            key={i}
            className={cn('h-1.5 flex-1 rounded-full transition-colors duration-75', i === index && !settled && 'scale-y-150')}
            style={{ background: i <= index ? c : 'rgb(43 33 24 / 0.08)' }}
          />
        ))}
      </div>
      <div
        key={stage === 'spin' ? index : 'still'}
        className={cn(
          'leading-snug',
          stage === 'spin' && 'animate-[spin-text_0.12s_ease-out] text-[13px] text-ink/70',
          stage === 'pause' && 'text-[13px] font-semibold',
          settled && (top ? 'bg-[linear-gradient(90deg,#d92b14,#8f0008)] bg-clip-text font-display text-base text-transparent' : 'text-[13px] font-semibold'),
        )}
      >
        {shown.level}
      </div>
    </div>
  )
}

/** 本回合发生的事，像庄家在旁边报幕；最近的在最下面 */
function TurnFeed({ game }: { game: GameView }) {
  const log = game.log
  let start = log.length - 1
  while (start >= 0 && !log[start]!.text.startsWith('轮到 ')) start--
  const lines = log.slice(start + 1).slice(-3)
  if (!lines.length) return null
  return (
    <div className="w-full space-y-0.5 border-t border-dashed border-ink/15 pt-2 text-left">
      {lines.map((l, i) => (
        <div key={l.id} className={cn('animate-rise truncate text-xs leading-snug', i === lines.length - 1 ? 'text-ink' : 'text-ink/45')}>
          {l.text}
        </div>
      ))}
    </div>
  )
}

/** 背面朝上的卡，自己点开 */
function CardBack({ deck, onFlip }: { deck: 'chance' | 'chest'; onFlip?: () => void }) {
  const chance = deck === 'chance'
  return (
    <button
      type="button"
      disabled={!onFlip}
      onClick={onFlip}
      className={cn(
        'group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition',
        chance ? 'border-[#f0b77a] bg-[repeating-linear-gradient(45deg,#ffe2c2_0_6px,#fff1e0_6px_12px)]' : 'border-[#9fd0ef] bg-[repeating-linear-gradient(45deg,#d3ecfb_0_6px,#e8f5fd_6px_12px)]',
        onFlip && 'animate-wiggle hover:-translate-y-0.5 hover:shadow-md',
      )}
    >
      {chance ? <ChanceMark className="size-8 shrink-0" /> : <Chest className="size-8 shrink-0" />}
      <span className={cn('font-display text-base', chance ? 'text-[#c46a14]' : 'text-[#1c63c9]')}>{onFlip ? `翻开${chance ? '机会' : '命运'}卡` : `正在抽${chance ? '机会' : '命运'}卡`}</span>
    </button>
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
        'animate-flip-in flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left',
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
  spin = null,
  spinStage = null,
}: {
  state: StateView
  /** 重庆火锅辣度当前停在哪一档 */
  spin?: number | null
  /** 重庆火锅辣度正在转或停顿中，这期间不显示操作按钮 */
  spinStage?: SpiceStage | null
  send: (m: ClientMessage) => void
  confirm: (r: ConfirmRequest) => void
  /** 打开自己的资产面板（欠款时卖房、抵押） */
  onAssets: () => void
  /** 看完结果回到房间 */
  onDone?: () => void
}) {
  const g = state.game!
  const cur = g.players[g.turn]!
  const me = g.players.find((p) => p.id === state.me.id)
  const mine = me?.id === cur.id && g.phase !== 'over'
  const shaking = g.shakeMs !== null

  // 电脑上按空格：摇骰子（按住一直摇），或者走一步
  const primary = useRef<(() => void) | null>(null)
  useEffect(() => {
    primary.current = !mine ? null : g.phase === 'roll' ? () => send({ type: 'shake' }) : g.phase === 'move' ? () => send({ type: 'step' }) : null
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (document.querySelector('[role="dialog"],[role="alertdialog"]')) return
      if (!primary.current) return
      e.preventDefault()
      // 走一步不跟着按键自动重复，一下一步
      if (e.repeat && g.phase === 'move') return
      primary.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [g.phase])

  if (g.phase === 'over') return <Result game={g} onDone={onDone} />
  const tile = boardFor(g.theme)[cur.pos]!

  let status: string
  switch (g.phase) {
    case 'roll':
      status = shaking ? '摇骰子中' : cur.inJail ? '在监狱中' : g.again ? '双数，再摇一次' : '准备摇骰子'
      break
    case 'move':
      status = `还要走 ${g.stepsLeft} 步`
      break
    case 'buy':
      status = '考虑是否购买'
      break
    case 'draw':
      status = '抽卡中'
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
      <SpiceView game={g} spinning={spin} stage={spinStage} />
      {g.phase === 'draw' && (tile.kind === 'chance' || tile.kind === 'chest') && (
        <CardBack deck={tile.kind} onFlip={mine ? () => send({ type: 'drawCard' }) : undefined} />
      )}

      {g.phase === 'buy' && isBuyable(tile) && (
        <div className="flex w-full items-center gap-2 rounded-lg border border-ink/10 bg-paper px-3 py-2">
          {tile.kind === 'country' && <span className="h-5 w-1 rounded-full" style={{ background: GROUP_COLOR[tile.group] }} />}
          <TileMark tile={tile} size={24} />
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

      {mine && spinStage === null && (
        <div className="flex w-full flex-wrap justify-center gap-2">
          {g.phase === 'roll' && (
            <>
              <Button
                variant="red"
                size="lg"
                className="min-w-24 flex-1 select-none"
                onClick={() => send({ type: 'shake' })}
              >
                {shaking ? '继续摇' : '摇骰子'}
              </Button>
              {cur.inJail && !shaking && (
                <Button variant="paper" size="lg" disabled={cur.cash < BAIL} onClick={() => send({ type: 'payBail' })}>
                  <Landmark /> 保释 {money(BAIL)}
                </Button>
              )}
              {cur.inJail && !shaking && cur.jailCards > 0 && (
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
          {g.phase === 'move' && (
            <Button variant="red" size="lg" className="min-w-24 flex-1 select-none" onClick={() => send({ type: 'step' })}>
              走一步
              <span className="ml-1 rounded-full bg-white/25 px-1.5 text-xs tabular-nums">{g.stepsLeft}</span>
            </Button>
          )}
          {g.phase === 'end' && (
            <Button variant="red" size="lg" className="min-w-24 flex-1" onClick={() => send({ type: 'endTurn' })}>
              结束回合
            </Button>
          )}
        </div>
      )}
      <TurnFeed game={g} />
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
