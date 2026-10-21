import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// 中国城市地图里每个城市的标志，画的是当地最有名的特色，32×32 画布，统一深色描边

const INK = '#2b2118'
const S = { stroke: INK, strokeWidth: 1.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

const ICONS: Record<string, ReactNode> = {
  // 布达拉宫：山上的白宫和红宫
  拉萨: (
    <>
      <path d="M1 29 Q16 21 31 29 Z" fill="#b39a6b" {...S} />
      <rect x="4" y="15" width="24" height="10" fill="#fffaf0" {...S} />
      <rect x="11" y="9" width="10" height="10" fill="#c0392b" {...S} />
      <rect x="12.5" y="6.5" width="7" height="2.5" fill="#f2b705" {...S} />
      {[7, 10, 22, 25].map((x) => (
        <rect key={x} x={x - 0.6} y="18" width="1.2" height="2.4" fill={INK} />
      ))}
      <rect x="14" y="12" width="1.2" height="2.4" fill="#fffaf0" />
      <rect x="16.8" y="12" width="1.2" height="2.4" fill="#fffaf0" />
    </>
  ),
  // 青海湖：雪山、湖水和油菜花
  西宁: (
    <>
      <path d="M3 18 L11 7 L16 13 L20 9 L29 18 Z" fill="#9fb3c8" {...S} />
      <path d="M9 9.8 L11 7 L13.3 10 L11.8 9.2 L10.5 10.3 Z" fill="#fff" />
      <ellipse cx="16" cy="21" rx="13" ry="4" fill="#4aa3df" {...S} />
      <path d="M2 27 Q16 24 30 27 L30 30 L2 30 Z" fill="#f2c418" {...S} />
    </>
  ),
  // 葡萄
  乌鲁木齐: (
    <>
      <path d="M16 3 Q17 6 16 8" fill="none" {...S} />
      <path d="M16 6 Q22 2 26 6 Q21 9 16 6 Z" fill="#5cb85c" {...S} />
      {[
        [11, 11], [16, 11], [21, 11],
        [13.5, 15.5], [18.5, 15.5], [9, 15.5], [23, 15.5],
        [11, 20], [16, 20], [21, 20],
        [13.5, 24.5], [18.5, 24.5], [16, 28.5],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="#7b3fa0" {...S} />
      ))}
      <circle cx="10.2" cy="10.2" r="0.8" fill="#fff" opacity="0.7" />
    </>
  ),
  // 牛肉拉面：清汤、红油、香菜
  兰州: (
    <>
      <path d="M4 14 L28 14 Q27 26 16 27 Q5 26 4 14 Z" fill="#fff" {...S} />
      <path d="M5 14 Q16 18 27 14" fill="#e85a2a" stroke="none" />
      <path d="M9 14 Q11 9 13 14 M14 14 Q16 8 18 14 M19 14 Q21 9 23 14" fill="none" {...S} stroke="#e8c76a" strokeWidth="1.6" />
      <circle cx="10" cy="15.5" r="1" fill="#3a9d3a" />
      <circle cx="21" cy="16" r="1" fill="#3a9d3a" />
      <rect x="14" y="15" width="4" height="2" rx="0.8" fill="#8b4a2b" />
      <path d="M11 4 L19 12 M14 3 L21 11" {...S} />
      <path d="M10 27 L22 27 L21 29 L11 29 Z" fill="#fff" {...S} />
    </>
  ),
  // 黄果树瀑布
  贵阳: (
    <>
      <path d="M2 6 L11 6 L11 26 L2 26 Z M21 6 L30 6 L30 26 L21 26 Z" fill="#4c9a4c" {...S} />
      <rect x="11" y="6" width="10" height="20" fill="#bfe3f7" {...S} />
      <path d="M13 8 L13 24 M16 7 L16 25 M19 8 L19 24" fill="none" stroke="#fff" strokeWidth="1.4" />
      <path d="M6 27 Q10 24 13 27 Q16 24 19 27 Q22 24 26 27 L26 29 L6 29 Z" fill="#fff" {...S} />
    </>
  ),
  // 桂林山水
  南宁: (
    <>
      <path d="M2 22 Q4 9 8 9 Q11 9 12 22 Z" fill="#5aa469" {...S} />
      <path d="M10 22 Q13 5 17 5 Q21 5 22 22 Z" fill="#3e8a52" {...S} />
      <path d="M20 22 Q23 11 26 11 Q29 11 30 22 Z" fill="#5aa469" {...S} />
      <path d="M2 22 L30 22 L30 28 L2 28 Z" fill="#7cc8f0" {...S} />
      <path d="M11 25 L20 25 L18.5 27 L12.5 27 Z" fill="#8b5a2b" {...S} />
    </>
  ),
  // 鲜花（春城）
  昆明: (
    <>
      <path d="M16 20 L16 30" {...S} stroke="#3a9d3a" strokeWidth="1.8" />
      <path d="M16 26 Q22 22 24 25 Q20 28 16 26 Z" fill="#5cb85c" {...S} />
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="16" cy="7.5" rx="4" ry="5.5" fill="#f06595" {...S} transform={`rotate(${a} 16 13)`} />
      ))}
      <circle cx="16" cy="13" r="3" fill="#f2c418" {...S} />
    </>
  ),
  // 冰雪
  哈尔滨: (
    <>
      <circle cx="16" cy="16" r="14" fill="#dff1fc" {...S} />
      <g stroke="#1c7ed6" strokeWidth="2" strokeLinecap="round">
        {[0, 60, 120].map((a) => (
          <path key={a} d="M16 5 L16 27 M13 8 L16 11 L19 8 M13 24 L16 21 L19 24" transform={`rotate(${a} 16 16)`} fill="none" />
        ))}
      </g>
    </>
  ),
  // 饺子
  沈阳: (
    <>
      <path d="M3 21 Q4 9 16 8 Q28 9 29 21 Q16 25 3 21 Z" fill="#fffaf0" {...S} />
      <path d="M6 13 Q8 15 9 12 Q11 14 12 11 Q14 13 16 10.5 Q18 13 20 11 Q21 14 23 12 Q24 15 26 13" fill="none" {...S} />
      <path d="M3 25 L29 25" {...S} stroke="#5c7cfa" strokeWidth="2" />
    </>
  ),
  // 「大玉米」：一根玉米
  郑州: (
    <>
      <path d="M12 30 Q6 20 9 10 Q11 18 14 22 Z" fill="#7cc35a" {...S} />
      <path d="M20 30 Q26 20 23 10 Q21 18 18 22 Z" fill="#7cc35a" {...S} />
      <path d="M16 2 Q21 4 21 16 Q21 26 16 28 Q11 26 11 16 Q11 4 16 2 Z" fill="#f7c948" {...S} />
      <path d="M12 9 L20 9 M11.5 14 L20.5 14 M11.5 19 L20.5 19 M12.5 24 L19.5 24 M14 3 L14 27 M18 3 L18 27" fill="none" stroke="#d9a400" strokeWidth="0.9" />
    </>
  ),
  // 奶茶
  长沙: (
    <>
      <path d="M19 1 L16 9" {...S} strokeWidth="2.4" stroke="#c0392b" />
      <path d="M7 9 L25 9 L25 12 L7 12 Z" fill="#fffaf0" {...S} />
      <path d="M8 12 L24 12 L22 30 L10 30 Z" fill="#e8c9a0" {...S} />
      <path d="M8.6 17 L23.4 17" fill="none" stroke="#fffaf0" strokeWidth="2.2" />
      {[12, 15.5, 19].map((x) => (
        <circle key={x} cx={x + 0.5} cy="26.5" r="1.3" fill="#3b2a1a" />
      ))}
    </>
  ),
  // 兵马俑
  西安: (
    <>
      <path d="M6 30 Q7 23 16 23 Q25 23 26 30 Z" fill="#9c6b45" {...S} />
      <path d="M10 25 L16 29 L22 25" fill="none" stroke="#6e4527" strokeWidth="1.1" />
      <ellipse cx="16" cy="14" rx="7.5" ry="9" fill="#c48a5a" {...S} />
      <path d="M8.6 11 Q9 4 16 4 Q23 4 23.4 11 Q20 8 16 8 Q12 8 8.6 11 Z" fill="#7a4e2c" {...S} />
      <path d="M17 4.5 Q20 1 23 3 Q22 6 19 6 Z" fill="#7a4e2c" {...S} />
      <path d="M11.5 13 L14.5 13 M17.5 13 L20.5 13" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M16 13.5 L15.3 17 L16.7 17" fill="none" stroke="#7a4e2c" strokeWidth="0.9" />
      <path d="M12.5 19 Q14.5 18 16 19 Q17.5 18 19.5 19" fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  // 黄鹤楼
  武汉: (
    <>
      <path d="M15 1 L17 1 L17 4 L15 4 Z" fill="#f2b705" {...S} />
      <path d="M9 7 L23 7 L25 9 L7 9 Z" fill="#f2b705" {...S} />
      <path d="M11 4 L21 4 L23 7 L9 7 Z" fill="#f2b705" {...S} />
      <rect x="10" y="9" width="12" height="4" fill="#c0392b" {...S} />
      <path d="M5 13 L27 13 L29 16 L3 16 Z" fill="#f2b705" {...S} />
      <rect x="8" y="16" width="16" height="5" fill="#c0392b" {...S} />
      <path d="M3 21 L29 21 L31 24 L1 24 Z" fill="#f2b705" {...S} />
      <rect x="6" y="24" width="20" height="6" fill="#c0392b" {...S} />
      <rect x="14" y="26" width="4" height="4" fill={INK} />
    </>
  ),
  // 盐水鸭
  南京: (
    <>
      <path d="M5 18 Q5 28 17 28 Q28 28 28 20 Q28 15 22 15 L20 15 Q21 9 17 7 Q12 6 11 11 Q11 14 13 16 Q8 15 5 18 Z" fill="#fffaf0" {...S} />
      <path d="M11 10 L6 11 L11 12.5 Z" fill="#f28c28" {...S} />
      <circle cx="14.5" cy="10" r="1" fill={INK} />
      <path d="M14 21 Q19 24 24 20" fill="none" {...S} />
    </>
  ),
  // 天津之眼
  天津: (
    <>
      <circle cx="16" cy="13" r="11" fill="none" {...S} stroke="#1c7ed6" strokeWidth="2" />
      {[0, 45, 90, 135].map((a) => (
        <path key={a} d="M16 2 L16 24" stroke="#1c7ed6" strokeWidth="0.9" transform={`rotate(${a} 16 13)`} />
      ))}
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle key={a} cx="16" cy="2" r="1.8" fill="#f06595" {...S} strokeWidth="1" transform={`rotate(${a} 16 13)`} />
      ))}
      <path d="M16 13 L10 29 M16 13 L22 29" {...S} strokeWidth="1.8" />
      <path d="M2 29 L30 29" {...S} stroke="#4aa3df" strokeWidth="2" />
    </>
  ),
  // 园林月亮门
  苏州: (
    <>
      <path d="M2 8 L30 8 L28 5 L4 5 Z" fill="#4a5568" {...S} />
      <rect x="3" y="8" width="26" height="21" fill="#fffaf0" {...S} />
      <circle cx="16" cy="19" r="7.5" fill="#7cc35a" {...S} />
      <path d="M11 22 Q14 17 16 21 Q18 16 21 22" fill="none" stroke="#3e8a52" strokeWidth="1.3" />
      <path d="M3 29 L29 29" {...S} />
    </>
  ),
  // 龙井茶
  杭州: (
    <>
      <path d="M5 12 L25 12 Q24 26 15 26 Q6 26 5 12 Z" fill="#fff" {...S} />
      <path d="M25 15 Q30 15 29 19 Q28 22 24 21" fill="none" {...S} />
      <path d="M6 13 Q15 15 24 13 Q23 20 15 21 Q7 20 6 13 Z" fill="#b8d96a" />
      <path d="M10 10 Q13 3 19 4 Q17 10 10 10 Z" fill="#3a9d3a" {...S} />
      <path d="M11 9 Q14 6 17 5" fill="none" stroke="#fff" strokeWidth="0.8" />
      <path d="M4 27 L26 27" {...S} />
    </>
  ),
  // 早茶虾饺
  广州: (
    <>
      <ellipse cx="16" cy="13" rx="13" ry="3" fill="#e8c38a" {...S} />
      <path d="M3 13 L3 22 Q16 27 29 22 L29 13" fill="#e8c38a" {...S} />
      <path d="M3 17 Q16 21 29 17" fill="none" stroke="#c4975b" strokeWidth="1.2" />
      <path d="M7 12 Q8 6 12 6 Q16 6 16 12 Z" fill="#fde2d0" {...S} />
      <path d="M16 12 Q17 6 21 6 Q25 6 25 12 Z" fill="#fde2d0" {...S} />
      <path d="M9 9 L13 7 M18 9 L22 7" stroke="#f28c6a" strokeWidth="1" />
    </>
  ),
  // 高楼群
  深圳: (
    <>
      <path d="M13 30 L13 6 L16 2 L19 6 L19 30 Z" fill="#5c9ded" {...S} />
      <rect x="4" y="14" width="8" height="16" fill="#8fbdf2" {...S} />
      <rect x="20" y="10" width="8" height="20" fill="#3b7dd8" {...S} />
      <path d="M15 9 L17 9 M15 13 L17 13 M15 17 L17 17 M15 21 L17 21 M6 18 L10 18 M6 22 L10 22 M22 14 L26 14 M22 18 L26 18 M22 22 L26 22" stroke="#fff" strokeWidth="1" />
      <path d="M2 30 L30 30" {...S} />
    </>
  ),
  // 天坛
  北京: (
    <>
      <path d="M16 1 L16 4" {...S} stroke="#f2b705" strokeWidth="2" />
      <path d="M10 8 Q16 2 22 8 Z" fill="#2c5fa8" {...S} />
      <rect x="11" y="8" width="10" height="3" fill="#c0392b" {...S} />
      <path d="M7 14 Q16 7 25 14 Z" fill="#2c5fa8" {...S} />
      <rect x="9" y="14" width="14" height="3" fill="#c0392b" {...S} />
      <path d="M4 20 Q16 12 28 20 Z" fill="#2c5fa8" {...S} />
      <rect x="7" y="20" width="18" height="4" fill="#c0392b" {...S} />
      <path d="M3 24 L29 24 L30 27 L2 27 Z M1 27 L31 27 L31 30 L1 30 Z" fill="#fffaf0" {...S} />
    </>
  ),
  // 东方明珠
  上海: (
    <>
      <path d="M16 1 L16 6" {...S} strokeWidth="1.6" />
      <circle cx="16" cy="8" r="2.4" fill="#e64980" {...S} />
      <path d="M14.5 10 L14.5 17 M17.5 10 L17.5 17" {...S} />
      <circle cx="16" cy="19" r="4.5" fill="#e64980" {...S} />
      <path d="M13 22.5 L9 30 M19 22.5 L23 30 M16 23.5 L16 30" {...S} strokeWidth="1.6" />
      <circle cx="16" cy="27" r="1.6" fill="#e64980" {...S} />
      <path d="M5 30 L27 30" {...S} />
      <circle cx="14.5" cy="17.5" r="1" fill="#fff" opacity="0.8" />
    </>
  ),
  // 鸳鸯火锅
  重庆: (
    <>
      <path d="M9 7 Q8 4 10 2 M16 6 Q15 3 17 1 M23 7 Q22 4 24 2" fill="none" stroke="#9aa3ad" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M1 15 L4 15 M28 15 L31 15" {...S} strokeWidth="2.4" />
      <ellipse cx="16" cy="13" rx="13" ry="4.5" fill="#2b2118" {...S} />
      <path d="M3 13 L3 20 Q16 30 29 20 L29 13" fill="#4a4a4a" {...S} />
      <ellipse cx="16" cy="13" rx="11.5" ry="3.4" fill="#d9381e" />
      <path d="M16 9.6 Q11 12 16 13 Q21 14 16 16.4 Q27.5 16 27.5 13 Q27.5 10 16 9.6 Z" fill="#f6e7c8" />
      <path d="M8 12 Q9 11 10.5 12.5" fill="none" stroke="#7a0f00" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M11 14 L13 13" stroke="#2f9e44" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="21" cy="12.5" r="0.9" fill="#d9a400" />
    </>
  ),
}

/** 城市标志；没有画的城市显示 fallback（简称印章） */
export function CityIcon({ name, fallback, className, style }: { name: string; fallback?: ReactNode; className?: string; style?: React.CSSProperties }) {
  const icon = ICONS[name]
  if (!icon) return fallback ?? null
  return (
    <svg viewBox="0 0 32 32" className={cn('shrink-0', className)} style={style} aria-hidden>
      {icon}
    </svg>
  )
}
