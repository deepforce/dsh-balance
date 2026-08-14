/**
 * Browser half of dsh-balance: registers a composer-dock entry that renders
 * the DeepSeek account balance under the conversation stats line, with
 * locale-aware copy following the active dsh language.
 *
 * @module @deepforce/dsh-balance/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: merges the ctx.locale declaration.
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: merges the conversation slot declarations into the SlotMap.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { BalanceDock } from './BalanceDock.tsx'
import { en, NS, zh, type BalanceKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Balance readout copy. */
    'balance': BalanceKey
  }
}

/** Required services: the slot registry and the locale dictionary registry. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: register the dictionaries and contribute the balance
 * readout to the composer dock, after the shipped stats line (`order: 1`
 * follows its `order: 0`).
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-balance: dictionaries')
  ctx.slots.inject(
    'conversation.composer.dock',
    () => ctx.slots.register({
      name: 'conversation.composer.dock',
      id: 'balance',
      order: 1,
      locale: NS,
    }, BalanceDock),
  )
}
