import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { loadAdminToken, saveAdminToken, toLogin } from './token'

type AdminModule = typeof import('./protected')

class Unauthorized extends Error {}

/**
 * 加载后台代码。开发环境直接走模块导入；
 * 生产环境凭令牌从服务端下载 admin.js，未登录的人拿不到这部分代码。
 */
async function loadAdminModule(token: string): Promise<AdminModule> {
  if (import.meta.env.DEV) return import('./protected')
  const res = await fetch('/api/admin/app.js', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (res.status === 401) throw new Unauthorized('请重新登录')
  if (!res.ok) throw new Error('后台加载失败')
  const url = URL.createObjectURL(new Blob([await res.text()], { type: 'text/javascript' }))
  try {
    return await import(/* @vite-ignore */ url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 凭大厅 OAuth 的登录态换后台令牌；还没登录就去大厅登录 */
async function exchangeToken() {
  const res = await fetch('/api/admin/login', { method: 'POST' })
  if (res.status === 401) {
    toLogin()
    return null
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? '网络错误')
  return data.token as string
}

/** 后台：?admin。后台面板拿到令牌后才下载 */
export function AdminEntry() {
  const [token, setToken] = useState(loadAdminToken)
  useEffect(() => {
    document.title = '后台 - 大富翁'
  }, [])
  useEffect(() => {
    if (token) return
    let cancelled = false
    exchangeToken().then(
      (t) => {
        if (cancelled || !t) return
        saveAdminToken(t)
        setToken(t)
      },
      (e: Error) => toast.error(e.message),
    )
    return () => {
      cancelled = true
    }
  }, [token])
  // 令牌失效（比如服务重启）时重新换一个
  const renew = useCallback(() => {
    saveAdminToken(null)
    setToken(null)
  }, [])
  if (!token) return <Loading />
  return <DashboardHost token={token} onLogout={renew} />
}

function Loading() {
  return <div className="flex min-h-dvh items-center justify-center text-paper/80">正在加载后台…</div>
}

function DashboardHost({ token, onLogout }: { token: string; onLogout: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let unmount: (() => void) | undefined
    let cancelled = false
    loadAdminModule(token).then(
      (m) => {
        if (cancelled) return
        setLoading(false)
        unmount = m.mount(ref.current!, { token, onLogout })
      },
      (e: Error) => {
        if (cancelled) return
        if (e instanceof Unauthorized) onLogout()
        else {
          toast.error(e.message)
          setLoading(false)
        }
      },
    )
    return () => {
      cancelled = true
      // 推迟卸载，避免在当前渲染过程中同步卸载另一个 React 根
      if (unmount) setTimeout(unmount)
    }
  }, [token, onLogout])
  return (
    <>
      {loading && <Loading />}
      <div ref={ref} />
    </>
  )
}
