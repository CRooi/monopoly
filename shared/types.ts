// 前后端共享的类型与棋盘数据

// ---------- 棋盘 ----------

export type ColorGroup = 'brown' | 'sky' | 'pink' | 'orange' | 'red' | 'yellow' | 'green' | 'blue'

export const GROUP_COLOR: Record<ColorGroup, string> = {
  brown: '#8b5a2b',
  sky: '#7cc8f0',
  pink: '#d6409f',
  orange: '#f28c28',
  red: '#e03131',
  yellow: '#f2c418',
  green: '#2f9e44',
  blue: '#1c4fb8',
}

export type Tile =
  | { kind: 'go'; name: string }
  | { kind: 'jail'; name: string }
  | { kind: 'parking'; name: string }
  | { kind: 'gotojail'; name: string }
  | { kind: 'chance'; name: string }
  | { kind: 'chest'; name: string }
  | { kind: 'tax'; name: string; amount: number }
  /** 对决：停下的人挑一个对手比骰子点数 */
  | { kind: 'duel'; name: string }
  /** 地产：国家用 iso 国旗代码，城市用 badge 简称；rent 依次为空地、1~4 栋房子、酒店的租金 */
  | { kind: 'country'; name: string; iso?: string; badge?: string; group: ColorGroup; price: number; house: number; rent: [number, number, number, number, number, number] }
  | { kind: 'airline'; name: string; price: number }
  | { kind: 'utility'; name: string; price: number }

export type BuyableTile = Extract<Tile, { kind: 'country' | 'airline' | 'utility' }>

const country = (
  name: string,
  iso: string,
  group: ColorGroup,
  price: number,
  house: number,
  rent: [number, number, number, number, number, number],
): Tile => ({ kind: 'country', name, iso, group, price, house, rent })

/** 经典 40 格棋盘，从起点开始逆时针排列 */
export const BOARD: Tile[] = [
  { kind: 'go', name: '起点' },
  country('埃及', 'EG', 'brown', 60, 50, [2, 10, 30, 90, 160, 250]),
  { kind: 'chest', name: '命运' },
  country('印度', 'IN', 'brown', 60, 50, [4, 20, 60, 180, 320, 450]),
  { kind: 'tax', name: '所得税', amount: 200 },
  { kind: 'airline', name: '太平洋航线', price: 200 },
  country('越南', 'VN', 'sky', 100, 50, [6, 30, 90, 270, 400, 550]),
  { kind: 'chance', name: '机会' },
  country('泰国', 'TH', 'sky', 100, 50, [6, 30, 90, 270, 400, 550]),
  country('土耳其', 'TR', 'sky', 120, 50, [8, 40, 100, 300, 450, 600]),
  { kind: 'jail', name: '监狱' },
  country('墨西哥', 'MX', 'pink', 140, 100, [10, 50, 150, 450, 625, 750]),
  { kind: 'utility', name: '电力公司', price: 150 },
  country('巴西', 'BR', 'pink', 140, 100, [10, 50, 150, 450, 625, 750]),
  country('阿根廷', 'AR', 'pink', 160, 100, [12, 60, 180, 500, 700, 900]),
  { kind: 'airline', name: '大西洋航线', price: 200 },
  country('南非', 'ZA', 'orange', 180, 100, [14, 70, 200, 550, 750, 950]),
  { kind: 'chest', name: '命运' },
  country('俄罗斯', 'RU', 'orange', 180, 100, [14, 70, 200, 550, 750, 950]),
  country('西班牙', 'ES', 'orange', 200, 100, [16, 80, 220, 600, 800, 1000]),
  { kind: 'parking', name: '免费停车' },
  country('意大利', 'IT', 'red', 220, 150, [18, 90, 250, 700, 875, 1050]),
  { kind: 'duel', name: '对决' },
  country('韩国', 'KR', 'red', 220, 150, [18, 90, 250, 700, 875, 1050]),
  country('加拿大', 'CA', 'red', 240, 150, [20, 100, 300, 750, 925, 1100]),
  { kind: 'airline', name: '印度洋航线', price: 200 },
  country('澳大利亚', 'AU', 'yellow', 260, 150, [22, 110, 330, 800, 975, 1150]),
  country('法国', 'FR', 'yellow', 260, 150, [22, 110, 330, 800, 975, 1150]),
  { kind: 'utility', name: '自来水公司', price: 150 },
  country('德国', 'DE', 'yellow', 280, 150, [24, 120, 360, 850, 1025, 1200]),
  { kind: 'gotojail', name: '入狱' },
  country('英国', 'GB', 'green', 300, 200, [26, 130, 390, 900, 1100, 1275]),
  country('新加坡', 'SG', 'green', 300, 200, [26, 130, 390, 900, 1100, 1275]),
  { kind: 'chest', name: '命运' },
  country('日本', 'JP', 'green', 320, 200, [28, 150, 450, 1000, 1200, 1400]),
  { kind: 'airline', name: '北冰洋航线', price: 200 },
  { kind: 'chance', name: '机会' },
  country('美国', 'US', 'blue', 350, 200, [35, 175, 500, 1100, 1300, 1500]),
  { kind: 'tax', name: '奢侈税', amount: 100 },
  country('中国', 'CN', 'blue', 400, 200, [50, 200, 600, 1400, 1700, 2000]),
]

