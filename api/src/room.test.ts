import { afterEach, describe, expect, setSystemTime, test } from 'bun:test'
import { BAIL, BOARD, GO_SALARY, JAIL_POS, SPICE_LEVELS, type ClientMessage } from '../../shared/types'
import { GameError, Room } from './room'

/** 建房并开局：玩家顺序固定为 A、B、C… */
/** 默认用世界地图，规则测试不受城市彩蛋影响；测中国城市时传 theme */
function setup(n = 2, config = {}) {
  // 收租、拍卖、全城事件默认关掉，规则测试不受影响；专门测它们时再打开
  const { room, user: a } = Room.create('1234', { theme: 'world', rentClaim: false, auction: false, cityEvents: false, ...config }, 'A')
  const users = [a]
  for (let i = 1; i < n; i++) users.push(room.join(String.fromCharCode(65 + i)))
  // 不打乱顺序
  room.rng = () => 0.999
  room.handle(a.id, { type: 'start' })
  const g = room.d.game!
  g.players.sort((x, y) => users.findIndex((u) => u.id === x.id) - users.findIndex((u) => u.id === y.id))
  const ids = users.map((u) => u.id)
  const act = (i: number, msg: ClientMessage) => room.handle(ids[i]!, msg)
  /** 掷骰子并把点数一步一步走完 */
  const roll = (i: number) => {
    act(i, { type: 'roll' })
    while (g.phase === 'move') act(i, { type: 'step' })
  }
  return { room, g, ids, act, roll }
}

/** 让接下来掷出指定的点数 */
function dice(room: Room, ...values: number[]) {
  const q = [...values]
  room.rng = () => {
    const v = q.shift()
    if (v === undefined) throw new Error('骰子点数用完了')
    return (v - 1) / 6 + 0.01
  }
}

describe('房间', () => {
  test('建房、加入与开局', () => {
    const { room, user } = Room.create('1000', {}, '房主')
    expect(() => room.handle(user.id, { type: 'start' })).toThrow(GameError)
    room.join('二号')
    room.handle(user.id, { type: 'start' })
    expect(room.inGame).toBe(true)
    expect(room.d.game!.players.every((p) => p.cash === 1500)).toBe(true)
    expect(() => room.join('迟到')).toThrow('游戏进行中')
  })

  test('只有房主能开局和改配置', () => {
    const { room } = Room.create('1000', {}, '房主')
    const b = room.join('B')
    expect(() => room.handle(b.id, { type: 'start' })).toThrow('只有房主')
    expect(() => room.handle(b.id, { type: 'updateConfig', config: { startCash: 2000, maxRounds: 0, parkingPot: false, allowSpectators: true, theme: 'world', rentClaim: true, auction: true, cityEvents: true } })).toThrow('只有房主')
  })

  test('房主离开后转给下一位', () => {
    const { room, user } = Room.create('1000', {}, '房主')
    const b = room.join('B')
    room.handle(user.id, { type: 'leave' })
    expect(room.d.hostId).toBe(b.id)
  })

  test('新房间默认是中国城市地图', () => {
    const { room } = Room.create('1000', {}, '房主')
    expect(room.d.config.theme).toBe('china')
  })

  test('配置非法值回落为默认', () => {
    const { room } = Room.create('1000', { startCash: 99999, maxRounds: 7 }, '房主')
    expect(room.d.config.startCash).toBe(1500)
    expect(room.d.config.maxRounds).toBe(0)
  })
})

