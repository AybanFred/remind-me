import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AuthView from '@/views/AuthView.vue'
import TasksView from '@/views/TasksView.vue'
import BoardView from '@/views/BoardView.vue'
import CalendarView from '@/views/CalendarView.vue'
import FocusView from '@/views/FocusView.vue'
import DashboardView from '@/views/DashboardView.vue'
import CoachView from '@/views/CoachView.vue'
import SettingsView from '@/views/SettingsView.vue'
import TimeView from '@/views/TimeView.vue'
import TrackerView from '@/views/TrackerView.vue'
import ProjectsView from '@/views/ProjectsView.vue'
import ReportsView from '@/views/ReportsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  // Links like /settings#categories scroll to that section; everything else starts at the top.
  scrollBehavior(to) {
    return to.hash ? { el: to.hash, behavior: 'smooth' } : { top: 0 }
  },
  routes: [
    { path: '/', name: 'tasks', component: TasksView, meta: { requiresAuth: true } },
    { path: '/board', name: 'board', component: BoardView, meta: { requiresAuth: true, size: 'wide' } },
    { path: '/calendar', name: 'calendar', component: CalendarView, meta: { requiresAuth: true, size: 'wide' } },
    { path: '/focus', name: 'focus', component: FocusView, meta: { requiresAuth: true } },
    { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { requiresAuth: true, size: 'medium' } },
    { path: '/coach', name: 'coach', component: CoachView, meta: { requiresAuth: true } },
    { path: '/settings', name: 'settings', component: SettingsView, meta: { requiresAuth: true } },
    {
      path: '/time',
      component: TimeView,
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'time', component: TrackerView },
        { path: 'projects', name: 'time-projects', component: ProjectsView },
        { path: 'reports', name: 'time-reports', component: ReportsView }
      ]
    },
    { path: '/login', name: 'login', component: AuthView }
  ]
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.user) {
    return '/login'
  }
  if (to.path === '/login' && auth.user) {
    return '/'
  }
})

export default router