export const JAIL_POS = 10
export const GO_SALARY = 200
export const BAIL = 50
/** 第一次摇骰子摇多久 */
export const SHAKE_MS = 3000
/** 摇的过程中再点一次加多久，每过这么久才能再加一次 */
export const SHAKE_EXTEND_MS = 1000
/** 航线：拥有 1~4 条时的租金 */
export const AIRLINE_RENT = [25, 50, 100, 200]
/** 公用事业：拥有 1、2 家时按骰子点数的倍数收费 */
export const UTILITY_MULT = [4, 10]
/** 抵押借款的利息（赎回时多付） */
export const MORTGAGE_INTEREST = 0.1

// ---------- 主题 ----------

export type ThemeId = 'world' | 'china'

export interface Theme {
  id: ThemeId
  name: string
  /** 地产叫什么：国家 / 城市 */
  land: string
  /** 交通线路叫什么：航线 / 高铁 */
  transit: string
  /** 换掉的格子名字，price 为这个主题里单独调整的售价 */
  names: Record<number, { name: string; badge?: string; price?: number }>
  /** 火锅辣度：停在这块别人的地上要摇辣度，租金按辣度翻倍 */
  spicy?: number
  /** 藏着彩蛋的格子：第一次触发前只提示有彩蛋，不说是什么 */
  eggs?: Record<number, EggKind>
}

/** 城市彩蛋 */
export type EggKind = 'hotpot' | 'slide' | 'wheel' | 'dig' | 'dimsum' | 'milktea' | 'bless'

/** 彩蛋揭晓后的名字和规则，地产卡上展示 */
export const EGG_INFO: Record<EggKind, { title: string; rule: string }> = {
  hotpot: { title: '火锅辣度', rule: '停在别人的这块地上要摇辣度，租金 ×1 到 ×3' },
  slide: { title: '冰面打滑', rule: '停在这里脚下一滑，再往前滑 1 到 3 格' },
  wheel: { title: '摩天轮', rule: '停在这里坐一圈摩天轮，随机落到一块没人买的地' },
  dig: { title: '挖到文物', rule: '停在这里挖一铲：挖到宝贝领钱，挖坏了交文物保护费' },
  dimsum: { title: '早茶局', rule: '停在这里叹早茶：要么大家请你，要么你请大家，每人 $10' },
  milktea: { title: '奶茶排队', rule: '停在这里排队买奶茶，下回合停一次，奶茶钱银行出，再送 $30' },
  bless: { title: '天坛祈福', rule: '停在这里祈福，下次掷骰子必出双数' },
}

/**
 * 重庆火锅的辣度，从淡到辣，每档概率一样。
 * 倍数从 ×1 到 ×3，每档加 0.25，平均 ×2
 */
