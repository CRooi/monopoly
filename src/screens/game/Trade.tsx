import { useState } from 'react'
import { ArrowLeftRight, Check, KeyRound, X } from 'lucide-react'
import { BOARD, groupTiles, type ClientMessage, type GamePlayer, type GameView, type Trade, type TradeSide } from '@shared/types'
import { Avatar } from '@/components/art/Avatar'
import { Flag } from '@/components/art/Flag'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { money, ownedTiles, tileSwatch } from '@/lib/rules'
import { cn } from '@/lib/utils'

const EMPTY: TradeSide = { cash: 0, tiles: [], jailCards: 0 }

/** 同色还有房子的地不能交易 */
function tradable(g: GameView, id: string) {
  return ownedTiles(g, id).filter((i) => {
    const t = BOARD[i]!
    return t.kind !== 'country' || groupTiles(t.group).every((j) => (g.owners[j]?.houses ?? 0) === 0)
  })
}

function TileChip({ g, tile, on, onClick }: { g: GameView; tile: number; on?: boolean; onClick?: () => void }) {
  const t = BOARD[tile]!
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs transition',
        on ? 'border-[#c99400] bg-gold/50' : 'border-ink/15 bg-white',
        g.owners[tile]?.mortgaged && 'italic text-ink/60',
      )}
    >
      <span className="h-3 w-1 rounded-sm" style={{ background: tileSwatch(t) }} />
      {t.kind === 'country' && <Flag iso={t.iso} className="w-4" />}
      {t.name}
    </button>
  )
}

function SideEditor({
  g,
  p,
  value,
  onChange,
}: {
  g: GameView
  p: GamePlayer
  value: TradeSide
  onChange: (v: TradeSide) => void
}) {
  const tiles = tradable(g, p.id)
  const toggle = (i: number) =>
    onChange({ ...value, tiles: value.tiles.includes(i) ? value.tiles.filter((x) => x !== i) : [...value.tiles, i] })
  return (
    <div className="space-y-2 rounded-lg border border-ink/10 bg-paper/70 p-2">
      <div className="flex items-center gap-2">
        <Avatar index={p.avatar} size={24} ring={p.color} />
        <span className="font-medium">{p.name}</span>
        <span className="ml-auto text-xs text-ink/60">现金 {money(p.cash)}</span>
      </div>
      {tiles.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tiles.map((i) => (
            <TileChip key={i} g={g} tile={i} on={value.tiles.includes(i)} onClick={() => toggle(i)} />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-sm">$</span>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={p.cash}
          value={value.cash || ''}
          placeholder="0"
          onChange={(e) => onChange({ ...value, cash: Math.max(0, Math.min(p.cash, Math.floor(Number(e.target.value) || 0))) })}
          className="h-8 w-28 bg-white"
        />
        {p.jailCards > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...value, jailCards: value.jailCards ? 0 : 1 })}
            className={cn('ml-auto flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs', value.jailCards ? 'border-[#c99400] bg-gold/50' : 'border-ink/15 bg-white')}
          >
            <KeyRound className="size-3" /> 出狱卡
          </button>
        )}
      </div>
    </div>
  )
}

/** 发起交易：选自己给出的和想要的 */
export function TradeDialog({
  game,
  me,
  target,
  send,
  onClose,
}: {
  game: GameView
  me: GamePlayer
  target: string | null
  send: (m: ClientMessage) => void
  onClose: () => void
}) {
  const other = game.players.find((p) => p.id === target)
  const [give, setGive] = useState<TradeSide>(EMPTY)
  const [get, setGet] = useState<TradeSide>(EMPTY)
  const empty = !give.cash && !give.tiles.length && !give.jailCards && !get.cash && !get.tiles.length && !get.jailCards
  const close = () => {
    setGive(EMPTY)
    setGet(EMPTY)
    onClose()
  }
  return (
    <Dialog open={!!other} onOpenChange={(o) => !o && close()}>
      <DialogContent className="panel max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <ArrowLeftRight className="size-5" /> 和 {other?.name} 交易
          </DialogTitle>
        </DialogHeader>
        {other && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-ink/70">你给出</div>
            <SideEditor g={game} p={me} value={give} onChange={setGive} />
            <div className="text-sm font-medium text-ink/70">你想要</div>
            <SideEditor g={game} p={other} value={get} onChange={setGet} />
            <Button
              variant="red"
              size="lg2"
              className="mt-2 w-full"
              disabled={empty}
              onClick={() => {
                send({ type: 'tradePropose', to: other.id, give, get })
                close()
              }}
            >
              发出交易
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SideSummary({ g, s }: { g: GameView; s: TradeSide }) {
  if (!s.cash && !s.tiles.length && !s.jailCards) return <span className="text-xs text-ink/50">无</span>
  return (
    <div className="flex flex-wrap gap-1">
      {s.tiles.map((i) => (
        <TileChip key={i} g={g} tile={i} />
      ))}
      {s.cash > 0 && <span className="rounded-md bg-cash px-1.5 py-0.5 text-xs text-white">{money(s.cash)}</span>}
      {s.jailCards > 0 && (
        <span className="flex items-center gap-1 rounded-md bg-ink px-1.5 py-0.5 text-xs text-paper">
          <KeyRound className="size-3" /> 出狱卡
        </span>
      )}
    </div>
  )
}

/** 一笔交易：收到的可以接受或拒绝，发出的可以撤回 */
export function TradeCard({ game, trade, meId, send }: { game: GameView; trade: Trade; meId: string; send: (m: ClientMessage) => void }) {
  const from = game.players.find((p) => p.id === trade.from)!
  const to = game.players.find((p) => p.id === trade.to)!
  const incoming = trade.to === meId
  return (
    <div className={cn('panel-flat space-y-2 p-3', incoming && 'bg-[#fff8dc] ring-2 ring-gold')}>
      <div className="flex items-center gap-2 text-sm">
        <Avatar index={from.avatar} size={22} ring={from.color} />
        <span className="font-medium">{from.name}</span>
        <ArrowLeftRight className="size-3.5 text-ink/50" />
        <Avatar index={to.avatar} size={22} ring={to.color} />
        <span className="font-medium">{to.name}</span>
      </div>
      <div className="grid grid-cols-[auto_1fr] items-start gap-x-2 gap-y-1 text-xs">
        <span className="pt-0.5 text-ink/60">{from.name} 给</span>
        <SideSummary g={game} s={trade.give} />
        <span className="pt-0.5 text-ink/60">{to.name} 给</span>
        <SideSummary g={game} s={trade.get} />
      </div>
      {incoming ? (
        <div className="flex gap-2">
          <Button size="sm" variant="green" onClick={() => send({ type: 'tradeRespond', id: trade.id, accept: true })}>
            <Check /> 接受
          </Button>
          <Button size="sm" variant="paper" onClick={() => send({ type: 'tradeRespond', id: trade.id, accept: false })}>
            <X /> 拒绝
          </Button>
        </div>
      ) : trade.from === meId ? (
        <Button size="sm" variant="paper" onClick={() => send({ type: 'tradeCancel', id: trade.id })}>
          撤回
        </Button>
      ) : null}
    </div>
  )
}
