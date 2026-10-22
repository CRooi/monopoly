import {
  AIRLINE_RENT,
  AUCTION_BID_MS,
  AUCTION_MS,
  BAIL,
  DUEL_PICK_MS,
  DUEL_ROLL_MS,
  DUEL_STAKE,
  EMOTES,
  RENT_CLAIM_MS,
  SHAKE_EXTEND_MS,
  SHAKE_MS,
  BOARD,
  SPICE_LEVELS,
  THEME_OPTIONS,
  boardFor,
  themeOf,
  DEFAULT_CONFIG,
  GO_SALARY,
  JAIL_POS,
  MAX_PLAYERS,
  MAX_SPECTATORS,
  MIN_PLAYERS,
  PLAYER_COLORS,
  ROUND_OPTIONS,
  START_CASH_OPTIONS,
  cleanAvatar,
  UTILITY_MULT,
  groupTiles,
  isBuyable,
  mortgageValue,
  unmortgageCost,
  type BuyableTile,
  type ClientMessage,
  type DrawnCard,
  type EggKind,
  type EndReason,
  type GamePlayer,
  type GameView,
  type RoomConfig,
  type StateView,
  type Trade,
  type TradeSide,
} from '../../shared/types'

export class GameError extends Error {}

/** 房间空闲多久后自动解散（默认 30 分钟，可用 ROOM_IDLE_MINUTES 调整） */
export const ROOM_IDLE_MS = (Number(process.env.ROOM_IDLE_MINUTES) > 0 ? Number(process.env.ROOM_IDLE_MINUTES) : 30) * 60_000
/** 解散前多久开始提醒（默认最后 5 分钟） */
export const ROOM_IDLE_WARN_MS = Math.min(5 * 60_000, ROOM_IDLE_MS / 2)

/** 空闲时长的中文描述 */
export function idleText(ms = ROOM_IDLE_MS) {
  return ms >= 60_000 ? `${Math.round(ms / 60_000)} 分钟` : `${Math.round(ms / 1000)} 秒`
}

const fail = (msg: string): never => {
  throw new GameError(msg)
}

/** 日志最多保留的条数 */
const MAX_LOG = 300
/** 每人同时最多发起的交易 */
const MAX_TRADES_PER_PLAYER = 3

export interface User {
  id: string
  token: string
  name: string
}

/** 对局的完整状态：比发给客户端的视图多出牌堆顺序和内部计数 */
/** 每个人这一局的统计，结算时挑高光 */
export interface Stats {
  rentPaid: number
  rentGot: number
  jail: number
  doubles: number
  /** 触发过的彩蛋格子 */
  eggs: number[]
}

export interface GameState extends Omit<GameView, 'shakeMs' | 'now'> {
  stats: Record<string, Stats>
  /** 这一局最贵的一笔租金 */
  topRent: { payer: string; owner: string; tile: number; amount: number } | null
  /** 骰子摇到什么时候停（时间戳），没在摇为 null */
  shakeUntil: number | null
  /** 上一次延长摇骰的时间，每过 SHAKE_EXTEND_MS 才能再延长一次 */
  shakeExtendedAt: number
  decks: { chance: number[]; chest: number[] }
  /** 欠款还清后要接着做的事：第三次没掷出双数时先交保释金再走 */
  afterDebt: { move: number } | null
  seq: number
}

export interface RoomData {
  code: string
  createdAt: number
  lastActiveAt: number
  config: RoomConfig
  hostId: string
  users: Record<string, User>
  /** 玩家，按进房顺序 */
  members: string[]
  /** 玩家的头像 */
  avatars: Record<string, number>
  spectators: string[]
  game: GameState | null
}

/** 回放用的元数据 */
export interface ReplayMeta {
  code: string
  config: RoomConfig
  hostId: string
  users: Record<string, string>
}

const uid = () => crypto.randomUUID().slice(0, 8)

export function genCode(exists: (c: string) => boolean): string {
  for (;;) {
    const code = String(Math.floor(1000 + Math.random() * 9000))
    if (!exists(code)) return code
  }
}

export function cleanName(name: unknown): string {
  const n = String(name ?? '').trim().slice(0, 12)
  if (!n) fail('请先给自己取个名字')
  return n
}

export function validateConfig(c: Partial<RoomConfig> | undefined): RoomConfig {
  const v = { ...DEFAULT_CONFIG, ...(c ?? {}) }
  return {
    startCash: START_CASH_OPTIONS.includes(Number(v.startCash)) ? Number(v.startCash) : DEFAULT_CONFIG.startCash,
    maxRounds: ROUND_OPTIONS.includes(Number(v.maxRounds)) ? Number(v.maxRounds) : DEFAULT_CONFIG.maxRounds,
    parkingPot: !!v.parkingPot,
    allowSpectators: !!v.allowSpectators,
    theme: THEME_OPTIONS.includes(v.theme) ? v.theme : DEFAULT_CONFIG.theme,
    rentClaim: v.rentClaim !== false,
    auction: v.auction !== false,
    cityEvents: v.cityEvents !== false,
  }
}

const money = (n: number) => `$${n}`

// ---------------- 机会与命运卡 ----------------

interface Card {
  text: string
  act: (r: Room) => void
}

const JAIL_CARD_TEXT = '获得一张出狱卡，可以留着以后用'

const CHANCE: Card[] = [
  { text: '前进到起点，领取 $200', act: (r) => r.moveTo(0) },
  { text: '前进到{39}，经过起点领取 $200', act: (r) => r.moveTo(39) },
  { text: '前进到{21}，经过起点领取 $200', act: (r) => r.moveTo(21) },
  { text: '前进到{11}，经过起点领取 $200', act: (r) => r.moveTo(11) },
  { text: '前往{5}，经过起点领取 $200', act: (r) => r.moveTo(5) },
  { text: '前进到最近的{transit}，有主人时付双倍租金', act: (r) => r.moveToNearest('airline') },
  { text: '前进到最近的{transit}，有主人时付双倍租金', act: (r) => r.moveToNearest('airline') },
  { text: '前进到最近的公用事业，有主人时按骰子点数付 10 倍', act: (r) => r.moveToNearest('utility') },
  { text: '银行分红，领取 $50', act: (r) => r.receive(50) },
  { text: JAIL_CARD_TEXT, act: (r) => r.gainJailCard() },
  { text: '后退 3 格', act: (r) => r.moveBack(3) },
  { text: '直接入狱，不经过起点', act: (r) => r.sendToJail() },
  { text: '房屋大修：每栋房子付 $25，每家酒店付 $100', act: (r) => r.repairs(25, 100) },
  { text: '超速罚款 $15', act: (r) => r.charge(15, [], '超速罚款') },
  { text: '当选董事长，付给每位玩家 $50', act: (r) => r.payEachPlayer(50) },
  { text: '建筑贷款到期，领取 $150', act: (r) => r.receive(150) },
  { text: '领 $100，还是赌一把？', act: (r) => r.offerChoice('chance', 'cash-or-gamble', '领 $100，还是赌一把？', ['领 $100', '赌一把：掷出双数领 $300']) },
  { text: '超速被拍，交 $50 罚款，还是赌一把？', act: (r) => r.offerChoice('chance', 'fine-or-gamble', '超速被拍，交 $50 罚款，还是赌一把？', ['交 $50', '赌一把：8 点以上免罚，否则交 $150']) },
]

const CHEST: Card[] = [
  { text: '前进到起点，领取 $200', act: (r) => r.moveTo(0) },
  { text: '银行算错账，领取 $200', act: (r) => r.receive(200) },
  { text: '看病花费 $50', act: (r) => r.charge(50, [], '看病') },
  { text: '卖出股票，领取 $50', act: (r) => r.receive(50) },
  { text: JAIL_CARD_TEXT, act: (r) => r.gainJailCard() },
  { text: '直接入狱，不经过起点', act: (r) => r.sendToJail() },
  { text: '假日基金到期，领取 $100', act: (r) => r.receive(100) },
  { text: '所得税退税，领取 $20', act: (r) => r.receive(20) },
  { text: '今天是你的生日，每位玩家送你 $10', act: (r) => r.collectFromEach(10) },
  { text: '人寿保险到期，领取 $100', act: (r) => r.receive(100) },
  { text: '住院费 $100', act: (r) => r.charge(100, [], '住院费') },
  { text: '学费 $50', act: (r) => r.charge(50, [], '学费') },
  { text: '咨询费收入，领取 $25', act: (r) => r.receive(25) },
  { text: '街道维修：每栋房子付 $40，每家酒店付 $115', act: (r) => r.repairs(40, 115) },
  { text: '选美比赛二等奖，领取 $10', act: (r) => r.receive(10) },
  { text: '继承遗产，领取 $100', act: (r) => r.receive(100) },
  { text: '前进 3 格，还是后退 3 格？', act: (r) => r.offerChoice('chest', 'step', '前进 3 格，还是后退 3 格？', ['前进 3 格', '后退 3 格']) },
]

