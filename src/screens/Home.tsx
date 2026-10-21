import { useState } from 'react'
import { ArrowLeft, Bug, DoorOpen, Eye, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { DEFAULT_CONFIG, type RoomConfig } from '@shared/types'
import { Avatar } from '@/components/art/Avatar'
import { Logo } from '@/components/art/icons'
import { AvatarPicker } from '@/components/game/AvatarPicker'
import { ConfigForm } from '@/components/game/ConfigForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, loadAvatar, loadName, saveAvatar, saveName, type Session } from '@/lib/session'

type Mode = 'menu' | 'create' | 'join'

/** 开发环境或构建时设置 VITE_DEBUG=1 时在首页显示调试台入口（调试台本身始终可通过 ?debug 访问） */
const SHOW_DEBUG_LINK = import.meta.env.DEV || import.meta.env.VITE_DEBUG === '1'

export function Home({ onEnter }: { onEnter: (s: Session) => void }) {
  const initialCode = new URLSearchParams(location.search).get('room') ?? ''
  const [name, setName] = useState(loadName)
  const [avatar, setAvatar] = useState(loadAvatar)
  const [mode, setMode] = useState<Mode>(initialCode ? 'join' : 'menu')
  const [code, setCode] = useState(initialCode)
  const [config, setConfig] = useState<RoomConfig>(DEFAULT_CONFIG)
  const [busy, setBusy] = useState(false)

  const pickAvatar = (i: number) => {
    setAvatar(i)
    saveAvatar(i)
  }

  const needName = () => {
    const n = name.trim()
    if (!n) {
      toast.error('请先给自己取个名字')
      return null
    }
    saveName(n)
    return n
  }

  const create = async () => {
    const n = needName()
    if (!n) return
    setBusy(true)
    try {
      onEnter(await api<Session>('/api/rooms', { name: n, avatar, config }))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const join = async (as: 'join' | 'spectate' = 'join') => {
    const n = needName()
    if (!n) return
    if (!/^\d{4}$/.test(code)) return void toast.error('请输入 4 位房间码')
    setBusy(true)
    try {
      onEnter(await api<Session>(`/api/rooms/${code}/${as}`, { name: n, avatar }))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const nameInput = (
    <Input
      value={name}
      maxLength={12}
      onChange={(e) => setName(e.target.value)}
      placeholder="给自己取个名字"
      className="h-11 border-ink/15 bg-white shadow-none text-base"
    />
  )

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 safe-top safe-bottom">
      {mode === 'menu' ? (
        <>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 pt-6">
            <Logo className="animate-float size-28" />
            <h1 className="text-title font-display text-6xl">大富翁</h1>
          </div>
          <div className="panel animate-rise space-y-4 p-5">
            <div className="flex items-center gap-3">
              <Avatar index={avatar} size={52} />
              <div className="min-w-0 flex-1">{nameInput}</div>
            </div>
            <AvatarPicker value={avatar} onChange={pickAvatar} />
            <Button variant="red" size="xl" className="w-full" onClick={() => needName() && setMode('create')}>
              <Sparkles /> 创建房间
            </Button>
            <Button variant="paper" size="xl" className="w-full" onClick={() => needName() && setMode('join')}>
              <DoorOpen /> 加入房间
            </Button>
          </div>
          <div className="flex h-10 items-center justify-center">
            {SHOW_DEBUG_LINK && (
              <a href="?debug" className="flex items-center gap-1 text-xs text-paper/70 underline">
                <Bug className="size-3.5" /> 调试台
              </a>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col pt-2">
          <button className="mb-3 flex items-center gap-1 self-start text-sm text-paper/85" onClick={() => setMode('menu')}>
            <ArrowLeft className="size-4" /> 返回
          </button>
          {mode === 'create' ? (
            <div className="panel animate-rise space-y-5 p-5">
              <h2 className="text-center font-display text-2xl">房间设置</h2>
              <ConfigForm value={config} onChange={setConfig} />
              <Button variant="red" size="xl" className="w-full" disabled={busy} onClick={create}>
                建立房间
              </Button>
            </div>
          ) : (
            <div className="panel animate-rise space-y-5 p-5">
              <h2 className="text-center font-display text-2xl">输入房间码</h2>
              <div className="flex items-center gap-3">
                <Avatar index={avatar} size={44} />
                <div className="min-w-0 flex-1">{nameInput}</div>
              </div>
              <Input
                value={code}
                autoFocus={!!name}
                inputMode="numeric"
                maxLength={4}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="h-16 border-ink/15 bg-white shadow-none text-center font-display text-4xl tracking-[0.6em]"
                placeholder="····"
                onKeyDown={(e) => e.key === 'Enter' && join()}
              />
              <Button variant="red" size="xl" className="w-full" disabled={busy || code.length !== 4 || !name.trim()} onClick={() => join()}>
                加入
              </Button>
              <Button variant="paper" size="lg2" className="w-full" disabled={busy || code.length !== 4 || !name.trim()} onClick={() => join('spectate')}>
                <Eye /> 观战
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
