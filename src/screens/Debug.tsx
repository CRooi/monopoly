import { useCallback, useEffect, useState } from 'react'
import { Bug, ExternalLink, Eye, Plus, Trash2, Users, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { AVATARS, DEFAULT_CONFIG, MAX_PLAYERS, MIN_PLAYERS, type RoomConfig } from '@shared/types'
import { Avatar } from '@/components/art/Avatar'
import { ConfigForm } from '@/components/game/ConfigForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, loadAvatar, loadName, loadSession, saveAvatar, saveName, saveSession, type Session } from '@/lib/session'
import { cn } from '@/lib/utils'

const MAX_SLOT = 20

/** 首字各不相同，方便在头像上区分 */
const NAMES = ['房主', '阿狸', '白菜', '橙子', '大熊', '鹅鹅', '饭团', '果冻', '荷包', '冰糖', '金桔', '可乐', '柠檬', '蘑菇', '奶茶', '泡芙', '青团', '肉松', '薯条', '汤圆']

interface SlotInfo {
  slot: number
  name: string
  avatar: number
  session: Session
}

function readSlots(): SlotInfo[] {
  const out: SlotInfo[] = []
  for (let slot = 0; slot < MAX_SLOT; slot++) {
    const session = loadSession(slot)
    if (session) out.push({ slot, name: loadName(slot), avatar: loadAvatar(slot), session })
  }
  return out
}

const slotUrl = (slot: number) => `${location.pathname}?slot=${slot}`

/** 打开槽位标签页；同名窗口已存在时复用 */
function openSlot(slot: number) {
  return window.open(slotUrl(slot), `mf-slot-${slot}`)
}

/** 每个槽位用固定的名字和头像 */
function identity(slot: number) {
  const name = NAMES[slot] ?? `玩家${slot}`
  const avatar = (slot * 3) % AVATARS.length
  saveName(name, slot)
  saveAvatar(avatar, slot)
  return { name, avatar }
}

/**
 * 调试台：在同一个浏览器里模拟多名玩家。
 * 每个槽位对应一个带 ?slot=N 的标签页，拥有独立的身份存储。
 */
export function Debug() {
  const [slots, setSlots] = useState<SlotInfo[]>(readSlots)
  const [config, setConfig] = useState<RoomConfig>(DEFAULT_CONFIG)
  const [players, setPlayers] = useState(4)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(() => setSlots(readSlots()), [])

  useEffect(() => {
    document.title = '调试台 - 大富翁'
    // 其他标签页退出房间时同步刷新
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  const freeSlots = (count: number, from: number) => {
    const used = new Set(readSlots().map((s) => s.slot))
    const res: number[] = []
    for (let s = from; s < MAX_SLOT && res.length < count; s++) if (!used.has(s)) res.push(s)
    if (res.length < count) throw new Error(`槽位不足，最多 ${MAX_SLOT} 个，请先清理`)
    return res
  }

  const joinPlayers = async (roomCode: string, count: number, as: 'join' | 'spectate' = 'join') => {
    const targets = freeSlots(count, 1)
    for (const slot of targets) {
      const id = identity(slot)
      saveSession(await api<Session>(`/api/rooms/${roomCode}/${as}`, id), slot)
    }
    return targets
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
      refresh()
    }
  }

  const quickStart = () =>
    run(async () => {
      if (loadSession(0)) throw new Error('槽位 0 已被占用，请先清理')
      const host = await api<Session>('/api/rooms', { ...identity(0), config })
      saveSession(host, 0)
      await joinPlayers(host.code, players - 1)
      setCode(host.code)
      toast.success(`房间 ${host.code} 已创建，共 ${players} 人`)
    })

  const addOne = () =>
    run(async () => {
      if (!/^\d{4}$/.test(code)) throw new Error('请输入 4 位房间码')
      await joinPlayers(code, 1)
    })

  const addSpectator = () =>
    run(async () => {
      if (!/^\d{4}$/.test(code)) throw new Error('请输入 4 位房间码')
      await joinPlayers(code, 1, 'spectate')
    })

  const clearSlot = (slot: number) => {
    saveSession(null, slot)
    refresh()
  }

  const clearAll = () => {
    for (const s of readSlots()) saveSession(null, s.slot)
    refresh()
  }

  const openAll = () => {
    let blocked = 0
    for (const s of slots) if (!openSlot(s.slot)) blocked++
    if (blocked) toast.error(`有 ${blocked} 个标签页被浏览器拦截，请允许本站弹出窗口，或逐个点击打开`)
  }

  const rooms = [...new Set(slots.map((s) => s.session.code))]

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 px-4 pb-8 safe-top">
      <header className="flex items-center gap-2 pt-3 text-paper">
        <Bug className="size-6 text-gold" />
        <h1 className="text-title font-display text-3xl">调试台</h1>
        <a href={location.pathname} className="ml-auto text-xs text-paper/70 underline">
          返回首页
        </a>
      </header>

      <section className="panel space-y-4 p-4">
        <h2 className="flex items-center gap-2 font-display text-xl">
          <Zap className="size-5" /> 一键开局
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => i + MIN_PLAYERS).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPlayers(n)}
              className={cn('min-w-10 rounded-lg border px-2 py-1 text-sm font-medium', n === players ? 'border-[#c99400] bg-gold' : 'border-ink/15 bg-white text-ink/65')}
            >
              {n} 人
            </button>
          ))}
        </div>
        <ConfigForm value={config} onChange={setConfig} />
        <Button variant="red" size="xl" className="w-full" disabled={busy} onClick={quickStart}>
          创建房间并加入 {players} 人
        </Button>
      </section>

      <section className="panel space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-display text-xl">
          <Users className="size-5" /> 加入已有房间
        </h2>
        <div className="flex gap-2">
          <Input
            value={code}
            inputMode="numeric"
            maxLength={4}
            placeholder="房间码"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="h-10 border-ink/15 bg-white shadow-none text-center font-display text-xl tracking-[0.4em]"
          />
          <Button variant="gold" size="lg2" disabled={busy} onClick={addOne}>
            <Plus /> 1 人
          </Button>
          <Button variant="paper" size="lg2" disabled={busy} onClick={addSpectator}>
            <Eye /> 观战
          </Button>
        </div>
        <Button
          variant="paper"
          size="lg2"
          className="w-full"
          onClick={() => {
            try {
              openSlot(freeSlots(1, 1)[0]!)
            } catch (e) {
              toast.error((e as Error).message)
            }
          }}
        >
          <ExternalLink /> 打开空白玩家
        </Button>
      </section>

      <section className="panel space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl whitespace-nowrap">玩家标签页</h2>
          <span className="text-xs whitespace-nowrap text-ink/60">{slots.length} 个</span>
          <div className="ml-auto flex gap-2">
            <Button variant="gold" size="sm" disabled={!slots.length} onClick={openAll}>
              <ExternalLink /> 全部打开
            </Button>
            <Button variant="destructive" size="sm" disabled={!slots.length} onClick={clearAll}>
              <Trash2 /> 清空
            </Button>
          </div>
        </div>
        {slots.length === 0 ? (
          <div className="py-6 text-center text-sm text-ink/60">还没有玩家</div>
        ) : (
          rooms.map((room) => (
            <div key={room} className="space-y-1.5">
              <div className="text-xs text-ink/60">房间 {room}</div>
              {slots
                .filter((s) => s.session.code === room)
                .map((s) => (
                  <div key={s.slot} className="panel-flat flex items-center gap-2 px-3 py-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper">{s.slot}</span>
                    <Avatar index={s.avatar} size={26} />
                    <span className="flex-1 truncate text-sm">{s.name || '(未命名)'}</span>
                    <Button variant="red" size="sm" onClick={() => openSlot(s.slot)}>
                      打开
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => clearSlot(s.slot)} aria-label="清除槽位">
                      <Trash2 />
                    </Button>
                  </div>
                ))}
            </div>
          ))
        )}
      </section>
    </div>
  )
}
