import { Droplets, Plane, Zap } from 'lucide-react'
import {
  AIRLINE_RENT,
  BOARD,
  GROUP_COLOR,
  UTILITY_MULT,
  isBuyable,
  mortgageValue,
  type ClientMessage,
  type GamePlayer,
  type GameView,
} from '@shared/types'
import { Avatar } from '@/components/art/Avatar'
import { Flag } from '@/components/art/Flag'
import { Buildings } from '@/components/art/icons'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { money } from '@/lib/rules'
import { cn } from '@/lib/utils'
import { PropertyActions } from './PropertyActions'

function Row({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div className={cn('flex justify-between rounded px-2 py-0.5 text-sm', active && 'bg-gold/30 font-semibold')}>
      <span className="text-ink/70">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

/** 地产卡：租金表、主人和可以做的操作 */
export function TileDialog({
  game,
  tile,
  me,
  send,
  onClose,
}: {
  game: GameView
  tile: number | null
  me?: GamePlayer
  send: (m: ClientMessage) => void
  onClose: () => void
}) {
  const t = tile === null ? null : BOARD[tile]!
  const own = tile === null ? undefined : game.owners[tile]
  const owner = own ? game.players.find((p) => p.id === own.owner) : undefined
  const buyable = t && isBuyable(t)
  const ownedCount = (kind: 'airline' | 'utility') => (own ? BOARD.filter((x, i) => x.kind === kind && game.owners[i]?.owner === own.owner).length : 0)

  return (
    <Dialog open={tile !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="panel max-w-xs gap-3 overflow-hidden p-0">
        {t && tile !== null && (
          <>
            <DialogHeader
              className="gap-1 border-b-2 border-ink px-4 py-3"
              style={{ background: t.kind === 'country' ? GROUP_COLOR[t.group] : '#f1e7cf' }}
            >
              <DialogTitle className={cn('flex items-center justify-center gap-2 font-display text-2xl', t.kind === 'country' && 'text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.35)]')}>
                {t.kind === 'country' && <Flag iso={t.iso} className="w-8" />}
                {t.kind === 'airline' && <Plane className="size-6 text-[#1c63c9]" />}
                {t.kind === 'utility' && (t.name.includes('电') ? <Zap className="size-6 fill-gold" /> : <Droplets className="size-6 fill-[#7cc8f0] text-[#1c63c9]" />)}
                {t.name}
              </DialogTitle>
              <DialogDescription className={cn('text-center', t.kind === 'country' ? 'text-white/90' : 'text-ink/70')}>
                {buyable ? `售价 ${money(t.price)}` : t.kind === 'tax' ? `缴纳 ${money(t.amount)}` : ' '}
              </DialogDescription>
            </DialogHeader>

            {buyable && (
              <div className="space-y-0.5 px-3">
                {t.kind === 'country' && (
                  <>
                    <Row label="空地" value={money(t.rent[0])} active={!!own && own.houses === 0} />
                    <Row label="集齐同色" value={money(t.rent[0] * 2)} />
                    {[1, 2, 3, 4].map((h) => (
                      <Row key={h} label={`${h} 栋房子`} value={money(t.rent[h]!)} active={own?.houses === h} />
                    ))}
                    <Row label="酒店" value={money(t.rent[5])} active={own?.houses === 5} />
                    <div className="my-1 border-t border-dashed border-ink/30" />
                    <Row label="每栋房子" value={money(t.house)} />
                  </>
                )}
                {t.kind === 'airline' &&
                  AIRLINE_RENT.map((r, i) => <Row key={i} label={`拥有 ${i + 1} 条航线`} value={money(r)} active={ownedCount('airline') === i + 1} />)}
                {t.kind === 'utility' &&
                  UTILITY_MULT.map((m, i) => <Row key={i} label={`拥有 ${i + 1} 家`} value={`点数 × ${m}`} active={ownedCount('utility') === i + 1} />)}
                <Row label="抵押" value={money(mortgageValue(t))} />
              </div>
            )}

            {buyable && (
              <div className="flex items-center gap-2 border-t border-ink/10 bg-paper px-3 py-2.5">
                {owner ? (
                  <>
                    <Avatar index={owner.avatar} size={28} ring={owner.color} />
                    <span className="font-medium">{owner.name}</span>
                    {own && own.houses > 0 && <Buildings houses={own.houses} className="h-4" />}
                    {own?.mortgaged && <span className="ml-auto rounded bg-ink px-1.5 text-xs text-paper">抵押中</span>}
                  </>
                ) : (
                  <span className="text-sm text-ink/60">无主</span>
                )}
              </div>
            )}

            {me && <div className="px-3 pb-3 empty:hidden"><PropertyActions game={game} me={me} tile={tile} send={send} /></div>}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