export const SPICE_LEVELS = [
  { level: '大海里的一滴辣椒油', mult: 1, weight: 1 },
  { level: '微微辣，辣椒只是路过', mult: 1.25, weight: 1 },
  { level: '外地人的微辣', mult: 1.5, weight: 1 },
  { level: '正常人的中辣', mult: 1.75, weight: 1 },
  { level: '重庆人口中的微辣', mult: 2, weight: 1 },
  { level: '特辣，嘴巴开始冒烟', mult: 2.25, weight: 1 },
  { level: '变态辣，耳朵在喷火', mult: 2.5, weight: 1 },
  { level: '地狱辣，灵魂已经出窍', mult: 2.75, weight: 1 },
  { level: '超级无敌特特特特特特特特特变态辣', mult: 3, weight: 1 },
]

export const THEMES: Record<ThemeId, Theme> = {
  world: { id: 'world', name: '世界各国', land: '国家', transit: '航线', names: {} },
  china: {
    id: 'china',
    name: '中国城市',
    land: '城市',
    transit: '高铁',
    spicy: 39,
    eggs: { 39: 'hotpot', 14: 'slide', 26: 'wheel', 21: 'dig', 31: 'dimsum', 19: 'milktea', 34: 'bless' },
    names: {
      1: { name: '拉萨', badge: '藏' },
      3: { name: '西宁', badge: '青' },
      5: { name: '京沪高铁' },
      6: { name: '乌鲁木齐', badge: '新' },
      8: { name: '兰州', badge: '甘' },
      9: { name: '贵阳', badge: '黔' },
      11: { name: '南宁', badge: '桂' },
      12: { name: '国家电网' },
      13: { name: '昆明', badge: '滇' },
      14: { name: '哈尔滨', badge: '黑' },
      15: { name: '京广高铁' },
      16: { name: '沈阳', badge: '辽' },
      18: { name: '郑州', badge: '豫' },
      19: { name: '长沙', badge: '湘' },
      21: { name: '西安', badge: '陕' },
      23: { name: '武汉', badge: '鄂' },
      24: { name: '南京', badge: '苏' },
      25: { name: '沪昆高铁' },
      26: { name: '天津', badge: '津' },
      27: { name: '苏州', badge: '苏' },
      28: { name: '自来水厂' },
      29: { name: '杭州', badge: '浙' },
      31: { name: '广州', badge: '粤' },
      32: { name: '深圳', badge: '粤' },
      34: { name: '北京', badge: '京' },
      35: { name: '成渝高铁' },
      37: { name: '上海', badge: '沪' },
      // 重庆有火锅辣度，租金平均约 1.67 倍，售价也比原来的 $400 贵
      39: { name: '重庆', badge: '渝', price: 500 },
    },
  },
}

export const THEME_OPTIONS: ThemeId[] = ['china', 'world']

export const themeOf = (id: ThemeId | undefined) => THEMES[id ?? 'world'] ?? THEMES.world

const boards = new Map<ThemeId, Tile[]>()

/** 某个主题的棋盘：格子的种类、价格都一样，只换名字和图标 */
export function boardFor(id: ThemeId | undefined): Tile[] {
  const theme = themeOf(id)
  let b = boards.get(theme.id)
  if (!b) {
    b = BOARD.map((t, i) => {
      const n = theme.names[i]
      if (!n) return t
      return t.kind === 'country'
        ? { ...t, name: n.name, badge: n.badge, iso: undefined, price: n.price ?? t.price }
        : { ...t, name: n.name }
    })
    boards.set(theme.id, b)
  }
  return b
}

export const isBuyable = (t: Tile): t is BuyableTile => t.kind === 'country' || t.kind === 'airline' || t.kind === 'utility'

export const groupTiles = (group: ColorGroup) =>
  BOARD.flatMap((t, i) => (t.kind === 'country' && t.group === group ? [i] : []))

export const mortgageValue = (t: BuyableTile) => t.price / 2
export const unmortgageCost = (t: BuyableTile) => Math.round((t.price / 2) * (1 + MORTGAGE_INTEREST))

// ---------- 头像与颜色 ----------