describe('移动与购买', () => {
  test('掷骰子前进并购买', () => {
    const { room, g, act, roll } = setup()
    dice(room, 1, 2)
    roll(0)
    expect(g.players[0]!.pos).toBe(3)
    expect(g.phase).toBe('buy')
    act(0, { type: 'buy' })
    expect(g.owners[3]!.owner).toBe(g.players[0]!.id)
    expect(g.players[0]!.cash).toBe(1440)
    expect(g.phase).toBe('end')
    expect(() => act(1, { type: 'roll' })).toThrow('还没轮到你')
    act(0, { type: 'endTurn' })
    expect(g.turn).toBe(1)
  })

  test('双数可以再掷，三次双数入狱', () => {
    const { room, g, act, roll } = setup()
    g.players[0]!.pos = 1
    dice(room, 1, 1)
    roll(0)
    act(0, { type: 'pass' })
    expect(g.phase).toBe('roll')
    dice(room, 2, 2)
    roll(0)
    // 停在机会上，抽到「前进到起点」
    expect(g.phase).toBe('draw')
    act(0, { type: 'drawCard' })
    dice(room, 3, 3)
    roll(0)
    expect(g.players[0]!.inJail).toBe(true)
    expect(g.players[0]!.pos).toBe(JAIL_POS)
    expect(g.phase).toBe('end')
  })

  test('经过起点领工资', () => {
    const { room, g, roll } = setup()
    g.players[0]!.pos = 37
    dice(room, 1, 3)
    roll(0)
    expect(g.players[0]!.pos).toBe(1)
    expect(g.players[0]!.cash).toBe(1500 + GO_SALARY)
  })
})

describe('租金', () => {
  test('空地、集齐同色和房子的租金', () => {
    const { room, g, roll, ids } = setup()
    g.owners[1] = { owner: ids[1]!, houses: 0, mortgaged: false }
    expect(room.rentOf(1)).toBe(2)
    g.owners[3] = { owner: ids[1]!, houses: 0, mortgaged: false }
    expect(room.rentOf(1)).toBe(4)
    g.owners[1]!.houses = 2
    expect(room.rentOf(1)).toBe(30)
    dice(room, 1, 2)
    roll(0)
    // 印度空地，同色集齐，租金翻倍
    expect(g.players[0]!.cash).toBe(1500 - 8)
    expect(g.players[1]!.cash).toBe(1500 + 8)
  })

  test('抵押的地不收租金', () => {
    const { room, g, roll, ids } = setup()
    g.owners[3] = { owner: ids[1]!, houses: 0, mortgaged: true }
    dice(room, 1, 2)
    roll(0)
    expect(g.players[0]!.cash).toBe(1500)
  })

  test('航线按拥有数量收费', () => {
    const { room, g, ids } = setup()
    g.owners[5] = { owner: ids[1]!, houses: 0, mortgaged: false }
    expect(room.rentOf(5)).toBe(25)
    g.owners[15] = { owner: ids[1]!, houses: 0, mortgaged: false }
    g.owners[25] = { owner: ids[1]!, houses: 0, mortgaged: false }
    expect(room.rentOf(5)).toBe(100)
  })
})

describe('盖房与抵押', () => {
  test('集齐同色后平均盖房', () => {
    const { g, act, ids } = setup()
    expect(() => act(0, { type: 'build', tile: 1 })).toThrow('这不是你的地')
    g.owners[1] = { owner: ids[0]!, houses: 0, mortgaged: false }
    expect(() => act(0, { type: 'build', tile: 1 })).toThrow('集齐')
    g.owners[3] = { owner: ids[0]!, houses: 0, mortgaged: false }
    act(0, { type: 'build', tile: 1 })
    expect(() => act(0, { type: 'build', tile: 1 })).toThrow('平均')
    act(0, { type: 'build', tile: 3 })
    expect(g.players[0]!.cash).toBe(1400)
    expect(() => act(0, { type: 'mortgage', tile: 1 })).toThrow('房子')
    act(0, { type: 'sell', tile: 1 })
    expect(g.players[0]!.cash).toBe(1425)
  })

  test('抵押与赎回', () => {
    const { g, act, ids } = setup()
    g.owners[39] = { owner: ids[0]!, houses: 0, mortgaged: false }
    act(0, { type: 'mortgage', tile: 39 })
    expect(g.players[0]!.cash).toBe(1700)
    act(0, { type: 'unmortgage', tile: 39 })
    expect(g.players[0]!.cash).toBe(1480)
    expect(g.owners[39]!.mortgaged).toBe(false)
  })
})

