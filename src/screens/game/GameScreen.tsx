import { useEffect, useRef, useState } from 'react'
import { Flag as FlagIcon, LogOut, Power, ScrollText, Tv, Users, Volume2, VolumeX, Wallet, ArrowLeftRight } from 'lucide-react'
import { toast } from 'sonner'
import type { ClientMessage, GameView, StateView } from '@shared/types'
import { Logo } from '@/components/art/icons'
import { ConfirmDialog, type ConfirmRequest } from '@/components/game/ConfirmDialog'
import { ConnBadge } from '@/components/game/ConnBadge'
import { Button } from '@/components/ui/button'
import type { ConnStatus } from '@/hooks/useRoomSocket'
import { useSpiceReveal } from '@/hooks/useSpiceReveal'
import { setMuted, sfx, useMuted } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { Board } from './Board'
import { AssetsPanel, LogPanel, PlayersPanel } from './Panels'
import { TileDialog } from './TileDialog'
import { TradeCard, TradeDialog } from './Trade'
import { TurnPanel } from './TurnPanel'

type Tab = 'players' | 'assets' | 'trades' | 'log'

/** 局面变化时的音效，只在自己身上发生的才响，避免一直吵 */
function useGameSounds(g: GameView, meId: string) {
  const prev = useRef(g)
  useEffect(() => {
    const p = prev.current
    prev.current = g
    if (p === g || p.id !== g.id) return
    if (g.card && g.card.id !== p.card?.id) sfx.card()
    const owned = (x: GameView) => Object.values(x.owners).reduce((n, o) => n + 1 + o.houses, 0)
    if (owned(g) > owned(p)) sfx.buy()
    const jailed = g.players.some((x) => x.inJail && !p.players.find((y) => y.id === x.id)?.inJail)
    if (jailed) sfx.jail()
    const before = p.players.find((x) => x.id === meId)?.cash
    const after = g.players.find((x) => x.id === meId)?.cash
    if (before !== undefined && after !== undefined && after !== before) (after > before ? sfx.coin : sfx.pay)()
  }, [g, meId])
}

