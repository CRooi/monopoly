import { CupSoda, FerrisWheel, Flame, Shovel, Snowflake, Soup, Sparkles } from 'lucide-react'
import type { EggKind } from '@shared/types'
import { cn } from '@/lib/utils'

const ICONS = {
  hotpot: { Icon: Flame, cls: 'fill-[#ff6b35] text-[#d63c2f]', bg: '#fff0eb' },
  slide: { Icon: Snowflake, cls: 'text-[#1c7ed6]', bg: '#e7f5ff' },
  wheel: { Icon: FerrisWheel, cls: 'text-[#e64980]', bg: '#fff0f6' },
  dig: { Icon: Shovel, cls: 'text-[#8b5a2b]', bg: '#fff4e6' },
  dimsum: { Icon: Soup, cls: 'text-[#c4975b]', bg: '#fff9db' },
  milktea: { Icon: CupSoda, cls: 'text-[#a0522d]', bg: '#fff4e6' },
  bless: { Icon: Sparkles, cls: 'fill-[#ffd43b] text-[#c99400]', bg: '#fff9db' },
} satisfies Record<EggKind, unknown>

/** 揭晓后的彩蛋标记：每种彩蛋一个图标 */
export function EggMark({ kind, className, iconClassName }: { kind: EggKind; className?: string; iconClassName?: string }) {
  const { Icon, cls, bg } = ICONS[kind]
  return (
    <span className={cn('flex items-center justify-center rounded-full', className)} style={{ background: bg }}>
      <Icon className={cn(cls, iconClassName)} />
    </span>
  )
}
