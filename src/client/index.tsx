// Browser half entry: register the `hardware` page-type tab, its dictionary,
// and its body + title seats.
//
// A page type claims no resource address, so it registers no store and no
// children — only the definition (so a guide capsule and `openTab('hardware')`
// exist), the `{zh,en}` dictionary, and the keyed body/title seats the panel
// seat finds under the definition's id.

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { en, zh } from './locales'
import { HARDWARE_ID, HARDWARE_KIND, hardwareDefinition } from './definition'
import { HardwareBody } from './body'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    hardwareMonitor:
      | 'tab.title' | 'guide.title' | 'guide.description'
      | 'section.cpu' | 'section.mem' | 'section.temp' | 'section.gpu'
      | 'cpu.overall' | 'cpu.cores' | 'mem.used' | 'temp.max'
      | 'gpu.none' | 'gpu.util' | 'gpu.power' | 'gpu.mem' | 'gpu.temp'
      | 'loading' | 'error' | 'retry'
  }
}

export const inject = ['slots', 'locale', 'sidebarRightTabs']

export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind('hardwareMonitor')

  ctx.effect(() => ctx.locale.register('hardwareMonitor', { zh, en }), 'dsh-vitals: dictionaries')

  ctx.effect(
    () => ctx.sidebarRightTabs.register(hardwareDefinition(t)),
    'dsh-vitals: hardware type',
  )

  ctx.effect(
    () => ctx.slots.inject('sidebar.right.pane.tab', () =>
      ctx.slots.register({ name: 'sidebar.right.pane.tab', key: HARDWARE_ID, locale: 'hardwareMonitor' }, HardwareBody)),
    'dsh-vitals: body seat',
  )

  // Title: a page-type tab shows its definition title on the chip; registering
  // a seat is optional. Kept minimal (no seat) — the chip falls back to the
  // registered definition's title, exactly like the text preview's chip path.

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
}

export { HARDWARE_ID, HARDWARE_KIND }