describe('欠款与破产', () => {
  test('现金不够时进入欠款，凑够后还清', () => {
    const { room, g, act, roll, ids } = setup()
    g.owners[3] = { owner: ids[1]!, houses: 5, mortgaged: false }
    g.owners[39] = { owner: ids[0]!, houses: 0, mortgaged: false }
    g.players[0]!.cash = 300
    dice(room, 1, 2)
    roll(0)
    expect(g.phase).toBe('debt')
    expect(g.debt!.amount).toBe(450)
    expect(() => act(0, { type: 'endTurn' })).toThrow()
    expect(() => act(0, { type: 'payDebt' })).toThrow('还差')
    act(0, { type: 'mortgage', tile: 39 })
    act(0, { type: 'payDebt' })
    expect(g.players[0]!.cash).toBe(50)
    expect(g.players[1]!.cash).toBe(1500 + 450)
    expect(g.phase).toBe('end')
  })

  test('欠债破产时资产归债主，只剩一人游戏结束', () => {
    const { room, g, act, roll, ids } = setup()
    g.owners[3] = { owner: ids[1]!, houses: 5, mortgaged: false }
    g.owners[6] = { owner: ids[0]!, houses: 0, mortgaged: false }
    g.players[0]!.cash = 10
    dice(room, 1, 2)
    roll(0)
    act(0, { type: 'bankrupt' })
    expect(g.players[0]!.bankrupt).toBe(true)
    expect(g.owners[6]!.owner).toBe(ids[1]!)
    expect(g.phase).toBe('over')
    expect(g.result!.standings[0]!.id).toBe(ids[1]!)
    expect(room.inGame).toBe(false)
  })

  test('三人局认输后地产收归银行，轮到下一位', () => {
    const { g, act, ids } = setup(3)
    g.owners[6] = { owner: ids[0]!, houses: 0, mortgaged: false }
    act(0, { type: 'bankrupt' })
    expect(g.owners[6]).toBeUndefined()
    expect(g.turn).toBe(1)
    expect(g.phase).toBe('roll')
  })

  test('对局中离开房间按破产处理', () => {
    const { room, g, act } = setup(3)
    act(1, { type: 'leave' })
    expect(g.players[1]!.bankrupt).toBe(true)
    expect(room.d.members.length).toBe(2)
  })
})

describe('监狱', () => {
  test('保释出狱后正常掷骰子', () => {
    const { room, g, act, roll } = setup()
    const p = g.players[0]!
    p.inJail = true
    p.pos = JAIL_POS
    act(0, { type: 'payBail' })
    expect(p.cash).toBe(1500 - BAIL)
    expect(p.inJail).toBe(false)
    dice(room, 1, 2)
    roll(0)
    expect(p.pos).toBe(13)
  })

  test('三次没掷出双数，交保释金后前进', () => {
    const { room, g, roll } = setup()
    const p = g.players[0]!
    p.inJail = true
    p.pos = JAIL_POS
    p.jailTurns = 2
    dice(room, 1, 2)
    roll(0)
    expect(p.inJail).toBe(false)
    expect(p.pos).toBe(13)
    expect(p.cash).toBeLessThanOrEqual(1500 - BAIL)
  })

  test('在狱中掷出双数出狱，但不能再掷', () => {
    const { room, g, act, roll } = setup()
    const p = g.players[0]!
    p.inJail = true
    p.pos = JAIL_POS
    dice(room, 3, 3)
    roll(0)
    expect(p.inJail).toBe(false)
    expect(p.pos).toBe(16)
    act(0, { type: 'pass' })
    expect(g.phase).toBe('end')
  })
})

