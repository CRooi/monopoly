import { useCallback, useEffect, useRef, useState } from 'react'
import { Shield } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/art/icons'
import { loadAdminToken, saveAdminToken } from './token'

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

/** 后台：?admin。这里只有登录表单，后台面板登录后才下载 */
export function AdminEntry() {
  const [token, setToken] = useState(loadAdminToken)
  useEffect(() => {
    document.title = '后台 - 大富翁'
  }, [])
  const logout = useCallback(() => {
    saveAdminToken(null)
    setToken(null)
  }, [])
  if (!token)
    return (
      <Login
        onLogin={(t) => {
          saveAdminToken(t)
          setToken(t)
        }}
      />
    )
  return <DashboardHost token={token} onLogout={logout} />
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
        toast.error(e.message)
        if (e instanceof Unauthorized) onLogout()
        else setLoading(false)
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
      {loading && (
        <div className="flex min-h-dvh items-center justify-center text-paper/80">
          正在加载后台…
        </div>
      )}
      <div ref={ref} />
    </>
  )
}

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!pw) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? '网络错误')
      onLogin(data.token)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
      <Logo className="size-28" />
      <h1 className="text-title flex items-center gap-2 font-display text-4xl">
        <Shield className="size-8 text-gold" /> 管理后台
      </h1>
      <div className="panel w-full max-w-sm space-y-3 p-5">
        <Input
          type="password"
          value={pw}
          autoFocus
          placeholder="管理员密码"
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="h-11 border-ink/15 bg-white shadow-none text-base"
        />
        <Button variant="red" size="xl" className="w-full" disabled={busy || !pw} onClick={submit}>
          进入后台
        </Button>
      </div>
    </div>
  )
}
