import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// The real client needs project keys, so the Supabase calls are replaced by simple stubs.
const { signUp, resend, signInWithPassword, push } = vi.hoisted(() => ({
  signUp: vi.fn(),
  resend: vi.fn(),
  signInWithPassword: vi.fn(),
  push: vi.fn()
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signUp, resend, signInWithPassword, signInWithOAuth: vi.fn() } }
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
// The page's logo is imported from the public folder, which the test runner can't load.
vi.mock('/icon.svg', () => ({ default: '' }))

import AuthView from '../views/AuthView.vue'

async function openSignUp() {
  const wrapper = mount(AuthView, { global: { stubs: { AppFooter: true } } })
  await wrapper.find('button.btn-link').trigger('click') // switch to sign up
  await wrapper.find('input[type=email]').setValue('new@example.com')
  await wrapper.find('input[type=password]').setValue('secret123')
  return wrapper
}

describe('email confirmation on sign-up', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('tells the user to check their email when no session comes back', async () => {
    signUp.mockResolvedValue({ data: { user: { id: 'u' }, session: null }, error: null })
    const wrapper = await openSignUp()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Check your email')
    expect(wrapper.text()).toContain('new@example.com')
    expect(push).not.toHaveBeenCalled()
    // the confirmation link must bring the user back to this site
    expect(signUp.mock.calls[0]![0].options.emailRedirectTo).toBe(window.location.origin)
  })

  it('goes straight in when the project does not require confirmation', async () => {
    signUp.mockResolvedValue({
      data: { user: { id: 'u' }, session: { access_token: 't' } },
      error: null
    })
    const wrapper = await openSignUp()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).not.toContain('Check your email')
    expect(push).toHaveBeenCalledWith('/')
  })

  it('can send the confirmation email again', async () => {
    signUp.mockResolvedValue({ data: { user: { id: 'u' }, session: null }, error: null })
    resend.mockResolvedValue({ error: null })
    const wrapper = await openSignUp()
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    const resendButton = wrapper.findAll('button').find((b) => b.text().includes('Resend'))!
    await resendButton.trigger('click')
    await flushPromises()

    expect(resend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'signup', email: 'new@example.com' })
    )
    expect(wrapper.text()).toContain('Sent again')
  })

  it('explains an unconfirmed account when logging in and offers a resend', async () => {
    signInWithPassword.mockResolvedValue({ error: new Error('Email not confirmed') })
    const wrapper = mount(AuthView, { global: { stubs: { AppFooter: true } } })
    await wrapper.find('input[type=email]').setValue('new@example.com')
    await wrapper.find('input[type=password]').setValue('secret123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Please confirm your email first')
    expect(wrapper.text()).toContain('Resend the confirmation email')
    expect(push).not.toHaveBeenCalled()
  })
})
