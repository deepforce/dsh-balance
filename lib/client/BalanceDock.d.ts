/**
 * Composer-dock entry rendering the DeepSeek account balance, the current
 * session's estimated spend, and a click-to-expand daily-spend bar chart.
 * Balance and price tier arrive from the host's `/dsh-balance` route; the
 * session token usage rides the standard `tokenUsage` projection (the same one
 * the stats line's cache-hit figure uses); the chart fetches `/dsh-usage`.
 * Copy comes from the `balance` locale namespace, so it follows the active dsh
 * language. The API key never leaves the host.
 */
import type { UseProjection } from '@deepseek-ai/dsh-client-runtime/client';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
/** Props: the projection hook the runtime injects plus the locale seat. */
export interface BalanceDockProps {
    useProjection: UseProjection;
    t: TranslateNS<'balance'>;
}
/** The stats-line companion: balance readout, top-up link, session spend, and the daily chart. */
export declare function BalanceDock({ useProjection, t }: BalanceDockProps): import("react").JSX.Element;
