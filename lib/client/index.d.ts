/**
 * Browser half of dsh-balance: registers a composer-dock entry that renders
 * the DeepSeek account balance under the conversation stats line.
 *
 * @module @deepforce/dsh-balance/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
/** Required services: the slot registry (ui-slots platform module). */
export declare const inject: string[];
/**
 * Client plugin body: contribute the balance readout to the composer dock,
 * after the shipped stats line (`order: 1` follows its `order: 0`).
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