/** 玩家头像，棋盘上的棋子也用它 */
export const AVATARS = [
  { e: '🐶', bg: '#ffd166' },
  { e: '🐱', bg: '#ff9f80' },
  { e: '🦊', bg: '#ffb35c' },
  { e: '🐼', bg: '#b8e0ff' },
  { e: '🐨', bg: '#c9d6ff' },
  { e: '🐯', bg: '#ffcf70' },
  { e: '🦁', bg: '#ffe08a' },
  { e: '🐸', bg: '#a8eb9e' },
  { e: '🐵', bg: '#f5c79a' },
  { e: '🐰', bg: '#ffc2dd' },
  { e: '🐻', bg: '#e3b98f' },
  { e: '🐷', bg: '#ffb8c6' },
  { e: '🐮', bg: '#dfe7f2' },
  { e: '🐧', bg: '#9fd3ff' },
  { e: '🦄', bg: '#e2c6ff' },
  { e: '🐙', bg: '#ffa8c9' },
  { e: '👽', bg: '#b5f2c4' },
  { e: '🤖', bg: '#c6d2e3' },
  { e: '👻', bg: '#e4e9ff' },
  { e: '🎃', bg: '#ffbb73' },
]

export const cleanAvatar = (v: unknown) => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n >= 0 && n < AVATARS.length ? n : 0
}

/** 每位玩家的代表色，用于棋子描边和地产归属 */
export const PLAYER_COLORS = ['#e03131', '#1c7ed6', '#2f9e44', '#f59f00', '#ae3ec9', '#0c8599', '#e8590c', '#5c5f66']

// ---------- 房间配置 ----------

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8
export const MAX_SPECTATORS = 10

export interface RoomConfig {
  /** 每人初始资金 */
  startCash: number
  /** 最多进行多少轮，到了按总资产排名；0 为不限，直到只剩一人 */
  maxRounds: number
  /** 落在免费停车时领走奖池（税款与罚款都进奖池） */
  parkingPot: boolean
  allowSpectators: boolean
  theme: ThemeId
  /** 停到别人的地上要房东自己喊收租，过时不候 */
  rentClaim: boolean
  /** 放弃购买的地全员拍卖 */
  auction: boolean
  /** 从第 2 轮起每轮开局翻一张全城事件 */
  cityEvents: boolean
}

export const DEFAULT_CONFIG: RoomConfig = {
  theme: 'china',
  startCash: 1500,
  maxRounds: 0,
  parkingPot: false,
  allowSpectators: true,
  rentClaim: true,
  auction: true,
  cityEvents: true,
}

export const START_CASH_OPTIONS = [1000, 1500, 2000, 3000]
export const ROUND_OPTIONS = [0, 10, 20, 30, 50]

// ---------- 游戏状态 ----------

export type Phase =
  /** 等待当前玩家掷骰子（包括骰子正在摇） */
  | 'roll'
  /** 掷出了点数，玩家自己一步一步走 */
  | 'move'
  /** 停在无主的地上，决定买不买 */
  | 'buy'
  /** 停在机会或命运上，等玩家自己抽卡 */
  | 'draw'
  /** 欠款付不起，需要卖房、抵押凑钱或宣告破产 */
  | 'debt'
  /** 停在别人的地上，等房东自己喊收租，过时不候 */
  | 'claim'
  /** 放弃购买的地在全员拍卖 */
  | 'auction'
  /** 对决格：挑对手、两人各摇一次 */
  | 'duel'
  /** 抽到二选一的卡，等玩家选 */
  | 'choose'
  /** 本回合的移动结束，可以继续经营，然后结束回合 */
  | 'end'
  | 'over'

export interface GamePlayer {
  id: string
  name: string
  avatar: number
  color: string
  cash: number
  pos: number
  inJail: boolean
  /** 在监狱里已经掷了几次 */
  jailTurns: number
  /** 出狱卡张数 */
  jailCards: number
  bankrupt: boolean
  /** 破产时的轮次，用于排名 */
  bankruptOrder: number | null
  /** 还要跳过几回合（长沙奶茶排队） */
  skipTurns: number
  /** 下次掷骰子必出双数（北京天坛祈福） */
  blessed: boolean
  /** 这一局拿到的徽章 */
  badges: string[]
}

