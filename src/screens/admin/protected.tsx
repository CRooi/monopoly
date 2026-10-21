import { createRoot } from 'react-dom/client'
import { Toaster } from '@/components/ui/sonner'
import { Dashboard } from './Admin'

/**
 * 受保护的后台代码入口。
 * 生产环境单独打包成 dist-admin/admin.js（自带一份 React），不放在公开静态目录里，
 * 只能通过带管理员令牌的 /api/admin/app.js 下载；挂载到登录入口给出的容器里。
 */
export function mount(el: HTMLElement, props: { token: string; onLogout: () => void }) {
  const root = createRoot(el)
  root.render(
    <>
      <Dashboard {...props} />
      <Toaster position="top-center" richColors closeButton={false} />
    </>,
  )
  return () => root.unmount()
}
