import { cn } from '@/lib/utils'

/** 城市的标记：像印章一样的圆，里面是省份简称 */
/** 浅色底上用深色字 */
function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b > 165
}

export function CityBadge({ badge, color, className, style }: { badge: string; color: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span
      className={cn('flex aspect-square shrink-0 items-center justify-center rounded-full font-display leading-none', isLight(color) ? 'text-ink' : 'text-white', className)}
      style={{ background: color, boxShadow: `inset 0 0 0 1.5px rgb(255 255 255 / 0.55), 0 0 0 1px ${color}`, ...style }}
    >
      {badge}
    </span>
  )
}
