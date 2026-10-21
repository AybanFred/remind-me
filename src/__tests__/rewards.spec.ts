import { describe, it, expect } from 'vitest'
import { levelForXp, levelProgress, pickReward, xpForLevel } from '../lib/rewards'
import { isHexColor, readableTextOn } from '../lib/color'

const first = () => 0 // always picks the first message

describe('levels', () => {
  it('starts at level 1 and levels up at 100, 300, 600 XP', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(99)).toBe(1)
    expect(levelForXp(100)).toBe(2)
    expect(levelForXp(299)).toBe(2)
    expect(levelForXp(300)).toBe(3)
    expect(levelForXp(600)).toBe(4)
  })

  it('agrees with xpForLevel', () => {
    for (let level = 1; level < 12; level++) {
      expect(levelForXp(xpForLevel(level))).toBe(level)
      expect(levelForXp(xpForLevel(level + 1) - 1)).toBe(level)
    }
  })

  it('reports progress inside the current level', () => {
    // level 2 runs from 100 to 300 XP, so 200 XP is exactly halfway
    expect(levelProgress(200)).toEqual({ level: 2, xpIntoLevel: 100, xpForNext: 200, percent: 50 })
  })
})

describe('pickReward', () => {
  it('celebrates the first task of the day', () => {
    const reward = pickReward({ category: 'daily', doneToday: 1, random: first })
    expect(reward.tier).toBe('small')
    expect(reward.message).toContain('First win')
  })

  it('uses a medium celebration for 3 and 5 tasks', () => {
    expect(pickReward({ category: 'daily', doneToday: 3 }).tier).toBe('medium')
    expect(pickReward({ category: 'daily', doneToday: 5 }).tier).toBe('medium')
  })

  it('goes big at 10 tasks, and again every 5 after that', () => {
    expect(pickReward({ category: 'daily', doneToday: 10 }).tier).toBe('big')
    expect(pickReward({ category: 'daily', doneToday: 15 }).tier).toBe('big')
    expect(pickReward({ category: 'daily', doneToday: 12 }).tier).toBe('small')
  })

  it('announces a streak milestone on the first task of the day', () => {
    const reward = pickReward({ category: 'daily', doneToday: 1, streak: 7 })
    expect(reward).toMatchObject({ tier: 'big' })
    expect(reward.message).toContain('7-day streak')
  })

  it('does not repeat the streak message on later tasks', () => {
    const reward = pickReward({ category: 'daily', doneToday: 2, streak: 7, random: first })
    expect(reward.tier).toBe('small')
  })

  it('level-up beats everything else', () => {
    const reward = pickReward({ category: 'daily', doneToday: 1, streak: 7, levelBefore: 2, levelAfter: 3 })
    expect(reward.message).toContain('level 3')
  })

  it('uses a message that matches the category', () => {
    const reward = pickReward({ category: 'job_hunt', doneToday: 2, random: first })
    expect(reward.message).toContain('offer')
  })

  it('falls back to the daily messages for an unknown category', () => {
    const reward = pickReward({ category: 'mystery', doneToday: 2, random: first })
    expect(reward.message).toBe('Life admin conquered.')
  })
})

describe('colour helpers', () => {
  it('only accepts #rrggbb', () => {
    expect(isHexColor('#4f46e5')).toBe(true)
    expect(isHexColor('#FFF')).toBe(false)
    expect(isHexColor('red')).toBe(false)
    expect(isHexColor('#4f46e5; color: red')).toBe(false)
    expect(isHexColor(null)).toBe(false)
  })

  it('picks white text on dark colours and dark text on light colours', () => {
    expect(readableTextOn('#4f46e5')).toBe('#ffffff')
    expect(readableTextOn('#fde68a')).toBe('#111827')
    expect(readableTextOn('#000000')).toBe('#ffffff')
    expect(readableTextOn('#ffffff')).toBe('#111827')
  })
})
