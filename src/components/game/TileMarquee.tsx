import { BOARD, GROUP_COLOR, boardFor, type ThemeId } from '@shared/types'
import { TileMark } from '@/components/art/TileMark'
import { cn } from '@/lib/utils'

/** 一格小小的地产，样子和棋盘上的格子一样 */
function MiniTile({ index, theme }: { index: number; theme: ThemeId }) {
  const t = boardFor(theme)[index]!
  if (t.kind !== 'country') return null
  return (
    <div className="flex h-24 w-[4.5rem] shrink-0 flex-col overflow-hidden rounded-md border border-ink/20 bg-[#fdf9ee] shadow-[0_6px_14px_-6px_rgb(0_0_0/0.45)]">
      <div className="h-4 shrink-0 border-b border-ink/20" style={{ background: GROUP_COLOR[t.group] }} />
      <div className="flex flex-1 flex-col items-center justify-center gap-1 px-1">
        <TileMark tile={t} size={26} />
        <span className="text-[11px] leading-none font-medium text-ink">{t.name}</span>
        <span className="text-[10px] leading-none text-ink/60">${t.price}</span>
      </div>
    </div>
  )
}

const LANDS = BOARD.flatMap((t, i) => (t.kind === 'country' ? [i] : []))

/** 一条慢慢滚动的地产格子，首页做装饰 */
export function TileMarquee({ theme, reverse, className }: { theme: ThemeId; reverse?: boolean; className?: string }) {
  // 内容复制一份，滚到一半正好接上
  const row = [...LANDS, ...LANDS]
  return (
    <div className={cn('overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]', className)}>
      <div className={cn('flex w-max gap-3 py-2', reverse ? 'animate-[marquee_70s_linear_infinite_reverse]' : 'animate-[marquee_70s_linear_infinite]')}>
        {row.map((i, k) => (
          <MiniTile key={k} index={i} theme={theme} />
        ))}
      </div>
    </div>
  )
}