export interface Ownership {
  owner: string
  /** 0~4 栋房子，5 为酒店 */
  houses: number
  mortgaged: boolean
}

export interface Debt {
  amount: number
  /** 债主，多人时平分，空数组为银行 */
  to: string[]
  reason: string
}

export interface TradeSide {
  cash: number
  tiles: number[]
  jailCards: number
}

export interface Trade {
  id: string
  from: string
  to: string
  /** 发起人给出的 */
  give: TradeSide
  /** 发起人想要的 */
  get: TradeSide
}

export interface LogEntry {
  id: number
  ts: number
  text: string
  /** 相关玩家，用于着色 */
  who?: string
}

export interface DrawnCard {
  id: number
  deck: 'chance' | 'chest'
  text: string
  player: string
}

export interface Roll {
  id: number
  dice: [number, number]
  player: string
}

export type EndReason = 'lastStanding' | 'rounds' | 'aborted'

export interface Standing {
  badges?: string[]
  id: string
  name: string
  avatar: number
  color: string
  worth: number
  bankrupt: boolean
}

/** 发给客户端的对局视图（大富翁没有隐藏信息，只去掉牌堆顺序） */
export interface GameView {
  id: string
  startedAt: number
  players: GamePlayer[]
  turn: number
  round: number
  phase: Phase
  owners: Record<number, Ownership>
  debt: Debt | null
  /** 掷出双数后还能再掷 */
  again: boolean
  doubles: number
  lastRoll: Roll | null
  /** 骰子正在摇，还要摇多少毫秒；没在摇为 null */
  shakeMs: number | null
  /** 摇骰子时一共点了多少下，每点一下大家都能看到飘字 */
  shakeTaps: number
  /** 开局时选的主题 */
  theme: ThemeId
  /** 刚摇出的火锅辣度 */
  spice: { id: number; level: string; mult: number; player: string } | null
  /** 这一局已经揭晓过的彩蛋格子；没揭晓的格子上只提示有彩蛋，不说是什么 */
  eggsSeen: number[]
  /** 刚触发的城市彩蛋，大家都看得到 */
  egg: { id: number; tile: number; kind: EggKind; text: string; player: string } | null
  /** 掷出点数后还要自己走的步数 */
  stepsLeft: number
  card: DrawnCard | null
  /** 等房东收租：until 之前房东不点「收租」就免租 */
  rentClaim: { id: number; tile: number; from: string; to: string; amount: number; until: number } | null
  /** 拍卖：出价后剩余时间至少重置到 AUCTION_BID_MS */
  auction: { id: number; tile: number; high: { player: string; amount: number } | null; until: number } | null
  /** 对决：a 是停在对决格的人，b 是挑中的对手 */
  duel: {
    id: number
    a: string
    b: string | null
    stake: number
    rolls: Record<string, [number, number]>
    until: number
    winner: string | null
    done: boolean
  } | null
  /** 二选一的卡 */
  choice: { id: number; deck: 'chance' | 'chest'; key: string; text: string; options: string[] } | null
  /** 选择题卡里「赌一把」的结果 */
  gamble: { id: number; dice: [number, number]; win: boolean; text: string } | null
  /** 本轮的全城事件 */
  event: {
    id: number
    key: string
    title: string
    text: string
    round: number
    /** 揭晓前一句一句播放的小故事 */
    story?: string[]
  } | null
  /** 最近的表情 */
  emotes: Emote[]
  /** 生成视图时服务端的时间，前端据此把各种 until 换算成本地倒计时 */
  now: number
  trades: Trade[]
  pot: number
  log: LogEntry[]
  result: { reason: EndReason; standings: Standing[]; highlights: Highlight[] } | null
}

export interface Emote {
  id: number
  from: string
  /** 对谁发的，null 为对所有人 */
  to: string | null
  text: string
}

