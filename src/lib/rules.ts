import {
  BOARD,
  GROUP_COLOR,
  groupTiles,
  isBuyable,
  mortgageValue,
  unmortgageCost,
  type BuyableTile,
  type GamePlayer,
  type GameView,
  type Tile,
} from '@shared/types'

export const money = (n: number) => `$${n.toLocaleString('en-US')}`

/** 地产的小色块：国家用同色，航线和公用事业用固定色 */
export function tileSwatch(t: Tile) {
  if (t.kind === 'country') return GROUP_COLOR[t.group]
  if (t.kind === 'airline') return '#2b2118'
  return '#9aa3ad'
}

/** 前端用来决定显示哪些按钮，最终以服务端校验为准 */
export function ownsGroup(g: GameView, owner: string, tile: number) {
  const t = BOARD[tile]!
  return t.kind === 'country' && groupTiles(t.group).every((i) => g.owners[i]?.owner === owner)
}

export function canBuild(g: GameView, p: GamePlayer, tile: number) {
  const t = BOARD[tile]!
  const own = g.owners[tile]
  if (t.kind !== 'country' || !own || own.owner !== p.id || own.houses >= 5) return false
  if (!ownsGroup(g, p.id, tile)) return false
  const group = groupTiles(t.group)
  if (group.some((i) => g.owners[i]!.mortgaged)) return false
  return own.houses <= Math.min(...group.map((i) => g.owners[i]!.houses)) && p.cash >= t.house
}

export function canSell(g: GameView, p: GamePlayer, tile: number) {
  const t = BOARD[tile]!
  const own = g.owners[tile]
  if (t.kind !== 'country' || !own || own.owner !== p.id || own.houses === 0) return false
  return own.houses >= Math.max(...groupTiles(t.group).map((i) => g.owners[i]?.houses ?? 0))
}

export function canMortgage(g: GameView, p: GamePlayer, tile: number) {
  const t = BOARD[tile]!
  const own = g.owners[tile]
  if (!isBuyable(t) || !own || own.owner !== p.id || own.mortgaged) return false
  return t.kind !== 'country' || groupTiles(t.group).every((i) => (g.owners[i]?.houses ?? 0) === 0)
}

export function canUnmortgage(g: GameView, p: GamePlayer, tile: number) {
  const t = BOARD[tile]!
  const own = g.owners[tile]
  return isBuyable(t) && !!own && own.owner === p.id && own.mortgaged && p.cash >= unmortgageCost(t)
}

/** 总资产：现金 + 地价（抵押的按一半）+ 房子造价 */
export function worth(g: GameView, p: GamePlayer) {
  let total = p.cash
  for (const [key, o] of Object.entries(g.owners)) {
    if (o.owner !== p.id) continue
    const t = BOARD[Number(key)] as BuyableTile
    total += o.mortgaged ? mortgageValue(t) : t.price
    if (t.kind === 'country') total += o.houses * t.house
  }
  return total
}

/** 某人拥有的地，按棋盘顺序 */
export function ownedTiles(g: GameView, id: string) {
  return Object.entries(g.owners)
    .filter(([, o]) => o.owner === id)
    .map(([k]) => Number(k))
    .sort((a, b) => a - b)
}

/** 在不卖房、不抵押的情况下，最多还能凑出多少钱 */
export function liquidValue(g: GameView, p: GamePlayer) {
  let total = p.cash
  for (const i of ownedTiles(g, p.id)) {
    const t = BOARD[i] as BuyableTile
    const o = g.owners[i]!
    if (t.kind === 'country') total += (o.houses * t.house) / 2
    if (!o.mortgaged) total += mortgageValue(t)
  }
  return total
}
