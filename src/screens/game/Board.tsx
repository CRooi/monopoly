import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CircleParking, Droplets, Flame, Gem, Plane, Receipt, Siren, TrainFront, Zap } from 'lucide-react'
import { BOARD, GROUP_COLOR, boardFor, themeOf, JAIL_POS, type GamePlayer, type GameView, type Ownership, type Tile } from '@shared/types'
import { Avatar } from '@/components/art/Avatar'
import { CityBadge } from '@/components/art/CityBadge'
import { CityIcon } from '@/components/art/CityIcon'
import { Flag } from '@/components/art/Flag'
import { Buildings, ChanceMark, Chest, EasterEgg, GoArrow, JailBars, PrizeRays } from '@/components/art/icons'
import { DeltaPop } from '@/components/game/CashTicker'
import { sfx } from '@/lib/sound'
import { cn } from '@/lib/utils'

/** 棋子走一格的动画时长 */
const STEP_MS = 200

/** 角上格子的宽度（普通格子为 1） */
const CORNER = 1.55
const TOTAL = CORNER * 2 + 9

type Side = 'bottom' | 'left' | 'top' | 'right' | 'corner'

/** 第 i 格在 11×11 网格里的行列（从 1 开始） */
function gridOf(i: number): { row: number; col: number; side: Side } {
  if (i % 10 === 0) {
    const corner = [
      { row: 11, col: 11 },
      { row: 11, col: 1 },
      { row: 1, col: 1 },
      { row: 1, col: 11 },
    ][i / 10]!
    return { ...corner, side: 'corner' }
  }
  if (i < 10) return { row: 11, col: 11 - i, side: 'bottom' }
  if (i < 20) return { row: 21 - i, col: 1, side: 'left' }
  if (i < 30) return { row: 1, col: i - 19, side: 'top' }
  return { row: i - 29, col: 11, side: 'right' }
}

/** 网格第 k 条轨道的起止位置（以 TOTAL 为全长） */
function track(k: number): [number, number] {
  if (k === 1) return [0, CORNER]
  if (k === 11) return [CORNER + 9, TOTAL]
  return [CORNER + k - 2, CORNER + k - 1]
}

/** 第 i 格的中心点，单位为棋盘边长的百分比 */
function centerOf(i: number) {
  const { row, col } = gridOf(i)
  const [x0, x1] = track(col)
  const [y0, y1] = track(row)
  return { x: ((x0 + x1) / 2 / TOTAL) * 100, y: ((y0 + y1) / 2 / TOTAL) * 100 }
}

const BAR_SIDE: Record<Exclude<Side, 'corner'>, string> = {
  bottom: 'flex-col',
  top: 'flex-col-reverse',
  left: 'flex-row-reverse',
  right: 'flex-row',
}

