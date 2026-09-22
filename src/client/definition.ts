// Stage one: what the `hardware` tab type IS.
//
// A page type: it claims no resource address and is opened by kind (a guide
// entry, or `tab.actions.openTab('hardware')`). `priority: 'extension'` is the
// default band for an outside plugin; `title` and the guide copy are thunked so
// they re-read the current language on every draw.

import type { TranslateNS } from '@deepseek-ai/dsh-client-locale/client'
import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'

/** The tab kind this package owns. */
export const HARDWARE_KIND = 'hardware'

/** This implementation's identity in the tab system: the key its body registers under. */
export const HARDWARE_ID = 'dsh-vitals'

/**
 * The hardware type's registry definition.
 * @param t - namespace-bound translate, read fresh on every title call.
 * @returns the definition to register.
 */
export function hardwareDefinition(t: TranslateNS<'hardwareMonitor'>): SidebarRightTabDefinition {
  return {
    id: HARDWARE_ID,
    kind: HARDWARE_KIND,
    priority: 'extension',
    title: () => t('tab.title'),
    guide: [
      {
        order: 1000,
        title: () => t('guide.title'),
        description: () => t('guide.description'),
      },
    ],
  }
}