describe('摇骰子与走棋', () => {
  afterEach(() => setSystemTime())

  test('摇 3 秒；摇的过程中再点，每秒最多加 1 秒', () => {
    const { room, g, act } = setup()
    const t0 = new Date('2026-01-01T00:00:00Z').getTime()
    setSystemTime(t0)
    act(0, { type: 'shake' })
    expect(g.shakeUntil).toBe(t0 + 3000)
    // 1 秒内连点不加时
    setSystemTime(t0 + 400)
    act(0, { type: 'shake' })
    act(0, { type: 'shake' })
    expect(g.shakeUntil).toBe(t0 + 3000)
    // 过了 1 秒再点，加 1 秒
    setSystemTime(t0 + 1000)
    act(0, { type: 'shake' })
    expect(g.shakeUntil).toBe(t0 + 4000)
    setSystemTime(t0 + 1500)
    act(0, { type: 'shake' })
    expect(g.shakeUntil).toBe(t0 + 4000)
    expect(Room.gameView(g).shakeMs).toBe(2500)
    // 摇的时候别人不能摇，也不能直接掷
    expect(() => act(1, { type: 'shake' })).toThrow('还没轮到你')
    expect(() => act(0, { type: 'roll' })).toThrow('骰子正在摇')
    room.dispose()
  })

  test('骰子停下才出点数，然后自己一步一步走', () => {
    const { room, g, act } = setup()
    act(0, { type: 'shake' })
    expect(g.lastRoll).toBeNull()
    dice(room, 1, 2)
    room.stopShake()
    room.dispose()
    expect(g.lastRoll!.dice).toEqual([1, 2])
    expect(g.phase).toBe('move')
    expect(g.stepsLeft).toBe(3)
    expect(g.players[0]!.pos).toBe(0)
    expect(() => act(0, { type: 'endTurn' })).toThrow()
    expect(() => act(1, { type: 'step' })).toThrow('还没轮到你')
    act(0, { type: 'step' })
    act(0, { type: 'step' })
    expect(g.players[0]!.pos).toBe(2)
    expect(g.phase).toBe('move')
    act(0, { type: 'step' })
    // 走到印度才结算
    expect(g.players[0]!.pos).toBe(3)
    expect(g.phase).toBe('buy')
    expect(() => act(0, { type: 'step' })).toThrow('现在不能走')
  })

  test('一步步走过起点时领工资', () => {
    const { room, g, act } = setup()
    g.players[0]!.pos = 39
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    act(0, { type: 'step' })
    expect(g.players[0]!.pos).toBe(0)
    expect(g.players[0]!.cash).toBe(1700)
    act(0, { type: 'step' })
    act(0, { type: 'step' })
    expect(g.players[0]!.cash).toBe(1700)
  })
})

describe('抽卡', () => {
  test('停在命运上要自己抽卡，抽完才生效', () => {
    const { room, g, act, roll } = setup()
    dice(room, 1, 1)
    roll(0)
    expect(g.players[0]!.pos).toBe(2)
    expect(g.phase).toBe('draw')
    expect(g.card).toBeNull()
    expect(() => act(0, { type: 'roll' })).toThrow('请先抽卡')
    expect(() => act(0, { type: 'endTurn' })).toThrow()
    // 牌堆没打乱，第一张是「前进到起点」
    act(0, { type: 'drawCard' })
    expect(g.card!.deck).toBe('chest')
    expect(g.players[0]!.pos).toBe(0)
    expect(g.players[0]!.cash).toBe(1700)
    // 掷的是双数，抽完卡还能再掷
    expect(g.phase).toBe('roll')
  })

  test('不在机会命运上不能抽卡', () => {
    const { act } = setup()
    expect(() => act(0, { type: 'drawCard' })).toThrow('现在不能抽卡')
  })
})

describe('交易', () => {
  test('提出并接受交易', () => {
    const { g, act, ids } = setup()
    g.owners[1] = { owner: ids[0]!, houses: 0, mortgaged: false }
    act(0, { type: 'tradePropose', to: ids[1]!, give: { cash: 0, tiles: [1], jailCards: 0 }, get: { cash: 100, tiles: [], jailCards: 0 } })
    expect(g.trades.length).toBe(1)
    act(1, { type: 'tradeRespond', id: g.trades[0]!.id, accept: true })
    expect(g.owners[1]!.owner).toBe(ids[1]!)
    expect(g.players[0]!.cash).toBe(1600)
    expect(g.players[1]!.cash).toBe(1400)
  })

  test('拿不出的东西不能交易', () => {
    const { act, ids } = setup()
    expect(() => act(0, { type: 'tradePropose', to: ids[1]!, give: { cash: 0, tiles: [1], jailCards: 0 }, get: { cash: 0, tiles: [], jailCards: 0 } })).toThrow('不属于')
    expect(() => act(0, { type: 'tradePropose', to: ids[1]!, give: { cash: 0, tiles: [], jailCards: 0 }, get: { cash: 9999, tiles: [], jailCards: 0 } })).toThrow('现金不够')
  })
})