function TileFace({ tile, side, pot }: { tile: Tile; side: Side; pot: number }) {
  const horizontal = side === 'left' || side === 'right'
  const label = <span className="line-clamp-2 text-center text-[1.6cqw] leading-[1.15] font-medium">{tile.name}</span>
  const icon = (node: ReactNode) => <span className="flex size-[3.6cqw] items-center justify-center [&_svg]:size-full">{node}</span>
  const price = (n: number) => <span className="text-[1.5cqw] leading-none font-semibold tabular-nums text-ink/80">${n}</span>
  const wrap = (children: ReactNode) => (
    <div className={cn('flex min-h-0 min-w-0 flex-1 items-center justify-center gap-[0.4cqw] p-[0.3cqw]', horizontal ? 'flex-row' : 'flex-col')}>{children}</div>
  )

  switch (tile.kind) {
    case 'go':
      return (
        <div className="flex size-full flex-col items-center justify-center gap-[0.5cqw] bg-[#fff3d6] p-[0.6cqw]">
          <span className="text-[1.7cqw] leading-none text-ink/70">领取 $200</span>
          <span className="font-display text-[3.4cqw] leading-none text-brick">起点</span>
          <GoArrow className="w-[9cqw]" />
        </div>
      )
    case 'jail':
      return (
        <div className="relative size-full bg-[#fff3d6]">
          <div className="absolute top-0 right-0 flex h-[66%] w-[66%] flex-col items-center justify-center gap-[0.3cqw] border-b-2 border-l-2 border-ink bg-[#ffe9a8]">
            <JailBars className="size-[5.2cqw]" />
            <span className="font-display text-[1.8cqw] leading-none">监狱</span>
          </div>
          <span className="absolute bottom-[3%] left-[4%] text-[1.4cqw] leading-none text-ink/60">探监</span>
        </div>
      )
    case 'parking':
      return (
        <div className="flex size-full flex-col items-center justify-center gap-[0.5cqw] bg-[#fff3d6]">
          <CircleParking className="size-[6cqw] text-brick" strokeWidth={2.4} />
          <span className="font-display text-[1.9cqw] leading-none">免费停车</span>
          {pot > 0 && <span className="rounded-full bg-cash px-[0.8cqw] text-[1.5cqw] text-white">${pot}</span>}
        </div>
      )
    case 'gotojail':
      return (
        <div className="flex size-full flex-col items-center justify-center gap-[0.5cqw] bg-[#fff3d6]">
          <Siren className="size-[6cqw] text-[#1c4fb8]" strokeWidth={2.4} />
          <span className="font-display text-[2.2cqw] leading-none">入狱</span>
        </div>
      )
    case 'chance':
      return wrap(
        <>
          {icon(<ChanceMark />)}
          {label}
        </>,
      )
    case 'chest':
      return wrap(
        <>
          {icon(<Chest />)}
          {label}
        </>,
      )
    case 'tax':
      return wrap(
        <>
          {icon(tile.amount >= 200 ? <Receipt className="text-ink" /> : <Gem className="text-[#ae3ec9]" />)}
          <div className="flex flex-col items-center gap-[0.3cqw]">
            {label}
            {price(tile.amount)}
          </div>
        </>,
      )
    case 'airline':
      return wrap(
        <>
          {icon(tile.name.includes('高铁') ? <TrainFront className="text-brick" /> : <Plane className="text-[#1c63c9]" />)}
          <div className="flex flex-col items-center gap-[0.3cqw]">
            {label}
            {price(tile.price)}
          </div>
        </>,
      )
    case 'utility':
      return wrap(
        <>
          {icon(tile.name.includes('电') ? <Zap className="fill-gold text-ink" /> : <Droplets className="fill-[#7cc8f0] text-[#1c63c9]" />)}
          <div className="flex flex-col items-center gap-[0.3cqw]">
            {label}
            {price(tile.price)}
          </div>
        </>,
      )
    case 'country':
      return wrap(
        <>
          {tile.iso ? (
            <Flag iso={tile.iso} className={horizontal ? 'w-[3.6cqw]' : 'w-[3.8cqw]'} />
          ) : (
            <CityIcon
              name={tile.name}
              className="w-[4.4cqw]"
              fallback={<CityBadge badge={tile.badge ?? tile.name[0]!} color={GROUP_COLOR[tile.group]} className="w-[3.4cqw] text-[1.9cqw]" />}
            />
          )}
          <div className="flex flex-col items-center gap-[0.3cqw]">
            {label}
            {price(tile.price)}
          </div>
        </>,
      )
  }
}

