import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DueDatePicker from '../components/DueDatePicker.vue'

// The test browser has no matchMedia; pretend to be a laptop-sized window.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 21, 15, 0)) // Wednesday 21 Oct 2026, 3pm
  window.matchMedia = (() => ({ matches: false })) as never
})
afterEach(() => vi.useRealTimers())

function mountPicker(modelValue = '') {
  const wrapper = mount(DueDatePicker, {
    props: {
      modelValue,
      'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value })
    },
    global: { stubs: { teleport: true } } // keep the pop-up inside the wrapper
  })
  return wrapper
}

const value = (wrapper: ReturnType<typeof mountPicker>) => wrapper.props('modelValue')
const button = (wrapper: ReturnType<typeof mountPicker>, text: string) =>
  wrapper.findAll('button').find((b) => b.text().includes(text))!

describe('DueDatePicker', () => {
  it('sets a due date with one tap and closes', async () => {
    const wrapper = mountPicker()
    expect(wrapper.text()).toContain('Add due date')

    await wrapper.find('button[aria-haspopup]').trigger('click')
    expect(wrapper.find('[role=dialog]').exists()).toBe(true)

    await button(wrapper, 'Tomorrow').trigger('click')
    expect(value(wrapper)).toBe('2026-10-22T09:00')
    expect(wrapper.find('[role=dialog]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Tomorrow, ')
  })

  it('keeps the time when another day is picked', async () => {
    const wrapper = mountPicker('2026-10-21T18:00')
    await wrapper.find('button[aria-haspopup]').trigger('click')
    await wrapper.find('[data-day="2026-10-23"]').trigger('click')
    expect(value(wrapper)).toBe('2026-10-23T18:00')
  })

  it('gives a newly picked day a sensible time', async () => {
    const wrapper = mountPicker()
    await wrapper.find('button[aria-haspopup]').trigger('click')
    await wrapper.find('[data-day="2026-10-21"]').trigger('click')
    expect(value(wrapper)).toBe('2026-10-21T16:00') // today: the next full hour

    await wrapper.find('[data-day="2026-10-30"]').trigger('click')
    expect(value(wrapper)).toBe('2026-10-30T16:00') // the chosen time stays

    await wrapper.setProps({ modelValue: '' })
    await wrapper.find('[data-day="2026-10-30"]').trigger('click')
    expect(value(wrapper)).toBe('2026-10-30T09:00')
  })

  it('uses today or tomorrow when only a time is chosen', async () => {
    const wrapper = mountPicker()
    await wrapper.find('button[aria-haspopup]').trigger('click')
    await wrapper.find('input[type=time]').setValue('18:30')
    expect(value(wrapper)).toBe('2026-10-21T18:30')

    await wrapper.setProps({ modelValue: '' })
    await wrapper.find('input[type=time]').setValue('08:00') // already gone today
    expect(value(wrapper)).toBe('2026-10-22T08:00')
  })

  it('moves through the calendar with the arrow keys', async () => {
    const wrapper = mountPicker('2026-10-31T09:00')
    await wrapper.find('button[aria-haspopup]').trigger('click')
    await wrapper.find('[data-day="2026-10-31"]').trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.find('[data-day="2026-11-07"]').attributes('tabindex')).toBe('0')
    expect(wrapper.find('[data-day="2026-11-30"]').exists()).toBe(true) // now showing November
  })

  it('removes the due date', async () => {
    const wrapper = mountPicker('2026-10-23T09:00')
    await wrapper.find('button[aria-label="Remove the due date"]').trigger('click')
    expect(value(wrapper)).toBe('')
    expect(wrapper.text()).toContain('Add due date')
  })
})