describe('结束条件', () => {
  test('到达轮数上限按总资产排名', () => {
    const { room, g, act, roll, ids } = setup(2, { maxRounds: 10 })
    g.round = 10
    g.owners[39] = { owner: ids[1]!, houses: 0, mortgaged: false }
    dice(room, 1, 2, 1, 2)
    roll(0)
    act(0, { type: 'pass' })
    act(0, { type: 'endTurn' })
    roll(1)
    act(1, { type: 'pass' })
    act(1, { type: 'endTurn' })
    expect(g.phase).toBe('over')
    expect(g.result!.reason).toBe('rounds')
    expect(g.result!.standings[0]!.id).toBe(ids[1]!)
  })

  test('房主可以结束对局', () => {
    const { g, act } = setup()
    expect(() => act(1, { type: 'abort' })).toThrow('只有房主')
    act(0, { type: 'abort' })
    expect(g.result!.reason).toBe('aborted')
  })
})

describe('中国城市主题', () => {
  test('地名换成城市，重庆最贵', () => {
    const { room, g } = setup(2, { theme: 'china' })
    expect(g.theme).toBe('china')
    expect(room.tileName(39)).toBe('重庆')
    const prices = room.board.filter((t) => t.kind === 'country').map((t) => (t as { price: number }).price)
    expect(room.board[39]!.kind === 'country' && room.board[39]!.price).toBe(Math.max(...prices))
  })

  test('火锅彩蛋开局时没有揭晓，停在无主的重庆上也不揭晓', () => {
    const { room, g, act } = setup(2, { theme: 'china' })
    expect(g.eggsSeen).not.toContain(39)
    g.players[0]!.pos = 36
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    while (g.phase === 'move') act(0, { type: 'step' })
    expect(g.phase).toBe('buy')
    act(0, { type: 'buy' })
    expect(g.eggsSeen).not.toContain(39)
    expect(g.spice).toBeNull()
  })

  test('重庆售价 $500，其他格子价格和世界地图一样', () => {
    const { room, g, act } = setup(2, { theme: 'china' })
    const china = room.board
    expect(china[39]!.kind === 'country' && china[39]!.price).toBe(500)
    expect(china[37]!.kind === 'country' && china[37]!.price).toBe(350)
    g.players[0]!.pos = 36
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    while (g.phase === 'move') act(0, { type: 'step' })
    act(0, { type: 'buy' })
    expect(g.players[0]!.cash).toBe(1000)
    expect(room.worth(g.players[0]!)).toBe(1500)
  })

  test('卡片里的地名跟着主题换', () => {
    const { room, g, act } = setup(2, { theme: 'china' })
    // 机会牌堆没打乱：第二张是「前进到{39}」
    g.decks.chance.push(g.decks.chance.shift()!)
    g.players[0]!.pos = 4
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    while (g.phase === 'move') act(0, { type: 'step' })
    act(0, { type: 'drawCard' })
    expect(g.card!.text).toBe('前进到重庆，经过起点领取 $200')
    expect(g.players[0]!.pos).toBe(39)
  })

  test('停在别人的重庆要摇火锅辣度，最辣一档租金 ×3', () => {
    const { room, g, act, ids } = setup(2, { theme: 'china' })
    g.owners[39] = { owner: ids[1]!, houses: 0, mortgaged: false }
    g.players[0]!.pos = 36
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    // 辣度用同一个随机数：0.99 落在最后一档
    room.rng = () => 0.99
    while (g.phase === 'move') act(0, { type: 'step' })
    expect(g.spice!.level).toBe('超级无敌特特特特特特特特特变态辣')
    expect(g.eggsSeen).toContain(39)
    expect(g.players[0]!.cash).toBe(1500 - 50 * 3)
    expect(g.players[1]!.cash).toBe(1500 + 50 * 3)
  })

  test('辣度最淡一档租金不变', () => {
    const { room, g, act, ids } = setup(2, { theme: 'china' })
    g.owners[39] = { owner: ids[1]!, houses: 0, mortgaged: false }
    g.players[0]!.pos = 36
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    room.rng = () => 0
    while (g.phase === 'move') act(0, { type: 'step' })
    expect(g.spice!.mult).toBe(1)
    expect(g.players[0]!.cash).toBe(1500 - 50)
  })

  test('带小数的辣度倍数，租金四舍五入', () => {
    const { room, g, act, ids } = setup(2, { theme: 'china' })
    g.owners[39] = { owner: ids[1]!, houses: 0, mortgaged: false }
    g.players[0]!.pos = 36
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    // 落在第二档 ×1.25：$50 → $62.5 → $63
    room.rng = () => 1.5 / 9
    while (g.phase === 'move') act(0, { type: 'step' })
    expect(g.spice!.mult).toBe(1.25)
    expect(g.players[0]!.cash).toBe(1500 - 63)
  })

  test('九档辣度概率一样', () => {
    for (let k = 0; k < SPICE_LEVELS.length; k++) {
      const { room, g, act, ids } = setup(2, { theme: 'china' })
      g.owners[39] = { owner: ids[1]!, houses: 0, mortgaged: false }
      g.players[0]!.pos = 36
      dice(room, 1, 2)
      act(0, { type: 'roll' })
      // 随机数落在第 k 段的中间，就该摇出第 k 档
      room.rng = () => (k + 0.5) / SPICE_LEVELS.length
      while (g.phase === 'move') act(0, { type: 'step' })
      expect(g.spice!.level).toBe(SPICE_LEVELS[k]!.level)
    }
  })

  test('世界主题没有辣度', () => {
    const { room, g, act, ids } = setup()
    g.owners[39] = { owner: ids[1]!, houses: 0, mortgaged: false }
    g.players[0]!.pos = 36
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    while (g.phase === 'move') act(0, { type: 'step' })
    expect(g.spice).toBeNull()
    expect(g.players[0]!.cash).toBe(1450)
  })
})