/** 全城事件：从第 2 轮起每轮开局翻一张，影响整轮 */
const CITY_EVENTS = [
  { key: 'cooldown', title: '楼市降温', text: '本轮所有租金减半' },
  { key: 'boom', title: '楼市火爆', text: '本轮所有租金 ×1.5' },
  { key: 'inflation', title: '通货膨胀', text: '本轮经过起点领 $300' },
  { key: 'redpacket', title: '全民红包', text: '每人领 $100' },
  { key: 'typhoon', title: '台风过境', text: '每家拆掉一栋房子，按半价赔偿' },
  { key: 'speedup', title: '交通提速', text: '本轮{transit}租金翻倍' },
  { key: 'taxday', title: '交税日', text: '每人交现金的 10%' },
  { key: 'calm', title: '风平浪静', text: '什么也没发生' },
]

const DECKS = { chance: CHANCE, chest: CHEST }
const JAIL_CARD = { chance: CHANCE.findIndex((c) => c.text === JAIL_CARD_TEXT), chest: CHEST.findIndex((c) => c.text === JAIL_CARD_TEXT) }

// ---------------- 房间 ----------------

export class Room {
  /** 随机数来源，测试时可替换 */
  rng: () => number = Math.random
  /**
   * 计时器到点后执行的操作（骰子摇完）不是由玩家消息触发的，
   * 由传输层包一层：记录对局事件、保存、推送；默认直接执行（测试用）
   */
  runAsync: (actor: string, msg: ClientMessage, fn: () => void) => void = (_a, _m, fn) => fn()
  /** 各种倒计时：摇骰子、等房东收租、拍卖、对决 */
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  /** 每个人上次发表情的时间，防刷屏 */
  private lastEmote = new Map<string, number>()

  constructor(public d: RoomData) {
    // 兼容旧版本保存的房间
    d.config.theme ??= 'world'
    d.config.rentClaim ??= true
    d.config.auction ??= true
    d.config.cityEvents ??= true
    // 重启前正在计时的事接着计时，到点（或已经过点）就照常处理
    const g = d.game
    if (g && g.phase !== 'over') {
      if (g.shakeUntil) this.armShake()
      if (g.rentClaim) this.arm('claim', g.rentClaim.until, () => this.expireClaim())
      if (g.auction) this.arm('auction', g.auction.until, () => this.finishAuction())
      if (g.duel && !g.duel.done) this.arm('duel', g.duel.until, () => this.duelTimeout())
    }
  }

