import { Hammer, HandCoins, Landmark, Undo2 } from 'lucide-react'
import { boardFor, mortgageValue, unmortgageCost, type BuyableTile, type ClientMessage, type GamePlayer, type GameView } from '@shared/types'
import { Button } from '@/components/ui/button'
import { canBuild, canMortgage, canSell, canUnmortgage, money } from '@/lib/rules'

/** 自己的地上可以做的操作：盖房、卖房、抵押、赎回 */
export function PropertyActions({ game, me, tile, send }: { game: GameView; me: GamePlayer; tile: number; send: (m: ClientMessage) => void }) {
  const cur = game.players[game.turn]
  const myTurn = cur?.id === me.id && !me.bankrupt
  const t = boardFor(game.theme)[tile] as BuyableTile
  const own = game.owners[tile]
  if (!own || own.owner !== me.id || !myTurn) return null
  // 盖房和赎回要在没有待决定的事的时候，卖房和抵押欠款时也可以
  const calm = game.phase === 'roll' || game.phase === 'end'
  const liquidate = game.phase !== 'buy' && game.phase !== 'over'
  const actions = [
    calm && canBuild(game, me, tile) && t.kind === 'country' && (
      <Button key="b" size="xs" variant="green" onClick={() => send({ type: 'build', tile })}>
        <Hammer /> {own.houses === 4 ? '升酒店' : '盖房'} {money(t.house)}
      </Button>
    ),
    liquidate && canSell(game, me, tile) && t.kind === 'country' && (
      <Button key="s" size="xs" variant="paper" onClick={() => send({ type: 'sell', tile })}>
        <HandCoins /> 卖房 +{money(t.house / 2)}
      </Button>
    ),
    liquidate && canMortgage(game, me, tile) && (
      <Button key="m" size="xs" variant="paper" onClick={() => send({ type: 'mortgage', tile })}>
        <Landmark /> 抵押 +{money(mortgageValue(t))}
      </Button>
    ),
    calm && canUnmortgage(game, me, tile) && (
      <Button key="u" size="xs" variant="gold" onClick={() => send({ type: 'unmortgage', tile })}>
        <Undo2 /> 赎回 {money(unmortgageCost(t))}
      </Button>
    ),
  ].filter(Boolean)
  if (!actions.length) return null
  return <div className="flex flex-wrap gap-1.5">{actions}</div>
}