function TileCell({
  index,
  tile,
  special,
  own,
  ownerColor,
  pot,
  highlight,
  onClick,
}: {
  index: number
  tile: Tile
  /** 这一格藏着彩蛋（重庆火锅）：没揭晓时角上一颗金箔彩蛋，揭晓后换成火苗 */
  special?: 'hidden' | 'revealed'
  own?: Ownership
  ownerColor?: string
  pot: number
  highlight: boolean
  onClick?: (i: number) => void
}) {
  const { row, col, side } = gridOf(index)
  const bar = tile.kind === 'country' && side !== 'corner'
  return (
    <button
      type="button"
      onClick={() => onClick?.(index)}
      style={{
        gridRow: row,
        gridColumn: col,
        ...(ownerColor ? { backgroundColor: `color-mix(in srgb, ${ownerColor} 11%, #fdf9ee)` } : {}),
      }}
      className={cn(
        'relative flex min-h-0 min-w-0 overflow-hidden border-[0.5px] border-ink/25 bg-[#fdf9ee] text-ink transition-[filter] hover:brightness-[0.97]',
        side !== 'corner' && BAR_SIDE[side],
        highlight && 'z-10 outline-[0.5cqw] outline-gold outline-solid',
      )}
    >
      {bar && (
        <div
          className={cn(
            'flex shrink-0 items-center justify-center border-ink/25',
            side === 'bottom' && 'h-[24%] w-full border-b',
            side === 'top' && 'h-[24%] w-full border-t',
            side === 'left' && 'h-full w-[24%] border-l',
            side === 'right' && 'h-full w-[24%] border-r',
          )}
          style={{ background: GROUP_COLOR[tile.group] }}
        >
          {own && own.houses > 0 && (
            <Buildings houses={own.houses} className={cn('p-[8%]', (side === 'left' || side === 'right') && 'rotate-90')} />
          )}
        </div>
      )}
      <TileFace tile={tile} side={side} pot={pot} />
      {special === 'revealed' && (
        <span className="pointer-events-none absolute top-[0.4cqw] right-[0.4cqw] z-10 flex size-[2.6cqw] items-center justify-center rounded-full bg-[#fff0eb] shadow-[0_0_0.8cqw_rgb(255_107_53/0.8)] animate-[heartbeat_1.6s_ease-in-out_infinite]">
          <Flame className="size-[1.9cqw] fill-[#ff6b35] text-[#d63c2f]" />
        </span>
      )}
      {special === 'hidden' && (
        <>
          {/* 彩蛋还没揭晓：角上一颗金箔巧克力蛋，背后的金光慢慢转 */}
          <span className="pointer-events-none absolute top-[0.2cqw] right-[0.2cqw] z-10 flex size-[3.6cqw] items-center justify-center">
            <PrizeRays className="absolute inset-[-35%] opacity-80" />
            <EasterEgg className="relative w-[2.5cqw] drop-shadow-[0_0.2cqw_0.3cqw_rgb(0_0_0/0.35)]" />
          </span>
        </>
      )}
      {ownerColor && side !== 'corner' && (
        <div
          className={cn(
            'pointer-events-none absolute',
            side === 'bottom' && 'inset-x-0 bottom-0 h-[0.65cqw]',
            side === 'top' && 'inset-x-0 top-0 h-[0.65cqw]',
            side === 'left' && 'inset-y-0 left-0 w-[0.65cqw]',
            side === 'right' && 'inset-y-0 right-0 w-[0.65cqw]',
          )}
          style={{ background: ownerColor }}
        />
      )}
      {own?.mortgaged && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[repeating-linear-gradient(135deg,rgb(43_33_24/0.18)_0_3px,transparent_3px_8px)]">
          <span className="rounded-sm bg-ink/80 px-[0.5cqw] text-[1.4cqw] text-paper">抵押</span>
        </div>
      )}
    </button>
  )
}

