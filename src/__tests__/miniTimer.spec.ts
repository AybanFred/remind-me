import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, reactive } from 'vue'

// The real client needs project keys, so the store's Supabase calls are replaced by stubs.
const router = vi.hoisted(() => ({ route: { path: '/', fullPath: '/' } }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('vue-router', () => ({ useRoute: () => router.route }))

import MiniTimer from '../components/MiniTimer.vue'
import { useTimeStore } from '../stores/time'

const startedAt = new Date(Date.now() - 90 * 60 * 1000).toISOString() // 1.5 hours ago
const runningEntry = {
  id: 'e1',
  description: 'Writing the report',
  project_id: 'p1',
  task_id: 't1',
  started_at: startedAt,
  ended_at: null
}

let wrapper: VueWrapper
let time: ReturnType<typeof useTimeStore>

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  router.route = reactive({ path: '/', fullPath: '/' })
  time = useTimeStore()
  // The store is plain JavaScript, so TypeScript can't know what its lists hold.
  time.projects = [{ id: 'p1', name: 'Website', color: '#4f46e5', archived: false }] as never
  time.projectTasks = [{ id: 't1', project_id: 'p1', name: 'Design' }] as never
  time.entries = [{ ...runningEntry }] as never
  time.now = Date.parse(startedAt) + 90 * 60 * 1000 // the clock shows exactly 1:30:00
  wrapper = mount(MiniTimer, {
    attachTo: document.body,
    global: { stubs: { RouterLink: true } }
  })
})
afterEach(() => wrapper.unmount())

const card = () => wrapper.find('[role=timer]')
const pill = () => wrapper.find('button[title^="Show details"]')

describe('MiniTimer', () => {
  it('only shows after minimizing, and only while a timer runs', async () => {
    expect(wrapper.find('section').exists()).toBe(false)

    time.setMini({ open: true })
    await nextTick()
    expect(card().text()).toBe('1:30:00')
    expect(wrapper.text()).toContain('Writing the report')
    expect(wrapper.text()).toContain('Website · Design')

    time.entries = [{ ...runningEntry, ended_at: new Date().toISOString() }] as never
    await nextTick()
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('shrinks to a pill when you click elsewhere or change page, unless pinned', async () => {
    time.setMini({ open: true, expanded: true })
    await nextTick()

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(card().exists()).toBe(false)
    expect(pill().text()).toContain('1:30:00')

    await pill().trigger('click')
    expect(card().exists()).toBe(true)

    router.route.fullPath = '/dashboard'
    await nextTick()
    await nextTick()
    expect(card().exists()).toBe(false)

    await pill().trigger('click')
    await wrapper.find('button[aria-label="Pin open"]').trigger('click')
    expect(time.mini.pinned).toBe(true)

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    router.route.fullPath = '/focus'
    await nextTick()
    await nextTick()
    expect(card().exists()).toBe(true)
  })

  it('clicking inside it does not shrink it', async () => {
    time.setMini({ open: true, expanded: true })
    await nextTick()
    card().element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(card().exists()).toBe(true)
  })

  it('stops the timer', async () => {
    time.setMini({ open: true, expanded: true })
    await nextTick()
    const stop = vi.spyOn(time, 'stop').mockResolvedValue(undefined)
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Stop'))!
      .trigger('click')
    expect(stop).toHaveBeenCalled()
  })

  it('remembers how it was left on this device', async () => {
    time.setMini({ open: true, pinned: true, corner: 'top-left' })
    expect(JSON.parse(localStorage.getItem('miniTimer')!)).toMatchObject({
      open: true,
      pinned: true,
      corner: 'top-left'
    })

    setActivePinia(createPinia())
    expect(useTimeStore().mini).toMatchObject({ open: true, pinned: true, corner: 'top-left' })
  })
})

describe('MiniTimer pinned in an always-on-top window', () => {
  const pip = window as unknown as { documentPictureInPicture?: unknown }
  let floating: { document: Document; close: () => void; addEventListener: unknown }
  let hidePage: () => void

  beforeEach(() => {
    // jsdom has no Picture-in-Picture, so this stands in for the browser's small floating window.
    const doc = document.implementation.createHTMLDocument('Timer')
    floating = {
      document: doc,
      addEventListener: (_: string, listener: () => void) => (hidePage = listener),
      close: () => hidePage()
    }
    pip.documentPictureInPicture = { requestWindow: async () => floating }
    wrapper.unmount()
    wrapper = mount(MiniTimer, { attachTo: document.body, global: { stubs: { RouterLink: true } } })
    time.setMini({ open: true, expanded: false })
  })
  afterEach(() => delete pip.documentPictureInPicture)

  it('moves the timer into the floating window when pinned, and back when unpinned', async () => {
    await nextTick()
    await wrapper.find('button[title^="Show details"]').trigger('click')
    await wrapper.find('button[aria-label="Pin open"]').trigger('click')
    await flushPromises()

    expect(floating.document.body.querySelector('[role=timer]')?.textContent?.trim()).toBe(
      '1:30:00'
    )
    expect(wrapper.find('[role=timer]').exists()).toBe(false) // no longer drawn in the page
    expect(floating.document.body.textContent).toContain('Tracking · on top')

    floating.document.body.querySelector<HTMLElement>('button[aria-label="Unpin"]')!.click()
    await flushPromises()
    expect(floating.document.body.querySelector('[role=timer]')).toBeNull()
    expect(wrapper.find('[role=timer]').exists()).toBe(true)
  })

  it('closes the floating window when the timer stops', async () => {
    await wrapper.find('button[title^="Show details"]').trigger('click')
    await wrapper.find('button[aria-label="Pin open"]').trigger('click')
    await flushPromises()
    const close = vi.spyOn(floating, 'close')

    time.entries = [{ ...runningEntry, ended_at: new Date().toISOString() }] as never
    await flushPromises()
    expect(close).toHaveBeenCalled()
  })
})
