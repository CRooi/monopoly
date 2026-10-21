import { afterEach, describe, expect, setSystemTime, test } from 'bun:test'
import { BAIL, BOARD, GO_SALARY, JAIL_POS, type ClientMessage } from '../../shared/types'
import { GameError, Room } from './room'

/** 建房并开局：玩家顺序固定为 A、B、C… */
function setup(n = 2, config = {}) {
  const { room, user: a } = Room.create('1234', config, 'A')
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
    expect(() => room.handle(b.id, { type: 'updateConfig', config: { startCash: 2000, maxRounds: 0, parkingPot: false, allowSpectators: true, theme: 'world' } })).toThrow('只有房主')
  })

  test('房主离开后转给下一位', () => {
    const { room, user } = Room.create('1000', {}, '房主')
    const b = room.join('B')
    room.handle(user.id, { type: 'leave' })
    expect(room.d.hostId).toBe(b.id)
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

  test('停在别人的重庆要摇火锅辣度，特辣租金 ×3', () => {
    const { room, g, act, ids } = setup(2, { theme: 'china' })
    g.owners[39] = { owner: ids[1]!, houses: 0, mortgaged: false }
    g.players[0]!.pos = 36
    dice(room, 1, 2)
    act(0, { type: 'roll' })
    // 辣度用同一个随机数：0.99 落在最后一档「特辣」
    room.rng = () => 0.99
    while (g.phase === 'move') act(0, { type: 'step' })
    expect(g.spice!.level).toBe('特辣')
    expect(g.players[0]!.cash).toBe(1500 - 50 * 3)
    expect(g.players[1]!.cash).toBe(1500 + 50 * 3)
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

test('棋盘共 40 格，22 个国家', () => {
  expect(BOARD.length).toBe(40)
  expect(BOARD.filter((t) => t.kind === 'country').length).toBe(22)
})
