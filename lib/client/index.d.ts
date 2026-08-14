/**
 * Browser half of dsh-balance: registers a composer-dock entry that renders
 * the DeepSeek account balance under the conversation stats line, with
 * locale-aware copy following the active dsh language.
 *
 * @module @deepforce/dsh-balance/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type BalanceKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Balance readout copy. */
        'balance': BalanceKey;
    }
}
/** Required services: the slot registry and the locale dictionary registry. */
export declare const inject: string[];
/**
 * Client plugin body: register the dictionaries and contribute the balance
 * readout to the composer dock, after the shipped stats line (`order: 1`
 * follows its `order: 0`).
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
