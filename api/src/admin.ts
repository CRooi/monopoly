import { timingSafeEqual } from 'node:crypto'
import path from 'node:path'
import type express from 'express'
import type { ClientMessage, ReplayFile } from '../../shared/types'
import {
  addGameEvent,
  createGameRecord,
  finishGameRecord,
  getGameEvents,
  getGameEventState,
  getGameRecord,
  listGameRecords,
} from './db'
import { type GameState, type ReplayMeta, ROOM_IDLE_MS, Room } from './room'

// ---------------- 鉴权 ----------------

const TOKEN_TTL = 12 * 3600 * 1000

const tokens = new Map<string, number>()

export const adminEnabled = () => !!process.env.ADMIN_PASSWORD

function checkPassword(input: unknown) {
  const expected = Buffer.from(process.env.ADMIN_PASSWORD ?? '')
  const got = Buffer.from(String(input ?? ''))
  return expected.length > 0 && got.length === expected.length && timingSafeEqual(got, expected)
}

export function verifyAdminToken(token: string | null | undefined) {
  if (!token) return false
  const exp = tokens.get(token)
  if (!exp) return false
  if (exp < Date.now()) {
    tokens.delete(token)
    return false
  }
  return true
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = String(req.headers.authorization ?? '').replace(/^Bearer /, '')
  if (!verifyAdminToken(token)) return void res.status(401).json({ error: '请重新登录' })
  next()
}

// ---------------- 对局记录 ----------------

/** 没有产生日志的操作，用一句话描述 */
function describe(msg: ClientMessage): string {
  switch (msg.type) {
    case 'start':
      return '开始游戏'
    case 'endTurn':
      return '结束回合'
    case 'tradeCancel':
      return '撤回交易'
    default:
      return msg.type
  }
}

function actorLabel(room: Room, userId: string) {
  const name = room.d.users[userId]?.name ?? room.d.game?.players.find((p) => p.id === userId)?.name ?? '?'
  return userId === room.d.hostId ? `房主 ${name}` : name
}

export interface BeforeAction {
  gameId: string | null
  json: string | null
  logSeq: number
}

export function snapshotBefore(room: Room): BeforeAction {
  const g = room.d.game
  return { gameId: g?.id ?? null, json: g ? JSON.stringify(g) : null, logSeq: g?.log.at(-1)?.id ?? 0 }
}

/** 在一次成功的操作之后记录事件；没有改变对局的操作会被忽略 */
export function recordAction(room: Room, userId: string, msg: ClientMessage, before: BeforeAction, disband = false) {
  // 摇骰子时的连点和表情不记，骰子停下出点数时会记一次
  if (msg.type === 'shake' || msg.type === 'emote') return
  try {
    const g = room.d.game
    const actor = actorLabel(room, userId)
    const now = Date.now()

    // 房间被解散，进行中的对局记为终止
    if (disband && before.gameId && before.json) {
      const prev = JSON.parse(before.json) as GameState
      if (prev.phase !== 'over') {
        addGameEvent(before.gameId, { ts: now, actor, text: '解散房间，对局终止', state: prev })
        finishGameRecord(before.gameId, 'aborted', null)
      }
      return
    }
    if (!g) return

    if (g.id !== before.gameId) createGameRecord(g.id, room.d.code, room.replayMeta())
    const json = JSON.stringify(g)
    if (json === before.json) return
    // 本次操作产生的日志就是事件的描述
    const fresh = g.log.filter((l) => l.id > before.logSeq).map((l) => l.text)
    const text = fresh.length ? fresh.join(' → ') : describe(msg)
    addGameEvent(g.id, { ts: now, actor, text, state: g })
    if (g.phase === 'over') {
      const res = g.result!
      if (res.reason === 'aborted') finishGameRecord(g.id, 'aborted', null)
      else finishGameRecord(g.id, 'finished', res.standings[0]?.name ?? null)
    }
  } catch (e) {
    console.error('记录对局事件失败', e)
  }
}

/** 房间被关闭（空闲超时等）时，进行中的对局记为终止 */
export function recordRoomClosed(room: Room, reason: string) {
  try {
    const g = room.d.game
    if (!g || g.phase === 'over') return
    // 结束时间记为最后一次有人操作的时间，而不是解散的时刻
    const lastActive = room.d.lastActiveAt
    addGameEvent(g.id, { ts: lastActive, actor: '系统', text: reason, state: g })
    finishGameRecord(g.id, 'aborted', null, lastActive)
  } catch (e) {
    console.error('记录房间关闭失败', e)
  }
}

// ---------------- 接口 ----------------

