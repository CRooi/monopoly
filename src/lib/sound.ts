import { useSyncExternalStore } from 'react'

// 用 Web Audio 播放 public/sfx 里的录音，第一次点页面时整批预加载

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

interface Spec {
  gain: number
  vary?: number
}

/**
 * 音效素材都是 Freesound 上的 CC0 录音（public/sfx），已裁好、峰值归一到 -1 dBFS。
 * gain 按各段的响度对齐；vary 是每次随机变调的幅度，连着响的声音不至于一模一样。
 * 注释里是 Freesound 编号，换素材时按编号回去找原文件。
 */
const SOUNDS = {
  dice: { gain: 1, vary: 0.06 }, // 629982 两颗骰子在木桌上滚
  land: { gain: 1, vary: 0.05 }, // 629982 骰子落桌的那一下
  tap: { gain: 0.32, vary: 0.05 }, // 218460 敲木鱼
  step: { gain: 0.8, vary: 0.1 }, // 547414 棋子落在木头上
  card: { gain: 1 }, // 84322 在桌上翻开一张牌
  buy: { gain: 1 }, // 209578 收银机
  coin: { gain: 1 }, // 162195 一把硬币落在桌上
  pay: { gain: 1, vary: 0.05 }, // 18623 抽出一张钞票
  ring: { gain: 0.72 }, // 173941 木槌敲一下：有租可收、有人出价
  jail: { gain: 0.72 }, // 613498 牢门关上
  turn: { gain: 0.4 }, // 789793 一声软“啵”，滤掉高频，加了短短的余音
  heartbeat: { gain: 0.58 }, // 369017 一下心跳
  reveal: { gain: 0.58 }, // 715067 闪亮的揭晓
} satisfies Record<string, Spec>

type Sfx = keyof typeof SOUNDS

let ctx: AudioContext | null = null
function audio() {
  if (muted) return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    load(ctx)
    return ctx
  } catch {
    return null
  }
}

/** 解码好的音频；失败的移出 requested，下次再试 */
const buffers = new Map<Sfx, AudioBuffer>()
const requested = new Set<Sfx>()

function load(a: AudioContext) {
  for (const name of Object.keys(SOUNDS) as Sfx[]) {
    if (requested.has(name)) continue
    requested.add(name)
    fetch(`/sfx/${name}.mp3`)
      .then((r) => r.arrayBuffer())
      .then((data) => a.decodeAudioData(data))
      .then((buf) => buffers.set(name, buf))
      .catch(() => requested.delete(name))
  }
}

// 第一次点页面就建好 AudioContext 并开始加载，第一声不会因为还没解码而丢掉
if (typeof window !== 'undefined') {
  for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
    window.addEventListener(type, () => audio(), { capture: true, passive: true })
  }
}

function play(name: Sfx) {
  const a = audio()
  const buf = buffers.get(name)
  if (!a || !buf) return
  const { gain, vary = 0 }: Spec = SOUNDS[name]
  const src = a.createBufferSource()
  src.buffer = buf
  if (vary) src.playbackRate.value = 1 + (Math.random() * 2 - 1) * vary
  const g = a.createGain()
  g.gain.value = gain
  src.connect(g).connect(a.destination)
  src.start()
}

export const sfx = Object.fromEntries((Object.keys(SOUNDS) as Sfx[]).map((name) => [name, () => play(name)])) as Record<Sfx, () => void>
