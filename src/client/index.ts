/**
 * Browser half of dsh-balance: registers a composer-dock entry that renders
 * the DeepSeek account balance under the conversation stats line.
 *
 * @module @deepforce/dsh-balance/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: merges the conversation slot declarations into the SlotMap.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { BalanceDock } from './BalanceDock.tsx'

/** Required services: the slot registry (ui-slots platform module). */
export const inject = ['slots']

/**
 * Client plugin body: contribute the balance readout to the composer dock,
 * after the shipped stats line (`order: 1` follows its `order: 0`).
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject(
    'conversation.composer.dock',
    () => ctx.slots.register({
      name: 'conversation.composer.dock',
      id: 'balance',
      order: 1,
    }, BalanceDock),
  )
}
