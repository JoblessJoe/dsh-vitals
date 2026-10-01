// Browser half entry: register the dictionary, the full `Hardware` view next
// to Chat/Trajectory, and the mini CPU/GPU widget in the session header.

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { en, zh } from './locales'
import { HardwareBody } from './body'
import { HeaderVitals } from './mini'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    hardwareMonitor:
      | 'tab.title'
      | 'section.cpu' | 'section.mem' | 'section.temp' | 'section.gpu'
      | 'cpu.overall' | 'cpu.cores' | 'mem.used' | 'temp.max'
      | 'gpu.none' | 'gpu.util' | 'gpu.power' | 'gpu.mem' | 'gpu.temp'
      | 'loading' | 'error' | 'retry' | 'mini.open'
  }
}

/** This plugin's identity: the view id and the header-utility id. */
export const HARDWARE_ID = 'dsh-vitals'

export const inject = ['slots', 'locale']

export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind('hardwareMonitor')

  ctx.effect(() => ctx.locale.register('hardwareMonitor', { zh, en }), 'dsh-vitals: dictionaries')

  // Full-size main-panel tab, next to Chat/Trajectory — same
  // 'conversation.view' slot those two register on (ui-chat's/ui-trajectory's
  // own apply.ts). No `inject` needed: HardwareBody reads only `t`, not
  // anything session-scoped, so the per-session render is just the same
  // global live view every other surface here already shows.
  ctx.effect(
    () => ctx.slots.inject('conversation.view', () =>
      ctx.slots.register({ name: 'conversation.view', id: HARDWARE_ID, order: 20, locale: 'hardwareMonitor', label: () => t('tab.title') }, HardwareBody)),
    'dsh-vitals: conversation tab',
  )

  // Mini view in the session header (top bar, next to "⋯"): CPU + GPU load at
  // a glance; clicking it switches to the Hardware view above.
  ctx.effect(
    () => ctx.slots.inject('conversation.session.header.utilities', () =>
      ctx.slots.register({
        name: 'conversation.session.header.utilities',
        id: HARDWARE_ID,
        order: -20,
        locale: 'hardwareMonitor',
      }, HeaderVitals)),
    'dsh-vitals: header mini view',
  )
}