/** 棋子逐格走到目标位置；进监狱等跳跃式移动直接到位 */
function useAnimatedPositions(players: GamePlayer[], sound: boolean) {
  const initial = () => Object.fromEntries(players.map((p) => [p.id, p.pos]))
  const [shown, setShown] = useState<Record<string, number>>(initial)
  const cur = useRef<Record<string, number>>(shown)
  const prevJail = useRef<Record<string, boolean>>({})

  const key = players.map((p) => `${p.id}:${p.pos}:${p.inJail ? 1 : 0}`).join(',')
  useEffect(() => {
    const targets: Record<string, { pos: number; jump: boolean }> = {}
    for (const p of players) {
      targets[p.id] = { pos: p.pos, jump: p.inJail && prevJail.current[p.id] === false }
      prevJail.current[p.id] = p.inJail
    }
    const ahead = (id: string) => (targets[id]!.pos - (cur.current[id] ?? targets[id]!.pos) + BOARD.length) % BOARD.length
    // 掷骰的步数按正常速度走；卡片带来的长距离前进走快一些
    const far = Object.keys(targets).some((id) => !targets[id]!.jump && ahead(id) > 12)
    const stepMs = far ? 70 : STEP_MS
    /** 走一步，返回是否还有棋子没到位 */
    const tick = () => {
      const next = { ...cur.current }
      let moving = false
      let stepped = false
      for (const [id, t] of Object.entries(targets)) {
        const from = next[id] ?? t.pos
        if (from === t.pos) {
          next[id] = t.pos
          continue
        }
        // 进监狱直接到位；后退几格（机会卡）也直接到位，其余一格一格往前走
        const back = (from - t.pos + BOARD.length) % BOARD.length <= 3
        if (t.jump || back) next[id] = t.pos
        else {
          next[id] = (from + 1) % BOARD.length
          stepped = true
        }
        if (next[id] !== t.pos) moving = true
      }
      if (stepped && sound && !far) sfx.step()
      cur.current = next
      setShown(next)
      return moving
    }
    if (!tick()) return
    const timer = setInterval(() => {
      if (!tick()) clearInterval(timer)
    }, stepMs)
    return () => clearInterval(timer)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return shown
}

export function Board({
  game,
  onTileClick,
  highlight,
  children,
  className,
  quiet,
}: {
  game: GameView
  /** 不播放走棋的声音（回放时） */
  quiet?: boolean
  onTileClick?: (i: number) => void
  /** 需要突出显示的格子 */
  highlight?: number | null
  /** 棋盘中央的内容 */
  children?: ReactNode
  className?: string
}) {
  const shown = useAnimatedPositions(game.players, !quiet)
  const colorOf = Object.fromEntries(game.players.map((p) => [p.id, p.color]))
  const current = game.players[game.turn]

  // 同一格的棋子错开摆放；在监狱里的放进铁栏，探监的放在边上
  const groups = new Map<string, GamePlayer[]>()
  for (const p of game.players) {
    if (p.bankrupt) continue
    const pos = shown[p.id] ?? p.pos
    const k = `${pos}:${pos === JAIL_POS && p.inJail ? 'in' : 'out'}`
    groups.set(k, [...(groups.get(k) ?? []), p])
  }

  return (
    <div className={cn('board relative aspect-square w-full rounded-[1.6cqw] bg-[#1d3328] p-[0.7cqw] shadow-[0_0.4cqw_0_#12221a,0_3cqw_6cqw_-2cqw_rgb(0_0_0/0.55)]', className)}>
      <div
        className="grid size-full overflow-hidden rounded-[1cqw] bg-[#fdf9ee]"
        style={{
          gridTemplateColumns: `${CORNER}fr repeat(9, 1fr) ${CORNER}fr`,
          gridTemplateRows: `${CORNER}fr repeat(9, 1fr) ${CORNER}fr`,
        }}
      >
        {boardFor(game.theme).map((tile, i) => (
          <TileCell
            key={i}
            index={i}
            tile={tile}
            special={themeOf(game.theme).spicy === i ? (game.spiceSeen ? 'revealed' : 'hidden') : undefined}
            own={game.owners[i]}
            ownerColor={game.owners[i] ? colorOf[game.owners[i]!.owner] : undefined}
            pot={game.pot}
            highlight={highlight === i}
            onClick={onTileClick}
          />
        ))}
        <div className="relative flex min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden" style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,#eef7ef,#d5e9da)]" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="-rotate-45 font-display text-[13cqw] whitespace-nowrap text-[#1f8a4c]/[0.07]">大富翁</span>
          </div>
          <div className="relative flex size-full min-h-0 flex-col items-center justify-center">{children}</div>
        </div>
      </div>

      {/* 棋子 */}
      {[...groups.entries()].flatMap(([k, list]) => {
        const [posStr, where] = k.split(':')
        const pos = Number(posStr)
        const c = centerOf(pos)
        // 监狱格：铁栏在右上角，探监在左下边缘
        if (pos === JAIL_POS) {
          const d = where === 'in' ? 2.2 : -2.6
          c.x += d
          c.y -= d
        }
        const size = 4.4
        const cols = list.length > 4 ? 3 : 2
        return list.map((p, n) => {
          const single = list.length === 1
          const dx = single ? 0 : ((n % cols) - (cols - 1) / 2) * size * 0.62
          const dy = single ? 0 : (Math.floor(n / cols) - (Math.ceil(list.length / cols) - 1) / 2) * size * 0.62
          const active = p.id === current?.id && game.phase !== 'over'
          return (
            <div
              key={p.id}
              className="pointer-events-none absolute transition-[left,top] duration-200 ease-out"
              style={{
                left: `calc(${c.x}% + ${dx}cqw)`,
                top: `calc(${c.y}% + ${dy}cqw)`,
                zIndex: active ? 30 : 20,
              }}
            >
              <Avatar
                index={p.avatar}
                size={null}
                ring={p.color}
                className={cn('-translate-x-1/2 -translate-y-1/2 border-[0.3cqw] border-white shadow-[0_0.3cqw_0.8cqw_rgb(0_0_0/0.35)]', active && 'animate-pulse-ring')}
                style={{ width: `${size}cqw`, height: `${size}cqw` }}
              />
              <DeltaPop value={p.cash} className="-top-[6.5cqw] text-[1.9cqw]" />
            </div>
          )
        })
      })}
    </div>
  )
}
