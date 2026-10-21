import type { FlagComponent } from 'country-flag-icons/react/3x2'
import { AR, AU, BR, CA, CN, DE, EG, ES, FR, GB, IN, IT, JP, KR, MX, RU, SG, TH, TR, US, VN, ZA } from 'country-flag-icons/react/3x2'
import { cn } from '@/lib/utils'

// 只引入棋盘上用到的国旗，避免把整个国旗库打进包里
const FLAGS: Record<string, FlagComponent> = {
  AR, AU, BR, CA, CN, DE, EG, ES, FR, GB, IN, IT, JP, KR, MX, RU, SG, TH, TR, US, VN, ZA,
}

export function Flag({ iso, className }: { iso: string; className?: string }) {
  const F = FLAGS[iso]
  if (!F) return null
  return <F className={cn('block aspect-[3/2] rounded-[2px] shadow-[0_0_0_1px_rgb(0_0_0/0.25)]', className)} />
}
