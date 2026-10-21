import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

type P = SVGProps<SVGSVGElement>

/** 标志：绿色底板上的米色骰面 */
export function Logo({ className, ...p }: P) {
  return (
    <svg viewBox="0 0 64 64" className={className} {...p}>
      <rect x="3" y="6" width="58" height="56" rx="13" fill="#2b2118" />
      <rect x="3" y="3" width="58" height="56" rx="13" fill="#1f8a4c" stroke="#2b2118" strokeWidth="2.5" />
      <rect x="13" y="12" width="38" height="38" rx="8" fill="#fbf5e6" stroke="#2b2118" strokeWidth="2.5" />
      <circle cx="23" cy="22" r="4.2" fill="#d63c2f" />
      <circle cx="32" cy="31" r="4.2" fill="#d63c2f" />
      <circle cx="41" cy="40" r="4.2" fill="#d63c2f" />
    </svg>
  )
}

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
}

/** 骰子 */
export function Die({ value, className, ...p }: P & { value: number }) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...p}>
      <rect x="4" y="8" width="92" height="88" rx="18" fill="#2b2118" />
      <rect x="4" y="4" width="92" height="88" rx="18" fill="#fffdf6" stroke="#2b2118" strokeWidth="5" />
      {(PIPS[value] ?? []).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y - 2} r="8.5" fill={value === 1 ? '#d63c2f' : '#2b2118'} />
      ))}
    </svg>
  )
}

/** 监狱的铁栏 */
export function JailBars({ className, ...p }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...p}>
      <rect x="4" y="4" width="40" height="40" rx="4" fill="#f2b705" stroke="#2b2118" strokeWidth="3" />
      <rect x="9" y="9" width="30" height="30" fill="#2b2118" opacity="0.15" />
      {[13, 20, 27, 34].map((x) => (
        <rect key={x} x={x} y="6" width="3" height="36" fill="#2b2118" />
      ))}
      <rect x="6" y="22" width="36" height="3" fill="#2b2118" />
    </svg>
  )
}

/** 命运：宝箱 */
export function Chest({ className, ...p }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...p}>
      <path d="M6 20 Q6 8 24 8 Q42 8 42 20 Z" fill="#c9792c" stroke="#2b2118" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="6" y="20" width="36" height="20" rx="2" fill="#a85f1f" stroke="#2b2118" strokeWidth="2.5" />
      <rect x="6" y="20" width="36" height="4" fill="#f2b705" stroke="#2b2118" strokeWidth="2" />
      <rect x="20" y="18" width="8" height="10" rx="1.5" fill="#f2b705" stroke="#2b2118" strokeWidth="2" />
      <circle cx="24" cy="24" r="1.4" fill="#2b2118" />
    </svg>
  )
}

/** 机会：问号 */
export function ChanceMark({ className, ...p }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...p}>
      <path
        d="M16 17 Q16 8 25 8 Q34 8 34 16 Q34 21 28 24 Q25 26 25 30 L25 32"
        fill="none"
        stroke="#2b2118"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 17 Q16 8 25 8 Q34 8 34 16 Q34 21 28 24 Q25 26 25 30 L25 32"
        fill="none"
        stroke="#f28c28"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="25" cy="40" r="4.5" fill="#f28c28" stroke="#2b2118" strokeWidth="2" />
    </svg>
  )
}

/** 房子标记 */
export function HouseMark({ className, ...p }: P) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...p}>
      <path d="M2 10 L10 3 L18 10 L18 18 L2 18 Z" fill="#2f9e44" stroke="#12391c" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

/** 酒店标记 */
export function HotelMark({ className, ...p }: P) {
  return (
    <svg viewBox="0 0 32 20" className={className} {...p}>
      <path d="M2 9 L16 2 L30 9 L30 18 L2 18 Z" fill="#d63c2f" stroke="#4a0f0a" strokeWidth="2" strokeLinejoin="round" />
      <rect x="13" y="11" width="6" height="7" fill="#4a0f0a" />
    </svg>
  )
}

/** 一块地上的房子：1~4 栋房子或一家酒店 */
export function Buildings({ houses, className }: { houses: number; className?: string }) {
  if (houses <= 0) return null
  if (houses >= 5) return <HotelMark className={cn('h-full', className)} />
  return (
    <span className={cn('flex h-full items-center gap-[6%]', className)}>
      {Array.from({ length: houses }, (_, i) => (
        <HouseMark key={i} className="h-full" />
      ))}
    </span>
  )
}

/** 起点的大箭头 */
export function GoArrow({ className, ...p }: P) {
  return (
    <svg viewBox="0 0 64 32" className={className} {...p}>
      <path d="M62 11 L24 11 L24 3 L2 16 L24 29 L24 21 L62 21 Z" fill="#d63c2f" stroke="#2b2118" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  )
}

/** 现金：叠起的钞票 */
export function Bills({ className, ...p }: P) {
  return (
    <svg viewBox="0 0 48 32" className={className} {...p}>
      <rect x="8" y="2" width="38" height="20" rx="3" fill="#8fd19e" stroke="#2b2118" strokeWidth="2" />
      <rect x="2" y="9" width="38" height="20" rx="3" fill="#4cc37a" stroke="#2b2118" strokeWidth="2" />
      <circle cx="21" cy="19" r="5" fill="#d8f5df" stroke="#2b2118" strokeWidth="1.8" />
      <path d="M21 16 L21 22 M19 17.5 Q21 16 23 17.5 Q19 19 23 20.5 Q21 22 19 20.5" stroke="#2b2118" strokeWidth="1.2" fill="none" />
    </svg>
  )
}