export function registerAdminRoutes(app: express.Express, rooms: Map<string, Room>, online: (code: string) => (id: string) => boolean) {
  app.post('/api/admin/login', async (req, res) => {
    if (!adminEnabled()) return void res.status(503).json({ error: '未配置管理员密码（ADMIN_PASSWORD）' })
    if (!checkPassword(req.body?.password)) {
      await Bun.sleep(600) // 减缓暴力尝试
      return void res.status(401).json({ error: '密码错误' })
    }
    const token = crypto.randomUUID() + crypto.randomUUID()
    tokens.set(token, Date.now() + TOKEN_TTL)
    res.json({ token })
  })

  // 后台面板代码（vite.admin.config.ts 打包）：不在公开静态目录里，登录后才下发
  const adminBundle = path.resolve(import.meta.dir, '../../dist-admin/admin.js')
  app.get('/api/admin/app.js', requireAdmin, async (_req, res) => {
    const file = Bun.file(adminBundle)
    if (!(await file.exists())) return void res.status(404).json({ error: '后台代码未构建' })
    res.set('Cache-Control', 'no-store').type('text/javascript').send(await file.text())
  })

  app.get('/api/admin/rooms', requireAdmin, (_req, res) => {
    res.json(
      [...rooms.values()]
        .map((r) => {
          const g = r.d.game
          const isOnline = online(r.d.code)
          return {
            code: r.d.code,
            host: r.d.users[r.d.hostId]?.name ?? '?',
            players: r.d.members.length,
            online: r.d.members.filter(isOnline).length,
            spectators: r.d.spectators.length,
            inGame: r.inGame,
            round: g && r.inGame ? g.round : null,
            gameId: g?.id ?? null,
            createdAt: r.d.createdAt,
            lastActiveAt: r.d.lastActiveAt,
            idleTimeoutMs: ROOM_IDLE_MS,
          }
        })
        .sort((a, b) => Number(b.inGame) - Number(a.inGame) || b.createdAt - a.createdAt),
    )
  })

  app.get('/api/admin/games', requireAdmin, (_req, res) => {
    res.json(
      listGameRecords().map((g) => {
        const meta = JSON.parse(g.meta) as ReplayMeta
        return {
          id: g.id,
          code: g.code,
          round: g.round,
          status: g.status,
          winner: g.winner,
          startedAt: g.started_at,
          endedAt: g.ended_at,
          events: g.events,
          host: meta.users[meta.hostId] ?? '?',
          players: Object.values(meta.users),
        }
      }),
    )
  })

  app.get('/api/admin/games/:id', requireAdmin, (req, res) => {
    const g = getGameRecord(String(req.params.id))
    if (!g) return void res.status(404).json({ error: '对局不存在' })
    res.json({
      id: g.id,
      code: g.code,
      round: g.round,
      status: g.status,
      winner: g.winner,
      startedAt: g.started_at,
      endedAt: g.ended_at,
      events: getGameEvents(g.id),
    })
  })

  // 导出整局回放：每个事件附带当时的局面，gzip 压缩后下载，可在本地查看器离线回放
  app.get('/api/admin/games/:id/export', requireAdmin, (req, res) => {
    const g = getGameRecord(String(req.params.id))
    if (!g) return void res.status(404).json({ error: '对局不存在' })
    const meta = JSON.parse(g.meta) as ReplayMeta
    const file: ReplayFile = {
      format: 'monopoly-replay',
      version: 1,
      exportedAt: Date.now(),
      game: {
        id: g.id,
        code: g.code,
        round: g.round,
        status: g.status,
        winner: g.winner,
        startedAt: g.started_at,
        endedAt: g.ended_at,
      },
      events: getGameEvents(g.id).map((e) => ({ ...e, view: Room.replayView(meta, getGameEventState(g.id, e.seq) as GameState) })),
    }
    const day = new Date(g.started_at).toISOString().slice(0, 10).replace(/-/g, '')
    const name = `大富翁回放-房间${g.code}-第${g.round}局-${day}.mfreplay`
    res.setHeader('Content-Type', 'application/gzip')
    res.setHeader('Content-Disposition', `attachment; filename="monopoly-${g.code}-${g.round}.mfreplay"; filename*=UTF-8''${encodeURIComponent(name)}`)
    res.send(Buffer.from(Bun.gzipSync(JSON.stringify(file))))
  })

  app.get('/api/admin/games/:id/events/:seq', requireAdmin, (req, res) => {
    const g = getGameRecord(String(req.params.id))
    const state = g && (getGameEventState(g.id, Number(req.params.seq)) as GameState | null)
    if (!g || !state) return void res.status(404).json({ error: '事件不存在' })
    res.json(Room.replayView(JSON.parse(g.meta) as ReplayMeta, state))
  })
}
