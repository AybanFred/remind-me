// XP, levels and the celebration message shown after finishing a task.
// XP is not stored anywhere: it is worked out from your existing tasks and focus sessions.

export const XP_PER_TASK = 10 // plus 1 XP for every minute of focus
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100]

// Level n starts at 50 * n * (n - 1) XP: level 2 at 100, level 3 at 300, level 4 at 600, ...
// Each level takes a little longer than the one before.
export function xpForLevel(level) {
  return 50 * level * (level - 1)
}

export function levelForXp(xp) {
  return Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2)
}

export function levelProgress(xp) {
  const level = levelForXp(xp)
  const start = xpForLevel(level)
  const needed = xpForLevel(level + 1) - start
  return {
    level,
    xpIntoLevel: xp - start,
    xpForNext: needed,
    percent: Math.round(((xp - start) / needed) * 100)
  }
}

// A few lines per category so the message doesn't feel the same every time.
const flavour = {
  upskilling: ['Skill unlocked.', 'Brain gains logged.', 'Learning compounds. Nice one.'],
  job_hunt: [
    'One step closer to the offer.',
    "Applications don't send themselves. Well done.",
    'Progress on the job hunt. Keep going.'
  ],
  daily: ['Life admin conquered.', 'Checked off. One less thing to carry.', 'Small win, banked.']
}

// Chooses how big the celebration is and what it says.
//   doneToday    - tasks completed today, including this one
//   streak       - current streak in days
//   levelBefore / levelAfter - the level without and with this task's XP
// `random` can be swapped out in tests to get a predictable message.
export function pickReward({
  category,
  doneToday,
  streak = 0,
  levelBefore = 0,
  levelAfter = 0,
  random = Math.random
}) {
  const pick = (list) => list[Math.floor(random() * list.length)]

  if (levelAfter > levelBefore) {
    return { tier: 'big', message: `Level up! You reached level ${levelAfter}.`, xp: XP_PER_TASK }
  }
  if (doneToday === 1 && STREAK_MILESTONES.includes(streak)) {
    return { tier: 'big', message: `${streak}-day streak! Consistency is paying off.`, xp: XP_PER_TASK }
  }
  if (doneToday >= 10 && doneToday % 5 === 0) {
    return { tier: 'big', message: `Unstoppable: ${doneToday} tasks done today.`, xp: XP_PER_TASK }
  }
  if (doneToday === 5) {
    return { tier: 'medium', message: 'High five! 5 tasks done today.', xp: XP_PER_TASK }
  }
  if (doneToday === 3) {
    return { tier: 'medium', message: 'Hat trick! 3 tasks done today.', xp: XP_PER_TASK }
  }
  if (doneToday === 1) {
    return { tier: 'small', message: 'First win of the day. Momentum is on.', xp: XP_PER_TASK }
  }
  return { tier: 'small', message: pick(flavour[category] ?? flavour.daily), xp: XP_PER_TASK }
}
