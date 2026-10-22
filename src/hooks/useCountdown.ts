import { useEffect, useState } from 'react'

/**
 * 服务端给的截止时间换算成本地倒计时，返回剩余毫秒。
 * serverNow 是生成视图时服务端的时间，用它抵消两边时钟的差。
 */
export function useCountdown(until: number | null | undefined, serverNow: number) {
  const [remaining, setRemaining] = useState(() => (until ? Math.max(0, until - serverNow) : 0))
  useEffect(() => {
    if (!until) return
    // 收到这份视图时本地和服务端的时差
    const offset = Date.now() - serverNow
    const tick = () => setRemaining(Math.max(0, until - (Date.now() - offset)))
    const first = setTimeout(tick, 0)
    const t = setInterval(tick, 100)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [until, serverNow])
  return until ? remaining : 0
}