export interface Highlight {
  title: string
  text: string
  /** 相关的玩家，用于显示头像 */
  player?: string
}

/** 表情：文字短句 */
export const EMOTES = ['谢谢老板', '我裂开了', '就这？', '稳住', '下次一定', '哈哈哈哈', '求放过', '发财了', '你等着', '抱拳了']

/** 房东喊收租的时限 */
export const RENT_CLAIM_MS = 6000
/** 拍卖开始的倒计时，以及每次出价后至少剩多少时间 */
export const AUCTION_MS = 10000
export const AUCTION_BID_MS = 5000
/** 对决：挑对手、摇骰子各自的时限 */
export const DUEL_PICK_MS = 20000
export const DUEL_ROLL_MS = 15000
export const DUEL_STAKE = 100

// ---------- 房间视图 ----------

export interface MemberView {
  id: string
  name: string
  online: boolean
  avatar: number
  color: string
}

export interface RoomView {
  code: string
  config: RoomConfig
  hostId: string
  members: MemberView[]
  spectators: { id: string; name: string; online: boolean }[]
  idleRemainingMs: number
  idleWarnMs: number
  inGame: boolean
}

export interface StateView {
  me: { id: string; name: string; isHost: boolean; isSpectator: boolean }
  room: RoomView
  game: GameView | null
}

// ---------- 消息 ----------

export type ClientMessage =
  | { type: 'ping' }
  | { type: 'extend' }
  | { type: 'setAvatar'; avatar: number }
  | { type: 'kick'; userId: string }
  | { type: 'leave' }
  | { type: 'disband' }
  | { type: 'updateConfig'; config: RoomConfig }
  | { type: 'start' }
  | { type: 'abort' }
  /** 直接掷出点数（不摇），测试和机器人用 */
  | { type: 'roll' }
  /** 摇骰子：第一次摇 3 秒，摇的过程中再点每秒最多加 1 秒 */
  | { type: 'shake' }
  /** 掷出点数后自己走一步 */
  | { type: 'step' }
  | { type: 'buy' }
  | { type: 'pass' }
  | { type: 'drawCard' }
  | { type: 'claimRent' }
  | { type: 'bid'; amount: number }
  | { type: 'duelPick'; target: string | null }
  | { type: 'duelRoll' }
  | { type: 'chooseOption'; index: number }
  | { type: 'emote'; text: number; to?: string | null }
  | { type: 'endTurn' }
  | { type: 'payBail' }
  | { type: 'useJailCard' }
  | { type: 'build'; tile: number }
  | { type: 'sell'; tile: number }
  | { type: 'mortgage'; tile: number }
  | { type: 'unmortgage'; tile: number }
  | { type: 'payDebt' }
  | { type: 'bankrupt' }
  | { type: 'tradePropose'; to: string; give: TradeSide; get: TradeSide }
  | { type: 'tradeRespond'; id: string; accept: boolean }
  | { type: 'tradeCancel'; id: string }

export type ServerMessage =
  | { type: 'state'; state: StateView }
  | { type: 'error'; message: string }
  | { type: 'kicked'; reason: string }
  | { type: 'pong' }
  /** 连上后先发送：后端本次启动的 id，前端发现变了说明后端更新过，需要刷新页面 */
  | { type: 'hello'; bootId: string }
  /** 后端即将重启（更新部署） */
  | { type: 'upgrading' }

// ---------- 对局回放 ----------

export interface ReplayGameInfo {
  id: string
  code: string
  /** 该房间的第几局 */
  round: number
  status: 'playing' | 'finished' | 'aborted'
  winner: string | null
  startedAt: number
  endedAt: number | null
}

export interface ReplayEvent {
  seq: number
  ts: number
  actor: string
  text: string
}

/** 下载到本地的回放文件（.mfreplay，gzip 压缩的 JSON） */
export interface ReplayFile {
  format: 'monopoly-replay'
  version: 1
  exportedAt: number
  game: ReplayGameInfo
  /** 每个事件附带当时的局面，离线即可回放 */
  events: (ReplayEvent & { view: StateView })[]
}