describe('房东收租', () => {
  test('房东喊了才收租', () => {
    const { room, g, act, ids } = setup(2, { rentClaim: true })
    g.owners[3] = { owner: ids[1]!, houses: 0, mortgaged: false }
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    while (g.phase === 'move') act(0, { type: 'step' })
    expect(g.phase).toBe('claim')
    expect(g.rentClaim!.amount).toBe(4)
    expect(() => act(0, { type: 'endTurn' })).toThrow()
    expect(() => act(0, { type: 'claimRent' })).toThrow('没有租可收')
    act(1, { type: 'claimRent' })
    expect(g.players[0]!.cash).toBe(1496)
    expect(g.players[1]!.cash).toBe(1504)
    expect(g.phase).toBe('end')
    room.dispose()
  })

  test('房东没喊就白住', () => {
    const { room, g, act, ids } = setup(2, { rentClaim: true })
    g.owners[3] = { owner: ids[1]!, houses: 0, mortgaged: false }
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    while (g.phase === 'move') act(0, { type: 'step' })
    room['expireClaim']()
    room.dispose()
    expect(g.phase).toBe('end')
    expect(g.players[0]!.cash).toBe(1500)
    expect(() => act(1, { type: 'claimRent' })).toThrow('没有租可收')
  })
})

describe('拍卖', () => {
  test('放弃购买后全员拍卖，价高者得', () => {
    const { room, g, act, ids } = setup(3, { auction: true })
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    while (g.phase === 'move') act(0, { type: 'step' })
    act(0, { type: 'pass' })
    expect(g.phase).toBe('auction')
    act(1, { type: 'bid', amount: 20 })
    expect(() => act(2, { type: 'bid', amount: 25 })).toThrow('至少 $30')
    act(2, { type: 'bid', amount: 40 })
    expect(() => act(1, { type: 'bid', amount: 99999 })).toThrow('现金不够')
    room['finishAuction']()
    room.dispose()
    expect(g.owners[3]!.owner).toBe(ids[2]!)
    expect(g.players[2]!.cash).toBe(1460)
    expect(g.phase).toBe('end')
  })

  test('没人出价就流拍', () => {
    const { room, g, act } = setup(2, { auction: true })
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    while (g.phase === 'move') act(0, { type: 'step' })
    act(0, { type: 'pass' })
    room['finishAuction']()
    room.dispose()
    expect(g.owners[3]).toBeUndefined()
    expect(g.phase).toBe('end')
  })
})

