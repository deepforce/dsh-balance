/**
 * Composer-dock entry rendering the DeepSeek account balance under the
 * conversation stats line. Self-contained: it issues no RPC and declares no
 * props — the data arrives from the host's `/dsh-balance` route, fetched on
 * mount and on the manual refresh button. The API key never leaves the host.
 */
/** The stats-line companion: one balance readout with a manual refresh. */
export declare function BalanceDock(): import("react").JSX.Element;
