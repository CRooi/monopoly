import {
  AIRLINE_RENT,
  BAIL,
  BOARD,
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
export interface GameState extends GameView {
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
  }
}

const money = (n: number) => `$${n}`
const tileName = (i: number) => BOARD[i]!.name

// ---------------- 机会与命运卡 ----------------

interface Card {
  text: string
  act: (r: Room) => void
}

const JAIL_CARD_TEXT = '获得一张出狱卡，可以留着以后用'

const CHANCE: Card[] = [
  { text: '前进到起点，领取 $200', act: (r) => r.moveTo(0) },
  { text: '前进到中国，经过起点领取 $200', act: (r) => r.moveTo(39) },
  { text: '前进到意大利，经过起点领取 $200', act: (r) => r.moveTo(21) },
  { text: '前进到墨西哥，经过起点领取 $200', act: (r) => r.moveTo(11) },
  { text: '前往太平洋航线，经过起点领取 $200', act: (r) => r.moveTo(5) },
  { text: '前进到最近的航线，有主人时付双倍租金', act: (r) => r.moveToNearest('airline') },
  { text: '前进到最近的航线，有主人时付双倍租金', act: (r) => r.moveToNearest('airline') },
  { text: '前进到最近的公用事业，有主人时按骰子点数付 10 倍', act: (r) => r.moveToNearest('utility') },
  { text: '银行分红，领取 $50', act: (r) => r.receive(50) },
  { text: JAIL_CARD_TEXT, act: (r) => r.gainJailCard() },
  { text: '后退 3 格', act: (r) => r.moveBack(3) },
  { text: '直接入狱，不经过起点', act: (r) => r.sendToJail() },
  { text: '房屋大修：每栋房子付 $25，每家酒店付 $100', act: (r) => r.repairs(25, 100) },
  { text: '超速罚款 $15', act: (r) => r.charge(15, [], '超速罚款') },
  { text: '当选董事长，付给每位玩家 $50', act: (r) => r.payEachPlayer(50) },
  { text: '建筑贷款到期，领取 $150', act: (r) => r.receive(150) },
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
]

const DECKS = { chance: CHANCE, chest: CHEST }
const JAIL_CARD = { chance: CHANCE.findIndex((c) => c.text === JAIL_CARD_TEXT), chest: CHEST.findIndex((c) => c.text === JAIL_CARD_TEXT) }

// ---------------- 房间 ----------------

export class Room {
  /** 随机数来源，测试时可替换 */
  rng: () => number = Math.random

