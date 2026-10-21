// 管理员令牌：公开的登录入口和受保护的后台代码都会用到
const KEY = 'mf.admin'

export const loadAdminToken = () => {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export const saveAdminToken = (t: string | null) => {
  try {
    if (t) sessionStorage.setItem(KEY, t)
    else sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
