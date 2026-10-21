import { AVATARS } from '@shared/types'
import { cn } from '@/lib/utils'

function avatarOf(i: number) {
  return AVATARS[((i % AVATARS.length) + AVATARS.length) % AVATARS.length]!
}

const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'

/** 玩家头像：圆形色块上的 emoji，ring 为玩家代表色 */
export function Avatar({
  index,
  size = 40,
  ring,
  className,
  style,
}: {
  index: number
  /** 像素尺寸；传 null 时由 className 或 style 控制大小 */
  size?: number | null
  ring?: string
  className?: string
  style?: React.CSSProperties
}) {
  const a = avatarOf(index)
  return (
    <div
      className={cn('relative shrink-0 overflow-hidden rounded-full border-2 border-ink', className)}
      style={{
        ...(size !== null ? { width: size, height: size } : {}),
        background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${a.bg} 55%, white), ${a.bg} 70%)`,
        boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
        ...style,
      }}
    >
      {/* 用 SVG 文字居中：emoji 字体的基线各不相同，按文字排版会偏上或偏下 */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full select-none" aria-hidden>
        <text x="50" y="54" textAnchor="middle" dominantBaseline="central" fontSize="60" fontFamily={EMOJI_FONT}>
          {a.e}
        </text>
      </svg>
    </div>
  )
}