describe('对决', () => {
  test('挑对手各摇一次，点数大的拿走赌注', () => {
    const { room, g, act, ids } = setup()
    g.players[0]!.pos = 19
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    while (g.phase === 'move') act(0, { type: 'step' })
    expect(g.phase).toBe('duel')
    act(0, { type: 'duelPick', target: ids[1]! })
    dice(room, 6, 6, 1, 1)
    act(0, { type: 'duelRoll' })
    expect(() => act(0, { type: 'duelRoll' })).toThrow('摇过了')
    act(1, { type: 'duelRoll' })
    room.dispose()
    expect(g.duel!.winner).toBe(ids[0]!)
    expect(g.players[0]!.cash).toBe(1600)
    expect(g.players[1]!.cash).toBe(1400)
    expect(g.phase).toBe('end')
  })

  test('不想比就算了', () => {
    const { room, g, act } = setup()
    g.players[0]!.pos = 19
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    while (g.phase === 'move') act(0, { type: 'step' })
    act(0, { type: 'duelPick', target: null })
    room.dispose()
    expect(g.duel).toBeNull()
    expect(g.phase).toBe('end')
  })

  test('对手不摇就替他摇', () => {
    const { room, g, act, ids } = setup()
    g.players[0]!.pos = 19
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    while (g.phase === 'move') act(0, { type: 'step' })
    act(0, { type: 'duelPick', target: ids[1]! })
    dice(room, 1, 1, 6, 6)
    act(0, { type: 'duelRoll' })
    room['duelTimeout']()
    room.dispose()
    expect(g.duel!.winner).toBe(ids[1]!)
    expect(g.players[1]!.cash).toBe(1600)
  })
})

describe('全城事件', () => {
  test('第 2 轮开局翻事件：楼市降温本轮租金减半', () => {
    const { room, g, act, ids } = setup(2, { cityEvents: true })
    g.owners[3] = { owner: ids[1]!, houses: 0, mortgaged: false }
    expect(room.rentOf(3)).toBe(4)
    g.phase = 'end'
    act(0, { type: 'endTurn' })
    expect(g.event).toBeNull()
    // 事件按随机数取第一张「楼市降温」
    room.rng = () => 0
    g.phase = 'end'
    act(1, { type: 'endTurn' })
    expect(g.round).toBe(2)
    expect(g.event!.title).toBe('楼市降温')
    expect(room.rentOf(3)).toBe(2)
  })

  test('全民红包每人领 $100', () => {
    const { room, g, act } = setup(2, { cityEvents: true })
    g.phase = 'end'
    act(0, { type: 'endTurn' })
    room.rng = () => 3.5 / 8
    g.phase = 'end'
    act(1, { type: 'endTurn' })
    expect(g.event!.key).toBe('redpacket')
    expect(g.players.every((p) => p.cash === 1600)).toBe(true)
  })
})

