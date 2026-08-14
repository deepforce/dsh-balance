/**
 * Composer-dock entry rendering the DeepSeek account balance and the current
 * session's estimated spend under the conversation stats line. The balance and
 * price tier arrive from the host's `/dsh-balance` route; the session token
 * usage rides the standard `tokenUsage` projection (the same one the stats
 * line's cache-hit figure uses). The API key never leaves the host.
 */
import type { UseProjection } from '@deepseek-ai/dsh-client-runtime/client';
/** Props: the standard projection hook the runtime injects for session scope. */
export interface BalanceDockProps {
    useProjection: UseProjection;
}
/** The stats-line companion: balance readout, top-up link, and session spend. */
export declare function BalanceDock({ useProjection }: BalanceDockProps): import("react").JSX.Element;