  constructor(public d: RoomData) {}

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
    }

    if (!mine) fail('还没轮到你')
    switch (msg.type) {
      case 'roll':
        this.roll()
        break
      case 'buy':
        this.buy()
        break
      case 'pass':
        if (g!.phase !== 'buy') fail('现在不能这样做')
        this.log(`${me!.name} 放弃购买 ${tileName(me!.pos)}`, me!.id)
        g!.phase = 'end'
        this.afterMove()
        break
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
    if (g.phase !== 'roll') fail(g.phase === 'buy' ? '请先决定是否购买' : g.phase === 'debt' ? '请先还清欠款' : '这回合已经掷过了')
    const p = this.cur()
    const dice: [number, number] = [this.die(), this.die()]
    const sum = dice[0] + dice[1]
    const isDouble = dice[0] === dice[1]
    g.lastRoll = { id: ++g.seq, dice, player: p.id }
    g.card = null
    g.phase = 'end'

    if (p.inJail) {
      if (isDouble) {
        this.release(p)
        this.log(`${p.name} 掷出 ${dice[0]}+${dice[1]} 双数，出狱`, p.id)
        g.again = false
        this.moveBy(sum)
        return this.afterMove()
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
      this.moveBy(sum)
      return this.afterMove()
    }

    if (isDouble) {
      g.doubles++
      if (g.doubles >= 3) {
        this.log(`${p.name} 连续三次掷出双数，超速入狱`, p.id)
        this.sendToJail()
        return
      }
    }
    g.again = isDouble
    this.log(`${p.name} 掷出 ${dice[0]}+${dice[1]}${isDouble ? '，双数' : ''}`, p.id)
    this.moveBy(sum)
    this.afterMove()
  }

  /** 一次移动的结算结束：没有待决定的事就进入下一步 */
  private afterMove() {
    const g = this.g
    if (g.phase === 'buy' || g.phase === 'debt' || g.phase === 'over') return
    g.phase = g.again ? 'roll' : 'end'
  }

  private nextTurn() {
    const g = this.g
    const from = g.turn
    let i = from
    for (let k = 0; k < g.players.length; k++) {
      i = (i + 1) % g.players.length
      if (!g.players[i]!.bankrupt) break
    }
    if (i <= from) {
      g.round++
      const max = this.d.config.maxRounds
      if (max > 0 && g.round > max) {
        this.log(`已经进行了 ${max} 轮，按总资产排名`)
        return this.gameOver('rounds')
      }
    }
    g.turn = i
    g.phase = 'roll'
    g.doubles = 0
    g.again = false
    g.debt = null
    g.afterDebt = null
    const p = this.cur()
    this.log(`轮到 ${p.name}${p.inJail ? '（在监狱中）' : ''}`, p.id)
  }

  // ---------------- 移动 ----------------

  private passGo(p: GamePlayer) {
    p.cash += GO_SALARY
    this.log(`${p.name} 经过起点，领取 ${money(GO_SALARY)}`, p.id)
  }

  private moveBy(steps: number) {
    const p = this.cur()
    const to = (p.pos + steps) % BOARD.length
    if (to < p.pos) this.passGo(p)
    p.pos = to
    this.land()
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
      if (BOARD[i]!.kind === kind) return this.moveTo(i, kind === 'airline' ? { airlineDouble: true } : { utilityTen: true })
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
  }

  private release(p: GamePlayer) {
    p.inJail = false
    p.jailTurns = 0
  }

  /** 停在格子上的结算 */
  private land(mods: RentMods = {}) {
    const g = this.g
    const p = this.cur()
    const t = BOARD[p.pos]!
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
        return this.drawCard(t.kind)
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
    const rent = this.rentOf(p.pos, mods)
    this.log(`${p.name} 来到 ${owner.name} 的 ${t.name}，付租金 ${money(rent)}`, p.id)
    this.charge(rent, [owner.id], `${t.name} 的租金`)
  }

  rentOf(pos: number, mods: RentMods = {}) {
    const g = this.g
    const t = BOARD[pos] as BuyableTile
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
    const t = BOARD[pos]!
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
    const drawn: DrawnCard = { id: ++g.seq, deck, text: card.text, player: p.id }
    g.card = drawn
    this.log(`${p.name} 抽到${deck === 'chance' ? '机会' : '命运'}：${card.text}`, p.id)
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
      this.moveBy(after.move)
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
      p.cash += (BOARD[i] as Extract<BuyableTile, { kind: 'country' }>).house / 2
    }
    for (const [i, o] of owned()) {
      if (p.cash >= amount) break
      if (o.mortgaged) continue
      o.mortgaged = true
      p.cash += mortgageValue(BOARD[i] as BuyableTile)
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
      const t = BOARD[i]!
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
    const t = BOARD[p.pos] as BuyableTile
    if (p.cash < t.price) fail('现金不够')
    p.cash -= t.price
    g.owners[p.pos] = { owner: p.id, houses: 0, mortgaged: false }
    this.log(`${p.name} 买下 ${t.name}，花费 ${money(t.price)}`, p.id)
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
    if (ph !== 'roll' && ph !== 'end') fail(ph === 'debt' ? '欠款期间只能卖房和抵押' : '请先决定是否购买')
  }

  private build(p: GamePlayer, tile: number) {
    this.needManage()
    const own = this.needOwn(p, tile)
    const t = BOARD[tile]!
    if (t.kind !== 'country') fail('只有国家可以盖房子')
    const c = t as Extract<BuyableTile, { kind: 'country' }>
    const group = groupTiles(c.group)
    if (!this.ownsGroup(p.id, tile)) fail('需要先集齐同色的全部国家')
    if (group.some((i) => this.g.owners[i]!.mortgaged)) fail('同色有国家在抵押中，不能盖房')
    if (own.houses >= 5) fail('已经有酒店了')
    const min = Math.min(...group.map((i) => this.g.owners[i]!.houses))
    if (own.houses > min) fail('同色国家要平均盖房，先盖房子少的')
    if (p.cash < c.house) fail('现金不够')
    p.cash -= c.house
    own.houses++
    this.log(`${p.name} 在 ${c.name} ${own.houses === 5 ? '升级为酒店' : `盖了第 ${own.houses} 栋房子`}，花费 ${money(c.house)}`, p.id)
  }

  private sell(p: GamePlayer, tile: number) {
    if (this.g.phase === 'buy') fail('请先决定是否购买')
    const own = this.needOwn(p, tile)
    const t = BOARD[tile]!
    if (t.kind !== 'country' || own.houses === 0) fail('这里没有房子')
    const c = t as Extract<BuyableTile, { kind: 'country' }>
    const max = Math.max(...groupTiles(c.group).map((i) => this.g.owners[i]!.houses))
    if (own.houses < max) fail('同色国家要平均拆房，先拆房子多的')
    own.houses--
    p.cash += c.house / 2
    this.log(`${p.name} 卖掉 ${c.name} 的${own.houses === 4 ? '酒店' : '一栋房子'}，收回 ${money(c.house / 2)}`, p.id)
  }

  private mortgage(p: GamePlayer, tile: number) {
    if (this.g.phase === 'buy') fail('请先决定是否购买')
    const own = this.needOwn(p, tile)
    if (own.mortgaged) fail('已经抵押了')
    const t = BOARD[tile] as BuyableTile
    if (t.kind === 'country' && groupTiles(t.group).some((i) => (this.g.owners[i]?.houses ?? 0) > 0)) fail('同色国家还有房子，要先卖掉')
    own.mortgaged = true
    p.cash += mortgageValue(t)
    this.log(`${p.name} 抵押 ${t.name}，得到 ${money(mortgageValue(t))}`, p.id)
  }

  private unmortgage(p: GamePlayer, tile: number) {
    this.needManage()
    const own = this.needOwn(p, tile)
    if (!own.mortgaged) fail('没有抵押')
    const t = BOARD[tile] as BuyableTile
    const cost = unmortgageCost(t)
    if (p.cash < cost) fail('现金不够')
    p.cash -= cost
    own.mortgaged = false
    this.log(`${p.name} 赎回 ${t.name}，花费 ${money(cost)}`, p.id)
  }

  // ---------------- 交易 ----------------

  private cleanSide(s: Partial<TradeSide> | undefined): TradeSide {
    const tiles = [...new Set((Array.isArray(s?.tiles) ? s!.tiles : []).map(Number))].filter((i) => Number.isInteger(i) && BOARD[i] && isBuyable(BOARD[i]!))
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
      if (g.owners[i]?.owner !== p.id) fail(`${tileName(i)} 不属于 ${p.name}`)
      const t = BOARD[i]!
      if (t.kind === 'country' && groupTiles(t.group).some((j) => (g.owners[j]?.houses ?? 0) > 0)) fail(`${tileName(i)} 同色还有房子，要先卖掉才能交易`)
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
    const parts = [...s.tiles.map(tileName)]
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
      const t = BOARD[Number(key)] as BuyableTile
      total += o.mortgaged ? t.price / 2 : t.price
      if (t.kind === 'country') total += o.houses * t.house
    }
    return total
  }

  private gameOver(reason: EndReason) {
    const g = this.g
    const standings = [...g.players]
      .sort((a, b) => {
        if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1
        if (a.bankrupt && b.bankrupt) return (b.bankruptOrder ?? 0) - (a.bankruptOrder ?? 0)
        return this.worth(b) - this.worth(a)
      })
      .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color, worth: this.worth(p), bankrupt: p.bankrupt }))
    g.phase = 'over'
    g.debt = null
    g.trades = []
    g.result = { reason, standings }
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
    const { decks: _d, afterDebt: _a, seq: _s, ...view } = g
    return view
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
