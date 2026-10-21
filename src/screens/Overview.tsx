import { useEffect, useState } from 'react'
import { Monitor, Users } from 'lucide-react'
import { Avatar } from '@/components/art/Avatar'
import { Logo } from '@/components/art/icons'
import { ConnBadge } from '@/components/game/ConnBadge'
import { SystemUpdating } from '@/components/game/SystemUpdating'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSpectator } from '@/hooks/useSpectator'
import { WatchView } from './game/WatchView'

/** 大屏入口：?overview=房间码；未带房间码时先输入 */
export function Overview() {
  const initial = new URLSearchParams(location.search).get('overview') ?? ''
  const [code, setCode] = useState(/^\d{4}$/.test(initial) ? initial : '')
  if (!code)
    return (
      <CodeForm
        onSubmit={(c) => {
          history.replaceState(null, '', `?overview=${c}`)
          setCode(c)
        }}
      />
    )
  return <Screen code={code} />
}

function CodeForm({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [v, setV] = useState('')
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
      <Logo className="size-32" />
      <h1 className="text-title flex items-center gap-3 font-display text-5xl">
        <Monitor className="size-10 text-gold" /> 大屏模式
      </h1>
      <div className="panel flex w-full max-w-md gap-3 p-4">
        <Input
          value={v}
          autoFocus
          inputMode="numeric"
          maxLength={4}
          placeholder="房间码"
          onChange={(e) => setV(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={(e) => e.key === 'Enter' && v.length === 4 && onSubmit(v)}
          className="h-14 border-ink/15 bg-white shadow-none text-center font-display text-3xl tracking-[0.5em]"
        />
        <Button variant="red" size="xl" disabled={v.length !== 4} onClick={() => onSubmit(v)}>
          投屏
        </Button>
      </div>
    </div>
  )
}

function Screen({ code }: { code: string }) {
  const { state, status, gone, upgrading } = useSpectator(code)
  useEffect(() => {
    document.title = `大屏 房间 ${code} - 大富翁`
  }, [code])

  return (
    <div className="flex h-dvh w-full flex-col gap-3 overflow-hidden px-[2vw] py-[2vh]">
      <SystemUpdating upgrading={upgrading} ready={!!state} />
      <header className="flex items-center gap-3 text-paper">
        <Logo className="size-10" />
        <span className="text-title font-display text-3xl">大富翁</span>
        <span className="font-display text-xl">房间 {code}</span>
        <ConnBadge status={status} className="ml-auto text-sm text-paper/80" />
      </header>
      <div className="min-h-0 flex-1">
        {gone && !state ? (
          <div className="py-24 text-center font-display text-2xl text-paper">{gone}</div>
        ) : !state ? (
          <div className="py-24 text-center font-display text-2xl text-paper">正在连接…</div>
        ) : state.game && (state.room.inGame || state.game.phase === 'over') ? (
          <WatchView state={state} live />
        ) : (
          <div className="flex flex-col items-center gap-6 py-16">
            <div className="text-title font-display text-4xl">等待开局</div>
            <div className="flex flex-wrap justify-center gap-6">
              {state.room.members.map((m) => (
                <div key={m.id} className="flex flex-col items-center gap-2">
                  <Avatar index={m.avatar} size={88} ring={m.color} />
                  <span className="font-display text-xl text-paper">{m.name}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-paper/80">
              <Users className="size-5" /> {state.room.members.length} 人
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
