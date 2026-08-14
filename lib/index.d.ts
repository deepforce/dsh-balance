/**
 * Human-facing `/balance` command that queries the DeepSeek account balance.
 *
 * A single-function Cordis plugin: it injects the `commands` service, then
 * registers one slash command whose handler resolves the API key through the
 * optional credential seam (`ctx.credentials`, falling back to the launching
 * environment) and calls DeepSeek's `GET /user/balance`. The key never appears
 * in configuration or in the text returned to the UI.
 *
 * @module @deepforce/dsh-balance
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** Cordis plugin name used by loader diagnostics. */
export declare const name = "dsh-balance";
/** Services this plugin requires before it loads. */
export declare const inject: string[];
/**
 * Plugin config, validated by the same-named schemastery schema. Every field
 * is optional in yml: a missing API key is resolved per invocation from the
 * credential seam or the launching environment.
 */
export interface Config {
    /** Credential reference (environment-variable name) resolved per call. */
    apiKeyEnv?: string;
    /** Endpoint base; defaults to the public DeepSeek API. */
    baseURL?: string;
    /** Per-request timeout in milliseconds. */
    timeoutMs?: number;
    /** Default model used for the session-cost estimate. */
    estimateModel?: string;
    /** Off-peak per-million-token CNY prices: uncached input, cache hit, output. */
    offpeakPrices?: {
        input: number;
        cacheHit: number;
        output: number;
    };
    /** Peak-hour multiplier over the off-peak prices (DeepSeek peak = 2×). */
    peakMultiplier?: number;
    /** Beijing-time peak windows as [startHour, endHour) pairs. */
    peakWindows?: number[][];
    /** DeepSeek platform top-up page the web readout links to. */
    topUpUrl?: string;
    /** Default historical window (in days) for the daily-spend chart. */
    usageDays?: number;
}
/** One resolved per-million-token price tier for the estimate model. */
export interface TierPricing {
    /** Peak or off-peak tier selected by the current Beijing time. */
    tier: 'peak' | 'offpeak';
    /** Per-million-token CNY prices in effect for that tier. */
    perMillion: {
        input: number;
        cacheHit: number;
        output: number;
    };
}
export declare const Config: z<Config>;
/** One day's aggregated provider usage and estimated spend. */
export interface DailyUsage {
    /** Local calendar date `YYYY-MM-DD`. */
    date: string;
    /** Assistant completions that reported usage. */
    requests: number;
    uncachedInput: number;
    cacheRead: number;
    cacheWrite: number;
    output: number;
    /** Estimated CNY spend for that day (each request priced at its own tier). */
    cost: number;
}
/**
 * Register `/balance` on the composed command registry and the `/dsh-balance`
 * and `/dsh-usage` web routes on the optional web server.
 * @param ctx - context carrying the command registry.
 * @param config - validated plugin config.
 */
export declare function apply(ctx: Context, config: Config): void;
