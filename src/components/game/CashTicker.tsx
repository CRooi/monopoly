import { useEffect, useRef, useState } from 'react'
import { money } from '@/lib/rules'
import { cn } from '@/lib/utils'

const TWEEN_MS = 700

/** 只飘出增减，不显示数字本身（棋盘上的棋子用） */
export function DeltaPop({ value, className }: { value: number; className?: string }) {
  const [deltas, setDeltas] = useState<{ id: number; amount: number }[]>([])
  const prev = useRef(value)
  const seq = useRef(0)
  useEffect(() => {
    const from = prev.current
    prev.current = value
    if (from === value) return
    const id = ++seq.current
    setDeltas((d) => [...d, { id, amount: value - from }])
    const t = setTimeout(() => setDeltas((d) => d.filter((x) => x.id !== id)), 1800)
    return () => clearTimeout(t)
  }, [value])
  return (
    <>
      {deltas.map((d) => (
        <span
          key={d.id}
          className={cn(
            'animate-float-up pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full px-[0.8cqw] font-bold whitespace-nowrap text-white shadow',
            d.amount > 0 ? 'bg-cash' : 'bg-brick',
            className,
          )}
        >
          {d.amount > 0 ? '+' : '-'}
          {money(Math.abs(d.amount))}
        </span>
      ))}
    </>
  )
}

/** 现金：数字滚动到新值，旁边飘出这次的增减 */
export function CashTicker({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value)
  const [deltas, setDeltas] = useState<{ id: number; amount: number }[]>([])
  const prev = useRef(value)
  const seq = useRef(0)

  useEffect(() => {
    const from = prev.current
    prev.current = value
    if (from === value) return
    const id = ++seq.current
    setDeltas((d) => [...d, { id, amount: value - from }])
    const drop = setTimeout(() => setDeltas((d) => d.filter((x) => x.id !== id)), 1800)
    const start = performance.now()
    let raf = 0
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / TWEEN_MS)
      const eased = 1 - (1 - t) ** 3
      setShown(Math.round(from + (value - from) * eased))
      if (t < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(drop)
      setShown(value)
    }
  }, [value])

  return (
    <span className={cn('relative inline-block tabular-nums', className)}>
      {money(shown)}
      {deltas.map((d) => (
        <span
          key={d.id}
          className={cn(
            'animate-float-up pointer-events-none absolute right-0 -top-1 text-sm font-bold whitespace-nowrap',
            d.amount > 0 ? 'text-cash' : 'text-brick',
          )}
        >
          {d.amount > 0 ? '+' : '-'}
          {money(Math.abs(d.amount))}
        </span>
      ))}
    </span>
  )
}