export function GameScreen({
  state: live,
  status,
  send,
  onDone,
}: {
  state: StateView
  status: ConnStatus
  send: (m: ClientMessage) => void
  /** 看完结果回到房间 */
  onDone: () => void
}) {
  // 重庆火锅辣度跳动期间，先不揭晓扣钱
  const reveal = useSpiceReveal(live.game!)
  const state = { ...live, game: reveal.game }
  const g = state.game
  const me = g.players.find((p) => p.id === state.me.id)
  const alive = !!me && !me.bankrupt
  const [tab, setTab] = useState<Tab>('players')
  const [tile, setTile] = useState<number | null>(null)
  const [tradeWith, setTradeWith] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const over = g.phase === 'over'
  const cur = g.players[g.turn]!

  const myTrades = g.trades.filter((t) => t.from === state.me.id || t.to === state.me.id)
  const incoming = g.trades.filter((t) => t.to === state.me.id)

  // 收到新的交易请求时提醒
  const seen = useRef(new Set(incoming.map((t) => t.id)))
  useEffect(() => {
    for (const t of incoming) {
      if (seen.current.has(t.id)) continue
      seen.current.add(t.id)
      const from = g.players.find((p) => p.id === t.from)
      toast.info(`${from?.name} 向你提出交易`, { action: { label: '查看', onClick: () => setTab('trades') } })
    }
  }, [incoming, g.players])

  useGameSounds(g, state.me.id)
  const muted = useMuted()

  // 轮到自己时弹出提示并响一声（标签页在后台时也能看到标题变化）
  const myTurn = alive && cur.id === me!.id && !over
  const turnKey = myTurn && g.phase === 'roll' && !g.again ? (g.log.at(-1)?.id ?? 0) : 0
  const [bannerDone, setBannerDone] = useState(0)
  const banner = turnKey !== bannerDone ? turnKey : 0
  useEffect(() => {
    if (!turnKey) return
    sfx.turn()
    const t = setTimeout(() => setBannerDone(turnKey), 1600)
    return () => clearTimeout(t)
  }, [turnKey])
  useEffect(() => {
    const base = '大富翁'
    document.title = myTurn ? `轮到你了 - ${base}` : base
    return () => {
      document.title = base
    }
  }, [myTurn])

  const tabs: { key: Tab; label: string; icon: typeof Users; badge?: number }[] = [
    { key: 'players', label: '玩家', icon: Users },
    ...(me ? [{ key: 'assets' as const, label: '资产', icon: Wallet }] : []),
    ...(me ? [{ key: 'trades' as const, label: '交易', icon: ArrowLeftRight, badge: incoming.length }] : []),
    { key: 'log', label: '记录', icon: ScrollText },
  ]

  const leave = () =>
    setConfirm({
      title: '离开房间？',
      description: alive && !over ? '对局还在进行，离开后按破产处理，地产收归银行。' : undefined,
      confirmText: '离开',
      onConfirm: () => send({ type: 'leave' }),
    })

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1400px] flex-col gap-3 px-3 pb-4 safe-top lg:h-dvh lg:px-5">
      <header className="flex items-center gap-2 pt-1 text-paper">
        <Logo className="size-8" />
        <span className="font-display text-lg">房间 {state.room.code}</span>
        <ConnBadge status={status} className="text-paper/80" />
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-paper hover:bg-white/10 hover:text-paper"
            aria-label={muted ? '打开声音' : '静音'}
            onClick={() => setMuted(!muted)}
          >
            {muted ? <VolumeX /> : <Volume2 />}
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-paper hover:bg-white/10 hover:text-paper" asChild>
            <a href={`?overview=${state.room.code}`} target="_blank" rel="noreferrer" aria-label="大屏">
              <Tv />
            </a>
          </Button>
          {alive && !over && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-paper hover:bg-white/10 hover:text-paper"
              aria-label="认输"
              onClick={() =>
                setConfirm({
                  title: '认输？',
                  description: '你的地产会收归银行，之后只能观战。',
                  confirmText: '认输',
                  onConfirm: () => send({ type: 'bankrupt' }),
                })
              }
            >
              <FlagIcon />
            </Button>
          )}
          {state.me.isHost && !over && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-paper hover:bg-white/10 hover:text-paper"
              aria-label="结束对局"
              onClick={() =>
                setConfirm({
                  title: '结束对局？',
                  description: '按当前总资产排名。',
                  confirmText: '结束',
                  onConfirm: () => send({ type: 'abort' }),
                })
              }
            >
              <Power />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" className="text-paper hover:bg-white/10 hover:text-paper" aria-label="离开房间" onClick={leave}>
            <LogOut />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:justify-center">
        <div className="mx-auto w-full max-w-[calc(100dvh-5.5rem)] shrink-0 lg:mx-0 lg:w-[min(calc(100dvh-5.5rem),calc(100%-23rem))] lg:max-w-none">
          <Board game={g} onTileClick={setTile} highlight={g.phase === 'buy' ? cur.pos : null}>
            <TurnPanel state={state} spin={reveal.spin} spinStage={reveal.stage} send={send} confirm={setConfirm} onAssets={() => setTab('assets')} onDone={onDone} />
          </Board>
        </div>

        <aside className="flex min-h-0 flex-1 flex-col gap-2 lg:max-w-[26rem] lg:min-w-[20rem]">
          <div className="flex gap-1 rounded-xl bg-black/20 p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'relative flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 font-display text-sm transition',
                  tab === t.key ? 'bg-paper text-ink shadow-sm' : 'text-paper/80 hover:bg-white/10',
                )}
              >
                <t.icon className="size-4" />
                {t.label}
                {!!t.badge && <span className="absolute -top-1.5 -right-1 flex size-5 items-center justify-center rounded-full bg-brick text-[11px] text-white ring-2 ring-[#0c4a31]">{t.badge}</span>}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto lg:pr-1">
            {tab === 'players' && (
              <PlayersPanel
                state={state}
                onTrade={setTradeWith}
                onKick={
                  state.me.isHost
                    ? (id, name) =>
                        setConfirm({
                          title: `请出 ${name}？`,
                          description: '对局中请出的玩家按破产处理，地产收归银行。',
                          confirmText: '请出',
                          onConfirm: () => send({ type: 'kick', userId: id }),
                        })
                    : undefined
                }
              />
            )}
            {tab === 'assets' && me && <AssetsPanel game={g} me={me} send={send} onTile={setTile} />}
            {tab === 'trades' && me && (
              <div className="space-y-2">
                {myTrades.length === 0 && <div className="py-8 text-center text-sm text-paper/80">暂无交易</div>}
                {myTrades.map((t) => (
                  <TradeCard key={t.id} game={g} trade={t} meId={state.me.id} send={send} />
                ))}
              </div>
            )}
            {tab === 'log' && <LogPanel game={g} />}
          </div>
        </aside>
      </div>

      {banner > 0 && (
        <div key={banner} className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="animate-banner rounded-2xl bg-white/95 px-10 py-5 shadow-[0_20px_60px_-10px_rgb(0_0_0/0.5)]">
            <div className="font-display text-4xl text-brick">轮到你了</div>
          </div>
        </div>
      )}
      <TileDialog game={g} tile={tile} me={me} send={send} onClose={() => setTile(null)} />
      {me && <TradeDialog game={g} me={me} target={tradeWith} send={send} onClose={() => setTradeWith(null)} />}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  )
}