  /** 到点后执行；由传输层包一层，记录、保存、推送 */
  private arm(key: string, until: number, fn: () => void) {
    this.disarm(key)
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key)
        const g = this.d.game
        if (!g || g.phase === 'over') return
        this.runAsync(this.cur().id, { type: 'ping' }, fn)
      }, Math.max(0, until - Date.now())),
    )
  }

  private disarm(key: string) {
    const t = this.timers.get(key)
    if (t) clearTimeout(t)
    this.timers.delete(key)
  }

  /** 当前对局的主题；开局前按房间设置 */
  get theme() {
    return themeOf(this.d.game?.theme ?? this.d.config.theme)
  }

  get board() {
    return boardFor(this.theme.id)
  }

  tileName(i: number) {
    return this.board[i]!.name
  }

  /** 卡片文字里的 {格子号} 和 {transit} 换成当前主题的名字 */
  private fill(text: string) {
    return text.replace(/\{(\d+)\}/g, (_, i) => this.tileName(Number(i))).replace('{transit}', this.theme.transit)
  }

  /** 房间关闭时清掉计时器 */
  dispose() {
    for (const t of this.timers.values()) clearTimeout(t)
    this.timers.clear()
  }

  static create(code: string, config: Partial<RoomConfig> | undefined, hostName: unknown, avatar?: unknown): { room: Room; user: User } {
    const cfg = validateConfig(config)
    const user: User = { id: uid(), token: crypto.randomUUID(), name: cleanName(hostName) }
    const room = new Room({
      code,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      config: cfg,
      hostId: user.id,
      users: { [user.id]: user },
      members: [user.id],
      avatars: { [user.id]: cleanAvatar(avatar) },
      spectators: [],
      game: null,
    })
    return { room, user }
  }

  /** 记录一次操作 */
  touch() {
    this.d.lastActiveAt = Date.now()
  }

  /** 是否已空闲超过 timeoutMs */
  isIdle(now: number, timeoutMs: number) {
    return now - this.d.lastActiveAt >= timeoutMs
  }

  get inGame() {
    return !!this.d.game && this.d.game.phase !== 'over'
  }

  userByToken(token: string) {
    return Object.values(this.d.users).find((u) => u.token === token)
  }

  isSpectator(userId: string) {
    return this.d.spectators.includes(userId)
  }

  join(name: unknown, avatar?: unknown): User {
    if (this.inGame) fail('游戏进行中，无法加入，可以选择观战')
    if (this.d.members.length >= MAX_PLAYERS) fail(`房间已满（最多 ${MAX_PLAYERS} 人）`)
    const user: User = { id: uid(), token: crypto.randomUUID(), name: cleanName(name) }
    this.d.users[user.id] = user
    this.d.members.push(user.id)
    this.d.avatars[user.id] = cleanAvatar(avatar)
    return user
  }

  /** 以观战身份加入：只能看不能操作，开局前和游戏中都可以加入 */
  spectate(name: unknown): User {
    if (!this.d.config.allowSpectators) fail('本房间不允许观战')
    if (this.d.spectators.length >= MAX_SPECTATORS) fail(`观战席已满（最多 ${MAX_SPECTATORS} 人）`)
    const user: User = { id: uid(), token: crypto.randomUUID(), name: cleanName(name) }
    this.d.users[user.id] = user
    this.d.spectators.push(user.id)
    return user
  }

  /** 移出房间；对局中的玩家先按破产处理，资产归还银行 */
  private removeUser(userId: string, reason: string) {
    const g = this.d.game
    if (g && this.inGame) {
      const p = g.players.find((x) => x.id === userId)
      if (p && !p.bankrupt) this.goBankrupt(p, [], reason)
    }
    this.d.members = this.d.members.filter((x) => x !== userId)
    this.d.spectators = this.d.spectators.filter((x) => x !== userId)
    delete this.d.avatars[userId]
    delete this.d.users[userId]
    if (this.d.hostId === userId && this.d.members[0]) this.d.hostId = this.d.members[0]
  }

  /** 处理一次操作，返回传输层需要执行的副作用 */
  handle(userId: string, msg: ClientMessage): { kicked?: string; disband?: boolean } {
    const isHost = userId === this.d.hostId
    const needHost = () => {
      if (!isHost) fail('只有房主可以操作')
    }
    const needLobby = () => {
      if (this.inGame) fail('游戏进行中')
    }

    switch (msg.type) {
      case 'ping':
      case 'extend':
        return {}
      case 'setAvatar':
        needLobby()
        if (!this.d.members.includes(userId)) fail('观战者不需要头像')
        this.d.avatars[userId] = cleanAvatar(msg.avatar)
        return {}
      case 'kick': {
        needHost()
        if (msg.userId === userId) fail('不能请出自己')
        if (!this.d.users[msg.userId]) fail('该玩家不在房间')
        const name = this.d.users[msg.userId]!.name
        this.removeUser(msg.userId, `${name} 被房主请出房间`)
        return { kicked: msg.userId }
      }
      case 'leave': {
        const name = this.d.users[userId]?.name
        this.removeUser(userId, `${name} 离开了房间`)
        if (this.d.members.length === 0) return { disband: true }
        return { kicked: userId }
      }
      case 'disband':
        needHost()
        return { disband: true }
      case 'updateConfig':
        needHost()
        needLobby()
        this.d.config = validateConfig(msg.config)
        return {}
      case 'start':
        needHost()
        needLobby()
        this.start()
        return {}
      case 'abort': {
        needHost()
        if (!this.inGame) fail('没有进行中的对局')
        this.log(`房主 ${this.d.users[userId]!.name} 结束了对局`)
        this.gameOver('aborted')
        return {}
      }
    }

    // 以下都是对局内的操作
    const g = this.d.game
    if (!g || g.phase === 'over') fail('游戏还没开始')
    const me = g!.players.find((p) => p.id === userId)
    if (!me) fail('观战者不能操作')
    // 表情：破产了也能发
    if (msg.type === 'emote') {
      this.emote(me!, msg.text, msg.to ?? null)
      return {}
    }
    if (me!.bankrupt) fail('你已经破产了')
    const mine = this.cur().id === userId

    switch (msg.type) {
      case 'tradePropose':
        this.proposeTrade(me!, msg.to, msg.give, msg.get)
        return {}
      case 'tradeRespond':
        this.respondTrade(me!, msg.id, msg.accept)
        return {}
      case 'tradeCancel': {
        const t = g!.trades.find((x) => x.id === msg.id && x.from === userId)
        if (!t) fail('交易已失效')
        g!.trades = g!.trades.filter((x) => x !== t)
        return {}
      }
      case 'bankrupt':
        // 欠债时破产，资产归债主；其他时候认输，资产归还银行
        this.goBankrupt(me!, mine && g!.phase === 'debt' ? g!.debt!.to : [], `${me!.name} 认输`)
        return {}
      // 收租由房东喊，出价、对决摇骰子也不限于当前玩家
      case 'claimRent':
        this.claimRent(me!)
        return {}
      case 'bid':
        this.bid(me!, msg.amount)
        return {}
      case 'duelRoll':
        this.duelRoll(me!)
        return {}
    }

    if (!mine) fail('还没轮到你')
    switch (msg.type) {
      case 'roll':
        if (g!.shakeUntil) fail('骰子正在摇')
        this.roll()
        break
      case 'shake':
        this.shake()
        break
      case 'step':
        this.step()
        break
      case 'buy':
        this.buy()
        break
      case 'pass':
        if (g!.phase !== 'buy') fail('现在不能这样做')
        this.log(`${me!.name} 放弃购买 ${this.tileName(me!.pos)}`, me!.id)
        if (this.d.config.auction) {
          this.startAuction(me!.pos)
          break
        }
        g!.phase = 'end'
        this.afterMove()
        break
      case 'duelPick':
        this.duelPick(me!, msg.target)
        break
      case 'chooseOption':
        this.chooseOption(msg.index)
        break
      case 'drawCard': {
        if (g!.phase !== 'draw') fail('现在不能抽卡')
        const t = this.board[me!.pos]!
        if (t.kind !== 'chance' && t.kind !== 'chest') fail('这里没有卡可抽')
        g!.phase = 'end'
        this.drawCard(t.kind as 'chance' | 'chest')
        this.afterMove()
        break
      }
      case 'endTurn':
        if (g!.phase !== 'end') fail(g!.phase === 'roll' ? '请先掷骰子' : '现在不能结束回合')
        this.nextTurn()
        break
      case 'payBail':
        if (g!.phase !== 'roll' || !me!.inJail) fail('现在不能这样做')
        if (me!.cash < BAIL) fail('现金不够')
        this.addPot(BAIL)
        me!.cash -= BAIL
        this.release(me!)
        this.log(`${me!.name} 支付 ${money(BAIL)} 保释出狱`, me!.id)
        break
      case 'useJailCard':
        if (g!.phase !== 'roll' || !me!.inJail) fail('现在不能这样做')
        if (me!.jailCards < 1) fail('你没有出狱卡')
        me!.jailCards--
        this.returnJailCard()
        this.release(me!)
        this.log(`${me!.name} 使用出狱卡出狱`, me!.id)
        break
      case 'build':
        this.build(me!, msg.tile)
        break
      case 'sell':
        this.sell(me!, msg.tile)
        break
      case 'mortgage':
        this.mortgage(me!, msg.tile)
        break
      case 'unmortgage':
        this.unmortgage(me!, msg.tile)
        break
      case 'payDebt':
        this.payDebt()
        break
      default:
        fail('未知操作')
    }
    return {}
  }

  // ---------------- 开局与回合 ----------------

  private start() {
    const ids = this.d.members
    if (ids.length < MIN_PLAYERS) fail(`至少需要 ${MIN_PLAYERS} 名玩家`)
    // 随机决定顺序
    const order = this.shuffle([...ids])
    const players: GamePlayer[] = order.map((id) => ({
      id,
      name: this.d.users[id]!.name,
      avatar: this.d.avatars[id] ?? 0,
      color: PLAYER_COLORS[ids.indexOf(id) % PLAYER_COLORS.length]!,
      cash: this.d.config.startCash,
      pos: 0,
      inJail: false,
      jailTurns: 0,
      jailCards: 0,
      bankrupt: false,
      bankruptOrder: null,
      skipTurns: 0,
      blessed: false,
      badges: [],
    }))
    this.d.game = {
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      players,
      turn: 0,
      round: 1,
      phase: 'roll',
      owners: {},
      debt: null,
      again: false,
      doubles: 0,
      lastRoll: null,
      theme: this.d.config.theme,
      spice: null,
      eggsSeen: [],
      egg: null,
      rentClaim: null,
      auction: null,
      duel: null,
      choice: null,
      gamble: null,
      event: null,
      emotes: [],
      stats: Object.fromEntries(players.map((p) => [p.id, { rentPaid: 0, rentGot: 0, jail: 0, doubles: 0, eggs: [] }])),
      topRent: null,
      shakeUntil: null,
      shakeExtendedAt: 0,
      shakeTaps: 0,
      stepsLeft: 0,
      card: null,
      trades: [],
      pot: 0,
      log: [],
      result: null,
      decks: { chance: this.shuffle(CHANCE.map((_, i) => i)), chest: this.shuffle(CHEST.map((_, i) => i)) },
      afterDebt: null,
      seq: 0,
    }
    this.log(`游戏开始，顺序：${players.map((p) => p.name).join(' → ')}`)
    this.log(`轮到 ${players[0]!.name}`, players[0]!.id)
  }

  private get g() {
    return this.d.game!
  }

  cur() {
    return this.g.players[this.g.turn]!
  }

  private shuffle<T>(a: T[]) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1))
      ;[a[i], a[j]] = [a[j]!, a[i]!]
    }
    return a
  }

  private die() {
    return 1 + Math.floor(this.rng() * 6)
  }

  log(text: string, who?: string) {
    const g = this.g
    g.log.push({ id: ++g.seq, ts: Date.now(), text, who })
    if (g.log.length > MAX_LOG) g.log.splice(0, g.log.length - MAX_LOG)
  }

  private roll() {
    const g = this.g
    if (g.phase !== 'roll') fail(g.phase === 'buy' ? '请先决定是否购买' : g.phase === 'draw' ? '请先抽卡' : g.phase === 'debt' ? '请先还清欠款' : '这回合已经掷过了')
    const p = this.cur()
    const dice: [number, number] = [this.die(), this.die()]
    // 北京天坛祈福：这一掷必出双数
    if (p.blessed) {
      dice[1] = dice[0]
      p.blessed = false
      this.log(`天坛祈福灵验了，${p.name} 掷出双数`, p.id)
    }
    const sum = dice[0] + dice[1]
    const isDouble = dice[0] === dice[1]
    g.lastRoll = { id: ++g.seq, dice, player: p.id }
    this.clearDisplays()
    g.phase = 'end'

    if (p.inJail) {
      if (isDouble) {
        this.release(p)
        this.log(`${p.name} 掷出 ${dice[0]}+${dice[1]} 双数，出狱`, p.id)
        g.again = false
        return this.startMove(sum)
      }
      p.jailTurns++
      if (p.jailTurns < 3) {
        this.log(`${p.name} 掷出 ${dice[0]}+${dice[1]}，没有双数，继续坐牢（第 ${p.jailTurns} 次）`, p.id)
        g.again = false
        return
      }
      // 第三次还没掷出双数：交保释金出狱，按点数前进
      this.log(`${p.name} 掷出 ${dice[0]}+${dice[1]}，三次都没有双数，必须交 ${money(BAIL)} 出狱`, p.id)
      g.again = false
      if (!this.charge(BAIL, [], '保释金')) {
        g.afterDebt = { move: sum }
        return
      }
      this.release(p)
      return this.startMove(sum)
    }

    if (isDouble) {
      g.doubles++
      const st = this.stats(p)
      st.doubles++
      if (st.doubles >= 5) this.award(p, '双数达人')
      if (g.doubles >= 3) {
        this.log(`${p.name} 连续三次掷出双数，超速入狱`, p.id)
        this.sendToJail()
        return
      }
    }
    g.again = isDouble
    this.log(`${p.name} 掷出 ${dice[0]}+${dice[1]}${isDouble ? '，双数' : ''}`, p.id)
    this.startMove(sum)
  }

  // ---------------- 摇骰子 ----------------

  /**
   * 摇骰子：第一次点摇 SHAKE_MS；摇的过程中再点，每过 SHAKE_EXTEND_MS 才能再加 SHAKE_EXTEND_MS，
   * 所以一直点就一直摇，松手后最多再摇 SHAKE_MS 就停。停下时才出点数。
   */
  private shake() {
    const g = this.g
    if (g.phase !== 'roll') fail(g.phase === 'move' ? '请先走完这一步' : '现在不能掷骰子')
    const now = Date.now()
    // 每点一下都记一次，大家的画面上都会飘字；延长时间仍然每秒最多一次
    g.shakeTaps = (g.shakeTaps ?? 0) + 1
    if (!g.shakeUntil) {
      g.shakeUntil = now + SHAKE_MS
      g.shakeExtendedAt = now
      this.clearDisplays()
    } else if (now - g.shakeExtendedAt >= SHAKE_EXTEND_MS) {
      g.shakeUntil += SHAKE_EXTEND_MS
      g.shakeExtendedAt = now
    } else return
    this.armShake()
  }

  private armShake() {
    const until = this.d.game?.shakeUntil
    if (!until) return this.disarm('shake')
    this.arm('shake', until, () => {
      if (this.g.phase === 'roll') this.stopShake()
    })
  }

  /** 骰子停下，出点数 */
  stopShake() {
    const g = this.g
    if (!g.shakeUntil) return
    g.shakeUntil = null
    this.roll()
  }

  private clearShake() {
    if (this.d.game) this.d.game.shakeUntil = null
    this.disarm('shake')
  }

  // ---------------- 自己走 ----------------

  /** 掷出点数后不自动走，由玩家一步一步走 */
  private startMove(steps: number) {
    const g = this.g
    g.phase = 'move'
    g.stepsLeft = steps
  }

  private step() {
    const g = this.g
    if (g.phase !== 'move' || g.stepsLeft <= 0) fail('现在不能走')
    const p = this.cur()
    p.pos = (p.pos + 1) % BOARD.length
    if (p.pos === 0) this.passGo(p)
    g.stepsLeft--
    if (g.stepsLeft > 0) return
    g.phase = 'end'
    this.land()
    this.afterMove()
  }

  /** 一次移动的结算结束：没有待决定的事就进入下一步 */
  private afterMove() {
    const g = this.g
    if (g.phase !== 'end') return
    g.phase = g.again ? 'roll' : 'end'
  }

  private nextTurn() {
    const g = this.g
    const n = g.players.length
    let i = g.turn
    let wrapped = false
    // 跳过破产的人；在排队买奶茶的人跳过一回合
    for (let k = 0; k < n * 3; k++) {
      const prev = i
      i = (i + 1) % n
      if (i <= prev) wrapped = true
      const p = g.players[i]!
      if (p.bankrupt) continue
      if (p.skipTurns > 0 && g.players.filter((x) => !x.bankrupt).length > 1) {
        p.skipTurns--
        this.log(`${p.name} 还在排队买奶茶，这回合歇着`, p.id)
        continue
      }
      break
    }
    this.clearShake()
    this.clearPending()
    if (wrapped) {
      g.round++
      const max = this.d.config.maxRounds
      if (max > 0 && g.round > max) {
        this.log(`已经进行了 ${max} 轮，按总资产排名`)
        return this.gameOver('rounds')
      }
      g.event = null
      if (this.d.config.cityEvents && g.round >= 2) this.drawEvent()
    }
    g.turn = i
    g.phase = 'roll'
    g.stepsLeft = 0
    g.doubles = 0
    g.again = false
    g.debt = null
    g.afterDebt = null
    const p = this.cur()
    this.log(`轮到 ${p.name}${p.inJail ? '（在监狱中）' : ''}`, p.id)
  }

  /** 换人时清掉还没处理完的收租、拍卖、对决、选择题 */
  private clearPending() {
    const g = this.g
    g.rentClaim = null
    g.auction = null
    g.choice = null
    if (g.duel && !g.duel.done) g.duel = null
    this.disarm('claim')
    this.disarm('auction')
    this.disarm('duel')
  }

  /** 新一掷开始时，收起上一掷留下的卡片、辣度、彩蛋、对决结果 */
  private clearDisplays() {
    const g = this.g
    g.card = null
    g.spice = null
    g.egg = null
    g.gamble = null
    if (g.duel?.done) g.duel = null
  }

  // ---------------- 移动 ----------------

  private passGo(p: GamePlayer) {
    const salary = this.g.event?.key === 'inflation' ? 300 : GO_SALARY
    p.cash += salary
    this.log(`${p.name} 经过起点，领取 ${money(salary)}`, p.id)
  }

  /** 前进到指定格子（经过起点领工资） */
  moveTo(target: number, mods: RentMods = {}) {
    const p = this.cur()
    if (target <= p.pos) this.passGo(p)
    p.pos = target
    this.land(mods)
  }

  moveToNearest(kind: 'airline' | 'utility') {
    const p = this.cur()
    for (let k = 1; k <= BOARD.length; k++) {
      const i = (p.pos + k) % BOARD.length
      if (this.board[i]!.kind === kind) return this.moveTo(i, kind === 'airline' ? { airlineDouble: true } : { utilityTen: true })
    }
  }

  moveBack(steps: number) {
    const p = this.cur()
    p.pos = (p.pos - steps + BOARD.length) % BOARD.length
    this.land()
  }

  sendToJail() {
    const p = this.cur()
    p.pos = JAIL_POS
    p.inJail = true
    p.jailTurns = 0
    this.g.again = false
    this.g.doubles = 0
    this.log(`${p.name} 进了监狱`, p.id)
    const st = this.stats(p)
    st.jail++
    if (st.jail >= 3) this.award(p, '坐牢专业户')
  }

  private release(p: GamePlayer) {
    p.inJail = false
    p.jailTurns = 0
  }

  /** 停在格子上的结算 */
  private land(mods: RentMods = {}) {
    const g = this.g
    const p = this.cur()
    const t = this.board[p.pos]!
    // 城市彩蛋：打滑、摩天轮会把人带走；其他的触发后照常结算这一格
    const egg = this.theme.eggs?.[p.pos]
    if (egg && egg !== 'hotpot') {
      if (this.triggerEgg(egg, p.pos)) return
      if (g.phase === 'over' || p.bankrupt) return
    }
    switch (t.kind) {
      case 'go':
      case 'jail':
        return
      case 'parking':
        if (this.d.config.parkingPot && g.pot > 0) {
          this.log(`${p.name} 在免费停车领走奖池 ${money(g.pot)}`, p.id)
          p.cash += g.pot
          g.pot = 0
        }
        return
      case 'gotojail':
        this.log(`${p.name} 停在「入狱」`, p.id)
        return this.sendToJail()
      case 'tax':
        this.log(`${p.name} 缴纳${t.name} ${money(t.amount)}`, p.id)
        this.charge(t.amount, [], t.name)
        return
      case 'chance':
      case 'chest':
        // 像线下一样由玩家自己翻卡
        g.phase = 'draw'
        this.log(`${p.name} 来到${t.name}`, p.id)
        return
      case 'duel':
        return this.startDuel()
    }
    const own = g.owners[p.pos]
    if (!own) {
      g.phase = 'buy'
      this.log(`${p.name} 来到 ${t.name}，售价 ${money(t.price)}`, p.id)
      return
    }
    if (own.owner === p.id) return
    const owner = this.player(own.owner)
    if (own.mortgaged) {
      this.log(`${p.name} 来到 ${owner.name} 的 ${t.name}，已抵押，免付租金`, p.id)
      return
    }
    let rent = this.rentOf(p.pos, mods)
    // 重庆火锅：先摇辣度，租金按辣度翻倍；火锅钱房东不用喊，必须付
    if (egg === 'hotpot') {
      const s = this.spice()
      g.spice = { id: ++g.seq, level: s.level, mult: s.mult, player: p.id }
      this.seeEgg(p, p.pos)
      rent = Math.round(rent * s.mult)
      this.log(`${t.name}火锅辣度：${s.level}${s.mult !== 1 ? `，租金 ×${s.mult}` : ''}`, p.id)
      if (s === SPICE_LEVELS.at(-1)) this.award(p, '火锅勇士')
    } else if (this.d.config.rentClaim) {
      // 房东自己喊收租，过时不候
      const until = Date.now() + RENT_CLAIM_MS
      g.rentClaim = { id: ++g.seq, tile: p.pos, from: p.id, to: owner.id, amount: rent, until }
      g.phase = 'claim'
      this.log(`${p.name} 来到 ${owner.name} 的 ${t.name}，就看房东喊不喊收租了`, p.id)
      this.arm('claim', until, () => this.expireClaim())
      return
    }
    this.log(`${p.name} 来到 ${owner.name} 的 ${t.name}，付租金 ${money(rent)}`, p.id)
    this.payRent(owner, rent, p.pos)
  }

  /** 当前玩家付租金给房东，并记进统计 */
  private payRent(owner: GamePlayer, rent: number, tile: number) {
    const g = this.g
    const p = this.cur()
    this.stats(p).rentPaid += rent
    this.stats(owner).rentGot += rent
    if (!g.topRent || rent > g.topRent.amount) g.topRent = { payer: p.id, owner: owner.id, tile, amount: rent }
    this.charge(rent, [owner.id], `${this.tileName(tile)} 的租金`)
  }

  // ---------------- 房东收租 ----------------

  private claimRent(me: GamePlayer) {
    const g = this.g
    const c = g.rentClaim
    if (g.phase !== 'claim' || !c || c.to !== me.id) fail('现在没有租可收')
    this.disarm('claim')
    g.rentClaim = null
    g.phase = 'end'
    const payer = this.player(c!.from)
    this.log(`${me.name} 喊了一声收租！${payer.name} 付租金 ${money(c!.amount)}`, me.id)
    this.payRent(me, c!.amount, c!.tile)
    this.afterMove()
  }

  /** 房东没在时限内喊收租：白住 */
  private expireClaim() {
    const g = this.g
    const c = g.rentClaim
    if (!c || g.phase !== 'claim') return
    g.rentClaim = null
    g.phase = 'end'
    this.log(`${this.player(c.to).name} 没注意，${this.player(c.from).name} 白住了一回`, c.from)
    this.afterMove()
  }

  // ---------------- 拍卖 ----------------

  private startAuction(tile: number) {
    const g = this.g
    const until = Date.now() + AUCTION_MS
    g.auction = { id: ++g.seq, tile, high: null, until }
    g.phase = 'auction'
    this.log(`${this.tileName(tile)} 开始拍卖，起拍 $10`)
    this.arm('auction', until, () => this.finishAuction())
  }

  private bid(me: GamePlayer, amount: number) {
    const g = this.g
    const a = g.auction
    if (g.phase !== 'auction' || !a) fail('现在没有拍卖')
    const n = Math.floor(Number(amount))
    const min = a!.high ? a!.high.amount + 10 : 10
    if (!Number.isFinite(n) || n < min) fail(`出价至少 ${money(min)}`)
    if (n > me.cash) fail('现金不够')
    a!.high = { player: me.id, amount: n }
    a!.until = Math.max(a!.until, Date.now() + AUCTION_BID_MS)
    this.log(`${me.name} 出价 ${money(n)}`, me.id)
    this.arm('auction', a!.until, () => this.finishAuction())
  }

  private finishAuction() {
    const g = this.g
    const a = g.auction
    if (!a || g.phase !== 'auction') return
    this.disarm('auction')
    g.auction = null
    const name = this.tileName(a.tile)
    const w = a.high ? this.player(a.high.player) : null
    if (a.high && w && !w.bankrupt && w.cash >= a.high.amount && !g.owners[a.tile]) {
      w.cash -= a.high.amount
      g.owners[a.tile] = { owner: w.id, houses: 0, mortgaged: false }
      this.log(`${w.name} 以 ${money(a.high.amount)} 拍下 ${name}`, w.id)
      this.firstLandlord(w)
    } else {
      this.log(`${name} 没人出价，流拍`)
    }
    g.phase = 'end'
    this.afterMove()
  }

  // ---------------- 对决 ----------------

  private startDuel() {
    const g = this.g
    const p = this.cur()
    if (!this.others().length) return
    const until = Date.now() + DUEL_PICK_MS
    g.duel = { id: ++g.seq, a: p.id, b: null, stake: DUEL_STAKE, rolls: {}, until, winner: null, done: false }
    g.phase = 'duel'
    this.log(`${p.name} 来到对决格，挑一个对手比骰子`, p.id)
    this.arm('duel', until, () => this.duelTimeout())
  }

  private duelPick(me: GamePlayer, target: string | null) {
    const g = this.g
    const d = g.duel
    if (g.phase !== 'duel' || !d || d.b) fail('现在不能挑对手')
    if (target === null) {
      this.disarm('duel')
      g.duel = null
      this.log(`${me.name} 不想比了`, me.id)
      g.phase = 'end'
      return this.afterMove()
    }
    const o = g.players.find((x) => x.id === target && !x.bankrupt && x.id !== me.id)
    if (!o) fail('对手无效')
    d!.b = o!.id
    d!.until = Date.now() + DUEL_ROLL_MS
    this.log(`${me.name} 向 ${o!.name} 发起对决，赌注 ${money(d!.stake)}`, me.id)
    this.arm('duel', d!.until, () => this.duelTimeout())
  }

  private duelRoll(me: GamePlayer) {
    const g = this.g
    const d = g.duel
    if (g.phase !== 'duel' || !d || !d.b || d.done) fail('现在没有对决')
    if (me.id !== d!.a && me.id !== d!.b) fail('这场对决没有你')
    if (d!.rolls[me.id]) fail('你已经摇过了')
    this.duelThrow(me)
    if (d!.rolls[d!.a] && d!.rolls[d!.b!]) this.resolveDuel()
  }

  private duelThrow(p: GamePlayer, auto = false) {
    const dice: [number, number] = [this.die(), this.die()]
    this.g.duel!.rolls[p.id] = dice
    this.log(`${p.name}${auto ? ' 没动静，替他' : ''} 摇出 ${dice[0]}+${dice[1]}`, p.id)
  }

  /** 对决超时：没挑对手就算了；没摇的替他摇 */
  private duelTimeout() {
    const g = this.g
    const d = g.duel
    if (!d || d.done || g.phase !== 'duel') return
    if (!d.b) {
      g.duel = null
      this.log(`${this.player(d.a).name} 没挑对手，对决取消`, d.a)
      g.phase = 'end'
      return this.afterMove()
    }
    for (const id of [d.a, d.b]) if (!d.rolls[id]) this.duelThrow(this.player(id), true)
    this.resolveDuel()
  }

  private resolveDuel() {
    const g = this.g
    const d = g.duel!
    this.disarm('duel')
    const sum = (id: string) => d.rolls[id]![0] + d.rolls[id]![1]
    const a = this.player(d.a)
    const b = this.player(d.b!)
    const diff = sum(a.id) - sum(b.id)
    d.done = true
    if (diff === 0) {
      this.log(`${a.name} 和 ${b.name} 点数一样，平局`)
    } else {
      const [win, lose] = diff > 0 ? [a, b] : [b, a]
      const amount = Math.min(d.stake, Math.max(0, lose.cash))
      lose.cash -= amount
      win.cash += amount
      d.winner = win.id
      this.log(`${win.name} 赢了对决，从 ${lose.name} 那里拿走 ${money(amount)}`, win.id)
    }
    g.phase = 'end'
    this.afterMove()
  }

  // ---------------- 选择题卡 ----------------

  offerChoice(deck: 'chance' | 'chest', key: string, text: string, options: string[]) {
    const g = this.g
    g.choice = { id: ++g.seq, deck, key, text, options }
    g.phase = 'choose'
  }

  private chooseOption(index: number) {
    const g = this.g
    const c = g.choice
    if (g.phase !== 'choose' || !c) fail('现在没有要选的')
    const opt = c!.options[Math.floor(Number(index))]
    if (opt === undefined) fail('没有这个选项')
    const p = this.cur()
    g.choice = null
    g.phase = 'end'
    this.log(`${p.name} 选了：${opt}`, p.id)
    const pick = Math.floor(Number(index))
    const gamble = (win: boolean, text: string, dice: [number, number]) => {
      g.gamble = { id: ++g.seq, dice, win, text }
      this.log(`${p.name} 掷出 ${dice[0]}+${dice[1]}，${text}`, p.id)
    }
    switch (c!.key) {
      case 'cash-or-gamble':
        if (pick === 0) this.receive(100)
        else {
          const dice: [number, number] = [this.die(), this.die()]
          const win = dice[0] === dice[1]
          gamble(win, win ? '双数！领 $300' : '没中，什么都没有', dice)
          if (win) this.receive(300)
        }
        break
      case 'fine-or-gamble':
        if (pick === 0) this.charge(50, [], '罚款')
        else {
          const dice: [number, number] = [this.die(), this.die()]
          const win = dice[0] + dice[1] >= 8
          gamble(win, win ? '免罚！' : '没逃掉，交 $150', dice)
          if (!win) this.charge(150, [], '罚款')
        }
        break
      case 'step':
        if (pick === 0) this.moveTo((p.pos + 3) % BOARD.length)
        else this.moveBack(3)
        break
    }
    this.afterMove()
  }

  // ---------------- 表情 ----------------

  private emote(me: GamePlayer, index: number, to: string | null) {
    const g = this.g
    const text = EMOTES[Math.floor(Number(index))]
    if (!text) fail('没有这个表情')
    // 防刷屏：太快的直接忽略
    const now = Date.now()
    if (now - (this.lastEmote.get(me.id) ?? 0) < 1200) return
    this.lastEmote.set(me.id, now)
    const target = to && g.players.some((p) => p.id === to) ? to : null
    g.emotes = [...(g.emotes ?? []), { id: ++g.seq, from: me.id, to: target, text: text! }].slice(-12)
  }

  // ---------------- 全城事件 ----------------

  private drawEvent() {
    const g = this.g
    const e = CITY_EVENTS[Math.floor(this.rng() * CITY_EVENTS.length)]!
    const text = this.fill(e.text)
    g.event = { id: ++g.seq, key: e.key, title: e.title, text, round: g.round }
    this.log(`全城事件「${e.title}」：${text}`)
    const alive = g.players.filter((p) => !p.bankrupt)
    switch (e.key) {
      case 'redpacket':
        for (const p of alive) p.cash += 100
        break
      case 'taxday':
        for (const p of alive) {
          const tax = Math.floor(p.cash * 0.1)
          p.cash -= tax
          this.addPot(tax)
        }
        break
      case 'typhoon':
        for (const p of alive) {
          const built = Object.entries(g.owners)
            .filter(([, o]) => o.owner === p.id && o.houses > 0)
            .sort((a, b) => b[1].houses - a[1].houses)
          if (!built.length) continue
          const [key, o] = built[0]!
          const t = this.board[Number(key)] as Extract<BuyableTile, { kind: 'country' }>
          o.houses--
          p.cash += t.house / 2
          this.log(`台风吹倒了 ${p.name} 在 ${t.name} 的一栋房子，赔偿 ${money(t.house / 2)}`, p.id)
        }
        break
    }
  }

  // ---------------- 城市彩蛋 ----------------

  /** 触发彩蛋；把人带走了（打滑、摩天轮）返回 true，这一格就不再结算 */
  private triggerEgg(kind: EggKind, tile: number): boolean {
    const g = this.g
    const p = this.cur()
    const name = this.tileName(tile)
    switch (kind) {
      case 'slide': {
        const n = 1 + Math.floor(this.rng() * 3)
        this.markEgg(kind, tile, `${name}的冰面太滑，${p.name} 一路滑出去 ${n} 格`)
        for (let k = 0; k < n; k++) {
          p.pos = (p.pos + 1) % BOARD.length
          if (p.pos === 0) this.passGo(p)
        }
        this.land()
        return true
      }
      case 'wheel': {
        const free = this.board.flatMap((t, i) => (isBuyable(t) && !g.owners[i] && i !== tile ? [i] : []))
        if (!free.length) {
          this.markEgg(kind, tile, `${p.name} 坐了一圈${name}的摩天轮，又回到了原地`)
          return false
        }
        const to = free[Math.floor(this.rng() * free.length)]!
        this.markEgg(kind, tile, `${p.name} 坐上${name}的摩天轮，转了一圈落到 ${this.tileName(to)}`)
        p.pos = to
        this.land()
        return true
      }
      case 'dig': {
        if (this.rng() < 0.5) {
          const amount = [50, 100, 200][Math.floor(this.rng() * 3)]!
          p.cash += amount
          this.markEgg(kind, tile, `${p.name} 在${name}一铲挖到宝贝，卖了 ${money(amount)}`)
        } else if (p.cash >= 50) {
          p.cash -= 50
          this.addPot(50)
          this.markEgg(kind, tile, `${p.name} 在${name}一铲挖坏了文物，交保护费 $50`)
        } else {
          this.markEgg(kind, tile, `${p.name} 在${name}一铲挖坏了文物，穷得交不起保护费，算了`)
        }
        return false
      }
      case 'dimsum': {
        const others = this.others()
        if (!others.length) return false
        if (this.rng() < 0.5 || p.cash < 10 * others.length) {
          this.markEgg(kind, tile, `大家请 ${p.name} 去${name}叹早茶，每人出 $10`)
          this.collectFromEach(10)
        } else {
          this.markEgg(kind, tile, `${p.name} 在${name}请大家叹早茶，每人 $10`)
          for (const o of others) {
            p.cash -= 10
            o.cash += 10
          }
        }
        return false
      }
      case 'milktea':
        p.skipTurns = 1
        p.cash += 30
        this.markEgg(kind, tile, `${p.name} 在${name}排队买奶茶，下回合歇一次，先领 $30`)
        return false
      case 'bless':
        p.blessed = true
        this.markEgg(kind, tile, `${p.name} 在${name}天坛祈福，下次掷骰子必出双数`)
        return false
    }
    return false
  }

  private markEgg(kind: EggKind, tile: number, text: string) {
    const g = this.g
    const p = this.cur()
    g.egg = { id: ++g.seq, tile, kind, text, player: p.id }
    this.log(text, p.id)
    this.seeEgg(p, tile)
  }

  /** 记下这一局揭晓过的彩蛋；一个人触发三个不同的彩蛋得徽章 */
  private seeEgg(p: GamePlayer, tile: number) {
    const g = this.g
    g.eggsSeen ??= []
    if (!g.eggsSeen.includes(tile)) g.eggsSeen.push(tile)
    const st = this.stats(p)
    if (!st.eggs.includes(tile)) st.eggs.push(tile)
    if (st.eggs.length >= 3) this.award(p, '彩蛋猎人')
  }

  // ---------------- 统计与徽章 ----------------

  private stats(p: GamePlayer): Stats {
    const g = this.g
    g.stats ??= {}
    return (g.stats[p.id] ??= { rentPaid: 0, rentGot: 0, jail: 0, doubles: 0, eggs: [] })
  }

  private award(p: GamePlayer, badge: string) {
    p.badges ??= []
    if (p.badges.includes(badge)) return
    p.badges.push(badge)
    this.log(`${p.name} 获得徽章「${badge}」`, p.id)
  }

  private firstLandlord(p: GamePlayer) {
    if (!this.g.players.some((x) => x.badges?.includes('首个地主'))) this.award(p, '首个地主')
  }

  /** 结算时的本局高光 */
  private highlights() {
    const g = this.g
    const out: { title: string; text: string; player?: string }[] = []
    if (g.topRent) {
      const t = g.topRent
      out.push({
        title: '最贵的一笔租金',
        text: `${this.player(t.payer).name} 在 ${this.tileName(t.tile)} 付给 ${this.player(t.owner).name} ${money(t.amount)}`,
        player: t.payer,
      })
    }
    const best = (key: 'rentGot' | 'rentPaid' | 'jail' | 'doubles') => {
      let top: GamePlayer | null = null
      for (const p of g.players) if (this.stats(p)[key] > (top ? this.stats(top)[key] : 0)) top = p
      return top
    }
    const king = best('rentGot')
    if (king) {
      this.award(king, '收租王')
      out.push({ title: '收租王', text: `${king.name} 一共收了 ${money(this.stats(king).rentGot)} 租金`, player: king.id })
    }
    const sucker = best('rentPaid')
    if (sucker) out.push({ title: '最佳租客', text: `${sucker.name} 一共交了 ${money(this.stats(sucker).rentPaid)} 租金`, player: sucker.id })
    const jail = best('jail')
    if (jail) out.push({ title: '监狱常客', text: `${jail.name} 进了 ${this.stats(jail).jail} 次监狱`, player: jail.id })
    const lucky = best('doubles')
    if (lucky) out.push({ title: '双数之王', text: `${lucky.name} 掷出 ${this.stats(lucky).doubles} 次双数`, player: lucky.id })
    return out
  }

    private spice() {
    const total = SPICE_LEVELS.reduce((n, s) => n + s.weight, 0)
    let r = this.rng() * total
    for (const s of SPICE_LEVELS) {
      r -= s.weight
      if (r < 0) return s
    }
    return SPICE_LEVELS[0]!
  }

  /** 租金：基础租金按本轮全城事件调整 */
  rentOf(pos: number, mods: RentMods = {}) {
    const base = this.baseRent(pos, mods)
    const ev = this.g.event?.key
    let mult = ev === 'cooldown' ? 0.5 : ev === 'boom' ? 1.5 : 1
    if (ev === 'speedup' && this.board[pos]!.kind === 'airline') mult *= 2
    return Math.round(base * mult)
  }

  private baseRent(pos: number, mods: RentMods = {}) {
    const g = this.g
    const t = this.board[pos] as BuyableTile
    const own = g.owners[pos]
    if (!own) return 0
    const count = (kind: 'airline' | 'utility') =>
      BOARD.filter((x, i) => x.kind === kind && g.owners[i]?.owner === own.owner).length
    if (t.kind === 'country') {
      if (own.houses > 0) return t.rent[own.houses]!
      return t.rent[0] * (this.ownsGroup(own.owner, pos) ? 2 : 1)
    }
    if (t.kind === 'airline') return AIRLINE_RENT[count('airline') - 1]! * (mods.airlineDouble ? 2 : 1)
    const sum = g.lastRoll ? g.lastRoll.dice[0] + g.lastRoll.dice[1] : 7
    return sum * (mods.utilityTen ? 10 : UTILITY_MULT[count('utility') - 1]!)
  }

  private ownsGroup(owner: string, pos: number) {
    const t = this.board[pos]!
    if (t.kind !== 'country') return false
    return groupTiles(t.group).every((i) => this.g.owners[i]?.owner === owner)
  }

  private player(id: string) {
    return this.g.players.find((p) => p.id === id)!
  }

  // ---------------- 卡片 ----------------

  private drawCard(deck: 'chance' | 'chest') {
    const g = this.g
    const p = this.cur()
    const idx = g.decks[deck].shift()!
    const card = DECKS[deck][idx]!
    // 出狱卡由玩家保留，用掉后才放回牌堆
    if (idx !== JAIL_CARD[deck]) g.decks[deck].push(idx)
    const text = this.fill(card.text)
    const drawn: DrawnCard = { id: ++g.seq, deck, text, player: p.id }
    g.card = drawn
    this.log(`${p.name} 抽到${deck === 'chance' ? '机会' : '命运'}：${text}`, p.id)
    card.act(this)
  }

  receive(amount: number) {
    this.cur().cash += amount
  }

  gainJailCard() {
    this.cur().jailCards++
  }

  private returnJailCard() {
    const decks = this.g.decks
    if (!decks.chance.includes(JAIL_CARD.chance)) decks.chance.push(JAIL_CARD.chance)
    else if (!decks.chest.includes(JAIL_CARD.chest)) decks.chest.push(JAIL_CARD.chest)
  }

  repairs(perHouse: number, perHotel: number) {
    const p = this.cur()
    let total = 0
    for (const own of Object.values(this.g.owners)) {
      if (own.owner !== p.id) continue
      total += own.houses === 5 ? perHotel : own.houses * perHouse
    }
    if (total === 0) return this.log(`${p.name} 没有房子，不用付钱`, p.id)
    this.log(`${p.name} 需要支付维修费 ${money(total)}`, p.id)
    this.charge(total, [], '维修费')
  }

  private others() {
    return this.g.players.filter((x) => !x.bankrupt && x.id !== this.cur().id)
  }

  payEachPlayer(amount: number) {
    const others = this.others()
    this.charge(amount * others.length, others.map((x) => x.id), '董事长津贴')
  }

  /** 其他玩家各付给当前玩家；付不起的自动卖房、抵押，仍不够就破产 */
  collectFromEach(amount: number) {
    const p = this.cur()
    for (const o of this.others()) {
      if (o.cash < amount) this.autoRaise(o, amount)
      if (o.cash >= amount) {
        o.cash -= amount
        p.cash += amount
      } else {
        this.log(`${o.name} 凑不出 ${money(amount)}`, o.id)
        this.goBankrupt(o, [p.id], `${o.name} 付不起礼金`)
      }
    }
  }

  // ---------------- 付款与欠款 ----------------

  private addPot(amount: number) {
    if (this.d.config.parkingPot) this.g.pot += amount
  }

  /** 当前玩家付款；现金不够时进入欠款状态，返回是否已付清 */
  charge(amount: number, to: string[], reason: string): boolean {
    const g = this.g
    const p = this.cur()
    if (amount <= 0) return true
    if (p.cash >= amount) {
      this.transfer(p, amount, to)
      return true
    }
    g.debt = { amount, to, reason }
    g.phase = 'debt'
    this.log(`${p.name} 现金不足以支付 ${reason} ${money(amount)}，需要卖房、抵押或交易凑钱`, p.id)
    return false
  }

  private transfer(p: GamePlayer, amount: number, to: string[]) {
    p.cash -= amount
    if (to.length === 0) return this.addPot(amount)
    const share = Math.floor(amount / to.length)
    for (const id of to) this.player(id).cash += share
  }

  private payDebt() {
    const g = this.g
    const p = this.cur()
    const debt = g.debt
    if (g.phase !== 'debt' || !debt) fail('没有需要支付的欠款')
    if (p.cash < debt!.amount) fail(`现金还差 ${money(debt!.amount - p.cash)}`)
    this.transfer(p, debt!.amount, debt!.to)
    this.log(`${p.name} 付清了 ${debt!.reason} ${money(debt!.amount)}`, p.id)
    g.debt = null
    g.phase = 'end'
    const after = g.afterDebt
    g.afterDebt = null
    if (after) {
      this.release(p)
      return this.startMove(after.move)
    }
    this.afterMove()
  }

  /** 自动凑钱：先卖房子，再抵押，直到够付 amount */
  private autoRaise(p: GamePlayer, amount: number) {
    const g = this.g
    const owned = () => Object.entries(g.owners).filter(([, o]) => o.owner === p.id).map(([i, o]) => [Number(i), o] as const)
    while (p.cash < amount) {
      const withHouses = owned().filter(([, o]) => o.houses > 0).sort((a, b) => b[1].houses - a[1].houses)
      if (!withHouses.length) break
      const [i, o] = withHouses[0]!
      o.houses--
      p.cash += (this.board[i] as Extract<BuyableTile, { kind: 'country' }>).house / 2
    }
    for (const [i, o] of owned()) {
      if (p.cash >= amount) break
      if (o.mortgaged) continue
      o.mortgaged = true
      p.cash += mortgageValue(this.board[i] as BuyableTile)
    }
  }

  /**
   * 破产：房子按半价卖回银行，现金和地产交给债主；
   * 没有债主（欠银行、认输、离开）时地产收归银行，可以重新购买。
   */
  private goBankrupt(p: GamePlayer, to: string[], reason: string) {
    const g = this.g
    const heir = to.length === 1 ? this.player(to[0]!) : null
    for (const [key, o] of Object.entries(g.owners)) {
      if (o.owner !== p.id) continue
      const i = Number(key)
      const t = this.board[i]!
      if (o.houses > 0 && t.kind === 'country') p.cash += (o.houses * t.house) / 2
      o.houses = 0
      if (heir) o.owner = heir.id
      else delete g.owners[i]
    }
    if (heir) {
      heir.cash += Math.max(0, p.cash)
      heir.jailCards += p.jailCards
    } else {
      for (let k = 0; k < p.jailCards; k++) this.returnJailCard()
    }
    p.cash = 0
    p.jailCards = 0
    p.bankrupt = true
    p.inJail = false
    p.bankruptOrder = g.players.filter((x) => x.bankrupt).length
    g.trades = g.trades.filter((t) => t.from !== p.id && t.to !== p.id)
    this.log(`${reason}，${p.name} 破产${heir ? `，资产归 ${heir.name}` : '，地产收归银行'}`, p.id)
    // 正在进行的拍卖、收租、对决里有他，按他不在处理
    if (g.auction?.high?.player === p.id) g.auction.high = null
    const isCur = this.cur().id === p.id
    if (!isCur && g.rentClaim?.to === p.id) {
      this.disarm('claim')
      g.rentClaim = null
      g.phase = 'end'
      this.afterMove()
    }
    if (!isCur && g.duel && !g.duel.done && g.duel.b === p.id) {
      this.disarm('duel')
      g.duel = null
      g.phase = 'end'
      this.afterMove()
    }

    const alive = g.players.filter((x) => !x.bankrupt)
    if (alive.length <= 1) return this.gameOver('lastStanding')
    if (this.cur().id === p.id) {
      g.debt = null
      g.afterDebt = null
      this.nextTurn()
    }
  }

  // ---------------- 购买与经营 ----------------

  private buy() {
    const g = this.g
    if (g.phase !== 'buy') fail('现在不能购买')
    const p = this.cur()
    const t = this.board[p.pos] as BuyableTile
    if (p.cash < t.price) fail('现金不够')
    p.cash -= t.price
    g.owners[p.pos] = { owner: p.id, houses: 0, mortgaged: false }
    this.log(`${p.name} 买下 ${t.name}，花费 ${money(t.price)}`, p.id)
    this.firstLandlord(p)
    g.phase = 'end'
    this.afterMove()
  }

  private needOwn(p: GamePlayer, tile: number) {
    const own = this.g.owners[tile]
    if (!own || own.owner !== p.id) fail('这不是你的地')
    return own!
  }

  /** 盖房子要在自己的回合，并且没有待决定的事 */
  private needManage() {
    const ph = this.g.phase
    if (ph !== 'roll' && ph !== 'end') fail(ph === 'debt' ? '欠款期间只能卖房和抵押' : ph === 'draw' ? '请先抽卡' : '请先决定是否购买')
  }

  private build(p: GamePlayer, tile: number) {
    this.needManage()
    const own = this.needOwn(p, tile)
    const t = this.board[tile]!
    if (t.kind !== 'country') fail(`只有${this.theme.land}可以盖房子`)
    const c = t as Extract<BuyableTile, { kind: 'country' }>
    const group = groupTiles(c.group)
    if (!this.ownsGroup(p.id, tile)) fail(`需要先集齐同色的全部${this.theme.land}`)
    if (group.some((i) => this.g.owners[i]!.mortgaged)) fail(`同色有${this.theme.land}在抵押中，不能盖房`)
    if (own.houses >= 5) fail('已经有酒店了')
    const min = Math.min(...group.map((i) => this.g.owners[i]!.houses))
    if (own.houses > min) fail(`同色${this.theme.land}要平均盖房，先盖房子少的`)
    if (p.cash < c.house) fail('现金不够')
    p.cash -= c.house
    own.houses++
    this.log(`${p.name} 在 ${c.name} ${own.houses === 5 ? '升级为酒店' : `盖了第 ${own.houses} 栋房子`}，花费 ${money(c.house)}`, p.id)
  }

  private sell(p: GamePlayer, tile: number) {
    if (this.g.phase === 'buy') fail('请先决定是否购买')
    const own = this.needOwn(p, tile)
    const t = this.board[tile]!
    if (t.kind !== 'country' || own.houses === 0) fail('这里没有房子')
    const c = t as Extract<BuyableTile, { kind: 'country' }>
    const max = Math.max(...groupTiles(c.group).map((i) => this.g.owners[i]!.houses))
    if (own.houses < max) fail(`同色${this.theme.land}要平均拆房，先拆房子多的`)
    own.houses--
    p.cash += c.house / 2
    this.log(`${p.name} 卖掉 ${c.name} 的${own.houses === 4 ? '酒店' : '一栋房子'}，收回 ${money(c.house / 2)}`, p.id)
  }

  private mortgage(p: GamePlayer, tile: number) {
    if (this.g.phase === 'buy') fail('请先决定是否购买')
    const own = this.needOwn(p, tile)
    if (own.mortgaged) fail('已经抵押了')
    const t = this.board[tile] as BuyableTile
    if (t.kind === 'country' && groupTiles(t.group).some((i) => (this.g.owners[i]?.houses ?? 0) > 0)) fail(`同色${this.theme.land}还有房子，要先卖掉`)
    own.mortgaged = true
    p.cash += mortgageValue(t)
    this.log(`${p.name} 抵押 ${t.name}，得到 ${money(mortgageValue(t))}`, p.id)
  }

  private unmortgage(p: GamePlayer, tile: number) {
    this.needManage()
    const own = this.needOwn(p, tile)
    if (!own.mortgaged) fail('没有抵押')
    const t = this.board[tile] as BuyableTile
    const cost = unmortgageCost(t)
    if (p.cash < cost) fail('现金不够')
    p.cash -= cost
    own.mortgaged = false
    this.log(`${p.name} 赎回 ${t.name}，花费 ${money(cost)}`, p.id)
  }

  // ---------------- 交易 ----------------

  private cleanSide(s: Partial<TradeSide> | undefined): TradeSide {
    const tiles = [...new Set((Array.isArray(s?.tiles) ? s!.tiles : []).map(Number))].filter((i) => Number.isInteger(i) && this.board[i] && isBuyable(this.board[i]!))
    return {
      cash: Math.max(0, Math.floor(Number(s?.cash) || 0)),
      tiles,
      jailCards: Math.max(0, Math.floor(Number(s?.jailCards) || 0)),
    }
  }

  /** 检查一方拿得出这些东西 */
  private checkSide(p: GamePlayer, s: TradeSide) {
    const g = this.g
    if (p.cash < s.cash) fail(`${p.name} 的现金不够 ${money(s.cash)}`)
    if (p.jailCards < s.jailCards) fail(`${p.name} 没有那么多出狱卡`)
    for (const i of s.tiles) {
      if (g.owners[i]?.owner !== p.id) fail(`${this.tileName(i)} 不属于 ${p.name}`)
      const t = this.board[i]!
      if (t.kind === 'country' && groupTiles(t.group).some((j) => (g.owners[j]?.houses ?? 0) > 0)) fail(`${this.tileName(i)} 同色还有房子，要先卖掉才能交易`)
    }
  }

  private proposeTrade(me: GamePlayer, to: string, give: TradeSide, get: TradeSide) {
    const g = this.g
    const other = g.players.find((p) => p.id === to && !p.bankrupt)
    if (!other || other.id === me.id) fail('交易对象无效')
    if (g.trades.filter((t) => t.from === me.id).length >= MAX_TRADES_PER_PLAYER) fail(`最多同时发起 ${MAX_TRADES_PER_PLAYER} 个交易`)
    const a = this.cleanSide(give)
    const b = this.cleanSide(get)
    if (!a.cash && !a.tiles.length && !a.jailCards && !b.cash && !b.tiles.length && !b.jailCards) fail('交易内容不能为空')
    this.checkSide(me, a)
    this.checkSide(other!, b)
    const trade: Trade = { id: uid(), from: me.id, to: other!.id, give: a, get: b }
    g.trades.push(trade)
    this.log(`${me.name} 向 ${other!.name} 提出交易：${this.tradeText(trade)}`, me.id)
  }

  private sideText(s: TradeSide) {
    const parts = [...s.tiles.map((i) => this.tileName(i))]
    if (s.cash) parts.push(money(s.cash))
    if (s.jailCards) parts.push(`${s.jailCards} 张出狱卡`)
    return parts.length ? parts.join('、') : '无'
  }

  private tradeText(t: Trade) {
    return `用 ${this.sideText(t.give)} 换 ${this.sideText(t.get)}`
  }

  private respondTrade(me: GamePlayer, id: string, accept: boolean) {
    const g = this.g
    const t = g.trades.find((x) => x.id === id && x.to === me.id)
    if (!t) fail('交易已失效')
    const from = this.player(t!.from)
    g.trades = g.trades.filter((x) => x !== t)
    if (!accept) {
      this.log(`${me.name} 拒绝了 ${from.name} 的交易`, me.id)
      return
    }
    this.checkSide(from, t!.give)
    this.checkSide(me, t!.get)
    const move = (a: GamePlayer, b: GamePlayer, s: TradeSide) => {
      a.cash -= s.cash
      b.cash += s.cash
      a.jailCards -= s.jailCards
      b.jailCards += s.jailCards
      for (const i of s.tiles) g.owners[i]!.owner = b.id
    }
    move(from, me, t!.give)
    move(me, from, t!.get)
    this.log(`${me.name} 接受了 ${from.name} 的交易：${this.tradeText(t!)}`, me.id)
    // 交易后部分地产易主，其他挂着的交易可能已经不成立，接受时会再检查
  }

  // ---------------- 结束 ----------------

  worth(p: GamePlayer) {
    let total = p.cash
    for (const [key, o] of Object.entries(this.g.owners)) {
      if (o.owner !== p.id) continue
      const t = this.board[Number(key)] as BuyableTile
      total += o.mortgaged ? t.price / 2 : t.price
      if (t.kind === 'country') total += o.houses * t.house
    }
    return total
  }

  private gameOver(reason: EndReason) {
    const g = this.g
    this.clearShake()
    this.clearPending()
    g.stepsLeft = 0
    const highlights = this.highlights()
    const standings = [...g.players]
      .sort((a, b) => {
        if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1
        if (a.bankrupt && b.bankrupt) return (b.bankruptOrder ?? 0) - (a.bankruptOrder ?? 0)
        return this.worth(b) - this.worth(a)
      })
      .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color, worth: this.worth(p), bankrupt: p.bankrupt, badges: p.badges ?? [] }))
    g.phase = 'over'
    g.debt = null
    g.trades = []
    g.result = { reason, standings, highlights }
    if (reason !== 'aborted') this.log(`游戏结束，${standings[0]!.name} 获胜`, standings[0]!.id)
  }

  // ---------------- 视图 ----------------

  /** 对局开始时用于回放的元数据 */
  replayMeta(): ReplayMeta {
    const users: Record<string, string> = {}
    for (const p of this.d.game?.players ?? []) users[p.id] = p.name
    return { code: this.d.code, config: this.d.config, hostId: this.d.hostId, users }
  }

  static gameView(g: GameState): GameView {
    const { decks: _d, afterDebt: _a, seq: _s, shakeUntil, shakeExtendedAt: _e, stats: _st, topRent: _t, ...view } = g
    // 旧版本保存的对局缺的字段补上默认值
    const legacy = view as Partial<GameView> & { spiceSeen?: boolean }
    return {
      ...view,
      players: view.players.map((p) => ({ ...p, skipTurns: p.skipTurns ?? 0, blessed: p.blessed ?? false, badges: p.badges ?? [] })),
      theme: view.theme ?? 'world',
      spice: view.spice ?? null,
      eggsSeen: view.eggsSeen ?? (legacy.spiceSeen ? [39] : []),
      egg: view.egg ?? null,
      rentClaim: view.rentClaim ?? null,
      auction: view.auction ?? null,
      duel: view.duel ?? null,
      choice: view.choice ?? null,
      gamble: view.gamble ?? null,
      event: view.event ?? null,
      emotes: view.emotes ?? [],
      shakeTaps: view.shakeTaps ?? 0,
      shakeMs: shakeUntil ? Math.max(0, shakeUntil - Date.now()) : null,
      now: Date.now(),
      result: view.result ? { ...view.result, highlights: view.result.highlights ?? [] } : null,
    }
  }

  /** 回放：用当时的对局状态拼出旁观视角 */
  static replayView(meta: ReplayMeta, game: GameState): StateView {
    return {
      me: { id: '', name: '回放', isHost: false, isSpectator: true },
      room: {
        code: meta.code,
        config: meta.config,
        hostId: meta.hostId,
        members: game.players.map((p) => ({ id: p.id, name: p.name, online: true, avatar: p.avatar, color: p.color })),
        spectators: [],
        idleRemainingMs: ROOM_IDLE_MS,
        idleWarnMs: ROOM_IDLE_WARN_MS,
        inGame: game.phase !== 'over',
      },
      game: Room.gameView(game),
    }
  }

  view(userId: string, online: (id: string) => boolean): StateView {
    const d = this.d
    const memberIdx = d.members.indexOf(userId)
    return {
      me: {
        id: userId,
        name: d.users[userId]?.name ?? '观众',
        isHost: userId === d.hostId,
        isSpectator: memberIdx < 0,
      },
      room: {
        code: d.code,
        config: d.config,
        hostId: d.hostId,
        members: d.members.map((id, i) => ({
          id,
          name: d.users[id]?.name ?? '?',
          online: online(id),
          avatar: d.avatars[id] ?? 0,
          color: PLAYER_COLORS[i % PLAYER_COLORS.length]!,
        })),
        spectators: d.spectators.map((id) => ({ id, name: d.users[id]?.name ?? '?', online: online(id) })),
        idleRemainingMs: Math.max(0, d.lastActiveAt + ROOM_IDLE_MS - Date.now()),
        idleWarnMs: ROOM_IDLE_WARN_MS,
        inGame: this.inGame,
      },
      game: d.game ? Room.gameView(d.game) : null,
    }
  }
}

interface RentMods {
  /** 机会卡「前进到最近的航线」：双倍租金 */
  airlineDouble?: boolean
  /** 机会卡「前进到最近的公用事业」：点数 × 10 */
  utilityTen?: boolean
}