describe('选择题卡', () => {
  test('领 $100，还是赌一把', () => {
    const { room, g, act } = setup()
    g.decks.chance.unshift(16)
    g.players[0]!.pos = 4
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    while (g.phase === 'move') act(0, { type: 'step' })
    act(0, { type: 'drawCard' })
    expect(g.phase).toBe('choose')
    expect(g.choice!.options.length).toBe(2)
    act(0, { type: 'chooseOption', index: 0 })
    expect(g.players[0]!.cash).toBe(1600)
    expect(g.phase).toBe('end')
  })

  test('赌一把掷出双数领 $300', () => {
    const { room, g, act } = setup()
    g.decks.chance.unshift(16)
    g.players[0]!.pos = 4
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    while (g.phase === 'move') act(0, { type: 'step' })
    act(0, { type: 'drawCard' })
    dice(room, 4, 4)
    act(0, { type: 'chooseOption', index: 1 })
    expect(g.gamble!.win).toBe(true)
    expect(g.players[0]!.cash).toBe(1800)
  })
})

describe('城市彩蛋', () => {
  const walkTo = (room: Room, g: Room['d']['game'] & object, act: (i: number, m: ClientMessage) => unknown, from: number) => {
    g.players[0]!.pos = from
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    room.rng = () => 0
    while (g.phase === 'move') act(0, { type: 'step' })
  }

  test('哈尔滨冰面打滑，往前滑出去', () => {
    const { room, g, act } = setup(2, { theme: 'china' })
    walkTo(room, g, act, 11)
    expect(g.egg!.kind).toBe('slide')
    expect(g.eggsSeen).toContain(14)
    expect(g.players[0]!.pos).toBe(15)
    expect(g.phase).toBe('buy')
  })

  test('天津摩天轮，落到一块没人买的地', () => {
    const { room, g, act } = setup(2, { theme: 'china' })
    walkTo(room, g, act, 23)
    expect(g.egg!.kind).toBe('wheel')
    expect(g.players[0]!.pos).toBe(1)
    expect(g.phase).toBe('buy')
  })

  test('长沙奶茶排队，下回合歇一次', () => {
    const { room, g, act } = setup(2, { theme: 'china' })
    walkTo(room, g, act, 16)
    expect(g.egg!.kind).toBe('milktea')
    expect(g.players[0]!.cash).toBe(1530)
    if (g.phase === 'buy') act(0, { type: 'pass' })
    act(0, { type: 'endTurn' })
    g.phase = 'end'
    act(1, { type: 'endTurn' })
    // 阿狸在排队，又轮到白菜
    expect(g.turn).toBe(1)
    expect(g.players[0]!.skipTurns).toBe(0)
  })

  test('北京天坛祈福，下次掷骰子必出双数', () => {
    const { room, g, act } = setup(2, { theme: 'china' })
    walkTo(room, g, act, 31)
    expect(g.players[0]!.blessed).toBe(true)
    if (g.phase === 'buy') act(0, { type: 'pass' })
    act(0, { type: 'endTurn' })
    g.phase = 'end'
    act(1, { type: 'endTurn' })
    dice(room, 2, 5)
    act(0, { type: 'roll' })
    expect(g.lastRoll!.dice).toEqual([2, 2])
    expect(g.players[0]!.blessed).toBe(false)
  })
})

describe('徽章与高光', () => {
  test('第一个买地的人得「首个地主」', () => {
    const { room, g, act } = setup()
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    while (g.phase === 'move') act(0, { type: 'step' })
    act(0, { type: 'buy' })
    expect(g.players[0]!.badges).toContain('首个地主')
  })

  test('结算列出最贵的一笔租金和收租王', () => {
    const { room, g, act, ids } = setup()
    g.owners[3] = { owner: ids[1]!, houses: 5, mortgaged: false }
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    while (g.phase === 'move') act(0, { type: 'step' })
    act(0, { type: 'abort' })
    const titles = g.result!.highlights.map((h) => h.title)
    expect(titles).toContain('最贵的一笔租金')
    expect(titles).toContain('收租王')
    expect(g.players[1]!.badges).toContain('收租王')
  })
})

test('棋盘共 40 格，22 个国家', () => {
  expect(BOARD.length).toBe(40)
  expect(BOARD.filter((t) => t.kind === 'country').length).toBe(22)
})
