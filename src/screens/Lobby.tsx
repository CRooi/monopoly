import { useState } from 'react'
import { Copy, Crown, Eye, LogOut, Play, Trophy, Tv, UserPlus, UserX, Users, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { MAX_PLAYERS, MIN_PLAYERS, type ClientMessage, type StateView } from '@shared/types'
import { Avatar } from '@/components/art/Avatar'
import { Logo } from '@/components/art/icons'
import { AvatarPicker } from '@/components/game/AvatarPicker'
import { ConfigForm } from '@/components/game/ConfigForm'
import { ConfirmDialog, type ConfirmRequest } from '@/components/game/ConfirmDialog'
import { ConnBadge } from '@/components/game/ConnBadge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ConnStatus } from '@/hooks/useRoomSocket'
import { saveAvatar } from '@/lib/session'
import { cn } from '@/lib/utils'

export function Lobby({
  state,
  status,
  send,
  onReview,
}: {
  state: StateView
  status: ConnStatus
  send: (m: ClientMessage) => void
  /** 查看上一局的结果 */
  onReview?: () => void
}) {
  const { room, me } = state
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [picking, setPicking] = useState(false)
  const mine = room.members.find((m) => m.id === me.id)
  const canStart = room.members.length >= MIN_PLAYERS

  const share = async () => {
    const url = `${location.origin}/?room=${room.code}`
    const text = `来玩大富翁！房间码 ${room.code}\n${url}`
    try {
      if (navigator.share) await navigator.share({ title: '大富翁', text, url })
      else {
        await navigator.clipboard.writeText(text)
        toast.success('邀请链接已复制')
      }
    } catch {
      /* 用户取消分享 */
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pb-4 safe-top safe-bottom lg:max-w-4xl">
      <header className="flex items-center gap-2 pt-1 text-paper">
        <Logo className="size-8" />
        <span className="font-display text-xl">大富翁</span>
        <ConnBadge status={status} className="text-paper/80" />
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" className="text-paper hover:bg-white/10 hover:text-paper" asChild>
            <a href={`?overview=${room.code}`} target="_blank" rel="noreferrer" aria-label="大屏">
              <Tv />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-paper hover:bg-white/10 hover:text-paper"
            aria-label="离开房间"
            onClick={() =>
              setConfirm({
                title: me.isHost && room.members.length > 1 ? '离开房间？' : me.isHost ? '解散房间？' : '离开房间？',
                description: me.isHost && room.members.length > 1 ? '房主会交给下一位玩家。' : undefined,
                confirmText: '离开',
                onConfirm: () => send({ type: 'leave' }),
              })
            }
          >
            <LogOut />
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr] lg:items-start">
      <div className="space-y-4">
      {/* 房间码做成一张票：两侧打孔，点一下分享或复制邀请链接 */}
      <button
        onClick={share}
        className="panel relative flex w-full items-center justify-center gap-3 px-5 py-3 transition active:scale-[0.98] before:absolute before:top-1/2 before:-left-2 before:size-4 before:-translate-y-1/2 before:rounded-full before:bg-felt after:absolute after:top-1/2 after:-right-2 after:size-4 after:-translate-y-1/2 after:rounded-full after:bg-felt"
      >
        <span className="text-xs text-ink/60">房间码</span>
        <span className="font-display text-4xl tracking-[0.25em] text-brick">{room.code}</span>
        <Copy className="size-4 text-ink/60" />
      </button>

      <section className="panel space-y-3 p-4">
        <div className="flex items-center gap-2 font-display text-lg">
          <Users className="size-5" /> 玩家
          <span className="text-sm text-ink/50">
            {room.members.length}/{MAX_PLAYERS}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {room.members.map((m) => (
            <div key={m.id} className={cn('panel-flat flex items-center gap-2 px-2.5 py-2', m.id === me.id && 'ring-2 ring-gold')}>
              <button type="button" disabled={m.id !== me.id} onClick={() => setPicking(true)} className="shrink-0">
                <Avatar index={m.avatar} size={36} ring={m.color} className="border-white" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate text-sm font-medium">{m.name}</span>
                  {m.id === room.hostId && <Crown className="size-3.5 shrink-0 text-[#b8860b]" />}
                  {!m.online && <WifiOff className="size-3.5 shrink-0 text-brick" />}
                </div>
              </div>
              {me.isHost && m.id !== me.id && (
                <button
                  type="button"
                  aria-label="请出"
                  className="text-ink/40 hover:text-brick"
                  onClick={() =>
                    setConfirm({ title: `请出 ${m.name}？`, confirmText: '请出', onConfirm: () => send({ type: 'kick', userId: m.id }) })
                  }
                >
                  <UserX className="size-4" />
                </button>
              )}
            </div>
          ))}
          {/* 空位：至少凑满两排，满员前总留一个 */}
          {Array.from({ length: room.members.length >= MAX_PLAYERS ? 0 : Math.max(1, 4 - room.members.length) }, (_, i) => (
            <div key={`empty-${i}`} className="flex items-center gap-2 rounded-lg border border-dashed border-ink/20 px-2.5 py-2">
              <span className="flex size-9 items-center justify-center rounded-full border-2 border-dashed border-ink/20 text-ink/30">
                <UserPlus className="size-4" />
              </span>
            </div>
          ))}
        </div>
        {room.spectators.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink/60">
            <Eye className="size-3.5" />
            {room.spectators.map((s) => (
              <span key={s.id} className={cn('rounded-full bg-ink/5 px-2 py-0.5', !s.online && 'opacity-50')}>
                {s.name}
              </span>
            ))}
          </div>
        )}
      </section>

      </div>

      <section className="panel p-4">
        <ConfigForm value={room.config} onChange={(config) => send({ type: 'updateConfig', config })} disabled={!me.isHost} />
      </section>
      </div>

      <div className="mt-auto space-y-2 lg:mx-auto lg:mt-2 lg:w-full lg:max-w-md">
        {onReview && (
          <Button variant="paper" size="lg2" className="w-full" onClick={onReview}>
            <Trophy /> 上一局结果
          </Button>
        )}
        {me.isHost ? (
          <Button variant="red" size="xl" className="w-full" disabled={!canStart} onClick={() => send({ type: 'start' })}>
            <Play /> {canStart ? '开始游戏' : `至少 ${MIN_PLAYERS} 人才能开始`}
          </Button>
        ) : (
          <div className="py-3 text-center font-display text-paper/85">{me.isSpectator ? '观战中，等待房主开始游戏' : '等待房主开始游戏'}</div>
        )}
      </div>

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="panel max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">换个头像</DialogTitle>
          </DialogHeader>
          {mine && (
            <AvatarPicker
              value={mine.avatar}
              onChange={(i) => {
                saveAvatar(i)
                send({ type: 'setAvatar', avatar: i })
                setPicking(false)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  )
}
