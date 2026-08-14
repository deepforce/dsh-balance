/**
 * Browser half of dsh-balance: registers a composer-dock entry that renders
 * the DeepSeek account balance under the conversation stats line, with
 * locale-aware copy following the active dsh language.
 *
 * @module @deepforce/dsh-balance/client
 */
import { BalanceDock } from "./BalanceDock.js";
import { en, NS, zh } from "./locales.js";
/** Required services: the slot registry and the locale dictionary registry. */
export const inject = ['slots', 'locale'];
/**
 * Client plugin body: register the dictionaries and contribute the balance
 * readout to the composer dock, after the shipped stats line (`order: 1`
 * follows its `order: 0`).
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-balance: dictionaries');
    ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
        name: 'conversation.composer.dock',
        id: 'balance',
        order: 1,
        locale: NS,
    }, BalanceDock));
}
