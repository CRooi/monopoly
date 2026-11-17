import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Express, Request, Response } from 'express'

/**
 * 后台登录走游戏大厅的 OAuth：
 * 这里把人送去大厅的 /api/auth/sso，大厅登录、查权限后签一张一分钟有效的票据带回来，
 * 用和大厅相同的 SESSION_SECRET 验票，再发本站自己的登录态 cookie。
 */
const GAME = 'monopoly'
const LOBBY_URL = (process.env.LOBBY_URL || 'https://game.yowot.cn').replace(/\/$/, '')
const SECRET = process.env.SESSION_SECRET ?? ''
const COOKIE = 'admin_session'
const SESSION_DAYS = 7

export interface AdminUser {
  sub: string
  name: string
  email?: string
}

const sign = (data: string) => createHmac('sha256', SECRET).update(data).digest('base64url')

function seal(value: object, maxAgeSec: number) {
  const data = Buffer.from(JSON.stringify({ ...value, exp: Date.now() + maxAgeSec * 1000 })).toString('base64url')
  return `${data}.${sign(data)}`
}

function unseal<T>(token: string | undefined): (T & { exp: number }) | null {
  if (!SECRET || !token) return null
  const [data, mac] = token.split('.')
  if (!data || !mac) return null
  const expected = Buffer.from(sign(data))
  const given = Buffer.from(mac)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const v = JSON.parse(Buffer.from(data, 'base64url').toString()) as T & { exp: number }
    return v.exp > Date.now() ? v : null
  } catch {
    return null
  }
}

function readCookie(req: Request, name: string) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
}

/** 本站对外地址；本地开发经 vite 代理时 Host 被改成了后端端口，改用页面的来源 */
function origin(req: Request) {
  const ref = URL.parse(req.get('referer') ?? '')
  if (ref && /^(localhost|127\.0\.0\.1)$/.test(ref.hostname)) return ref.origin
  return `${req.get('x-forwarded-proto') ?? req.protocol}://${req.get('host')}`
}
const localPath = (p: unknown) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : '/?admin')

type Sealed = { kind: string; aud: string; user: AdminUser; nonce?: string }

/** 已登录的后台用户，没登录时为 null */
export function adminUser(req: Request) {
  const v = unseal<Sealed>(readCookie(req, COOKIE))
  return v?.kind === 'session' && v.aud === GAME ? v.user : null
}

/** 用过的票据，过期前不能再用 */
const used = new Map<string, number>()

export function registerSsoRoutes(app: Express) {
  app.get('/api/auth/login', (req, res) => {
    if (!SECRET) return void res.status(503).type('text').send('后台未开启：没有配置 SESSION_SECRET')
    const back = new URL('/api/auth/sso', origin(req))
    back.searchParams.set('next', localPath(req.query.next))
    res.redirect(`${LOBBY_URL}/api/auth/sso?game=${GAME}&return=${encodeURIComponent(back.toString())}`)
  })

  app.get('/api/auth/sso', (req, res: Response) => {
    const t = unseal<Sealed>(String(req.query.ticket ?? ''))
    if (!t || t.kind !== 'ticket' || t.aud !== GAME || !t.nonce || used.has(t.nonce))
      return void res.status(400).type('text').send('登录失败，请重试')
    const now = Date.now()
    for (const [k, exp] of used) if (exp < now) used.delete(k)
    used.set(t.nonce, t.exp)
    console.log(`后台登录：${t.user.name} sub=${t.user.sub}`)
    res.cookie(COOKIE, seal({ kind: 'session', aud: GAME, user: t.user }, SESSION_DAYS * 86400), {
      httpOnly: true,
      sameSite: 'lax',
      secure: origin(req).startsWith('https:'),
      maxAge: SESSION_DAYS * 86400 * 1000,
      path: '/',
    })
    res.redirect(localPath(req.query.next))
  })

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(COOKIE, { path: '/' })
    res.status(204).end()
  })
}
