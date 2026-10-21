import { defineStore } from 'pinia'
import { celebrate } from '@/lib/confetti'
import { dateKey } from '@/lib/stats'
import { levelForXp, pickReward, XP_PER_TASK } from '@/lib/rewards'
import { useAppearanceStore } from '@/stores/appearance'
import { useStatsStore } from '@/stores/stats'
import { useTasksStore } from '@/stores/tasks'
import { useToastStore } from '@/stores/toast'

export const useRewardsStore = defineStore('rewards', {
  actions: {
    // Called right after a task is completed. The confetti starts instantly from local data;
    // then we look up the streak and level (a quick request) so the message can be more specific.
    //   origin - where on screen to start the confetti, as { x, y } from 0 to 1
    async celebrate({ category, origin } = {}) {
      const toast = useToastStore()
      const withConfetti = useAppearanceStore().prefs.confetti

      // How many tasks were finished today? They are all in memory already, so this is instant.
      const today = dateKey(new Date())
      const doneToday = useTasksStore().tasks.filter(
        (t) => t.completed_at && dateKey(new Date(t.completed_at)) === today
      ).length

      const quick = pickReward({ category, doneToday })
      if (withConfetti) celebrate(quick.tier, origin)

      // Streak and level need the full history. If it is slow or fails, the quick message is enough.
      const stats = useStatsStore()
      let reward = quick
      try {
        await Promise.race([stats.fetchStats(), new Promise((_, reject) => setTimeout(reject, 2500))])
        const xpNow = stats.xp
        reward = pickReward({
          category,
          doneToday,
          streak: stats.streak,
          levelBefore: levelForXp(xpNow - XP_PER_TASK),
          levelAfter: levelForXp(xpNow)
        })
        // A milestone the quick check could not know about gets its own bigger burst.
        if (withConfetti && reward.tier === 'big' && quick.tier !== 'big') celebrate('big', origin)
      } catch {
        /* keep the quick reward */
      }

      toast.show(`${reward.message}  +${reward.xp} XP`, { type: 'reward', duration: 5000 })
    }
  }
})
