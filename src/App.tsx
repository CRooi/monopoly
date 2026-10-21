import { lazy, Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { clearUpgradedParam, justUpgraded } from '@/lib/upgrade'
import { cleanUrl, loadName, loadSession, saveSession, SLOT, type Session } from '@/lib/session'
import { Home } from '@/screens/Home'
import { RoomScreen } from '@/screens/RoomScreen'

// 非玩家页面各自打成独立的 chunk，按查询参数按需加载
const AdminEntry = lazy(() => import('@/screens/admin/AdminEntry').then((m) => ({ default: m.AdminEntry })))
const Debug = lazy(() => import('@/screens/Debug').then((m) => ({ default: m.Debug })))
const Overview = lazy(() => import('@/screens/Overview').then((m) => ({ default: m.Overview })))
const ReplayViewer = lazy(() => import('@/screens/ReplayViewer').then((m) => ({ default: m.ReplayViewer })))

const params = new URLSearchParams(location.search)
const IS_DEBUG_PAGE = params.has('debug')
const IS_OVERVIEW = params.has('overview')
const IS_ADMIN = params.has('admin')
const IS_REPLAY = params.has('replay')

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession())

  const enter = (s: Session | null) => {
    saveSession(s)
    setSession(s)
    // 进入房间后去掉分享链接上的房间号
    if (s) cleanUrl()
  }

  // 更新后刷新回来却不在房间里（首页，或房间已经解散），直接提示，不显示全屏的更新画面
  useEffect(() => {
    if (session || !justUpgraded || !new URLSearchParams(location.search).has('upgraded')) return
    toast.success('系统更新完成')
    clearUpgradedParam()
  }, [session])

  // 调试槽位：标签页标题带上槽位与名字，方便区分
  useEffect(() => {
    if (SLOT !== null && !IS_DEBUG_PAGE) document.title = `[${SLOT}] ${loadName() || '新玩家'} - 大富翁`
  }, [session])

  if (IS_OVERVIEW)
    return (
      <Suspense>
        <Overview />
      </Suspense>
    )

  if (IS_REPLAY) {
    return (
      <>
        <Suspense>
          <ReplayViewer />
        </Suspense>
        <Toaster position="top-center" richColors closeButton={false} />
      </>
    )
  }

  if (IS_ADMIN) {
    return (
      <>
        <Suspense>
          <AdminEntry />
        </Suspense>
        <Toaster position="top-center" richColors closeButton={false} />
      </>
    )
  }

  if (IS_DEBUG_PAGE) {
    return (
      <>
        <Suspense>
          <Debug />
        </Suspense>
        <Toaster position="top-center" richColors closeButton={false} />
      </>
    )
  }

  return (
    <>
      {session ? <RoomScreen key={session.token} session={session} onExit={() => enter(null)} /> : <Home onEnter={enter} />}
      {SLOT !== null && (
        <div className="pointer-events-none fixed top-1 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-fuchsia-600/85 px-2 py-0.5 text-[10px] font-bold text-white shadow">
          调试槽位 {SLOT}
        </div>
      )}
      <Toaster position="top-center" richColors closeButton={false} />
    </>
  )
}
