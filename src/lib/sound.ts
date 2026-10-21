import { useSyncExternalStore } from 'react'

// 用 Web Audio 现场合成的简单音效，不需要音频文件

const KEY = 'mf.muted'
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
})()
const listeners = new Set<() => void>()

export function setMuted(v: boolean) {
  muted = v
  try {
    localStorage.setItem(KEY, v ? '1' : '0')
  } catch {
    /* 忽略 */
  }
  for (const l of listeners) l()
}

export function useMuted() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => muted,
  )
}

let ctx: AudioContext | null = null
function audio() {
  if (muted) return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** 一个音：频率从 f0 滑到 f1 */
function tone(f0: number, f1: number, dur: number, { type = 'sine' as OscillatorType, vol = 0.15, delay = 0 } = {}) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + delay
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

/** 一段噪声，用来做骰子碰撞、翻牌的声音 */
function noise(dur: number, { vol = 0.2, delay = 0, freq = 2000, q = 1 } = {}) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + delay
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  const src = a.createBufferSource()
  src.buffer = buf
  const f = a.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = freq
  f.Q.value = q
  const g = a.createGain()
  g.gain.value = vol
  src.connect(f).connect(g).connect(a.destination)
  src.start(t)
}

export const sfx = {
  /** 骰子在桌上滚 */
  dice() {
    for (let i = 0; i < 7; i++) noise(0.05, { vol: 0.35 - i * 0.03, delay: i * 0.11 + Math.random() * 0.04, freq: 1800 + Math.random() * 1500, q: 3 })
  },
  /** 摇骰子时点一下，像敲木鱼 */
  tap() {
    tone(820, 620, 0.09, { type: 'sine', vol: 0.18 })
    noise(0.03, { vol: 0.15, freq: 2500, q: 4 })
  },
  /** 骰子落定 */
  land() {
    noise(0.06, { vol: 0.5, freq: 1200, q: 2 })
    noise(0.05, { vol: 0.35, delay: 0.09, freq: 1600, q: 2 })
  },
  /** 棋子走一格 */
  step() {
    tone(520, 380, 0.07, { type: 'triangle', vol: 0.08 })
  },
  /** 收钱 */
  coin() {
    tone(988, 988, 0.08, { type: 'square', vol: 0.05 })
    tone(1319, 1319, 0.25, { type: 'square', vol: 0.05, delay: 0.08 })
  },
  /** 付钱 */
  pay() {
    tone(440, 330, 0.12, { type: 'triangle', vol: 0.12 })
    tone(330, 220, 0.18, { type: 'triangle', vol: 0.1, delay: 0.1 })
  },
  /** 买地、盖房 */
  buy() {
    tone(523, 523, 0.1, { type: 'triangle', vol: 0.12 })
    tone(659, 659, 0.1, { type: 'triangle', vol: 0.12, delay: 0.09 })
    tone(784, 784, 0.22, { type: 'triangle', vol: 0.12, delay: 0.18 })
  },
  /** 翻牌 */
  card() {
    noise(0.12, { vol: 0.25, freq: 3500, q: 0.8 })
    tone(600, 900, 0.12, { type: 'sine', vol: 0.06, delay: 0.08 })
  },
  /** 轮到自己 */
  turn() {
    tone(660, 660, 0.12, { vol: 0.14 })
    tone(880, 880, 0.3, { vol: 0.14, delay: 0.12 })
  },
  /** 进监狱 */
  jail() {
    tone(220, 110, 0.5, { type: 'sawtooth', vol: 0.06 })
  },
}
