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
}
export declare const Config: z<Config>;
/**
 * Register `/balance` on the composed command registry.
 * @param ctx - context carrying the command registry.
 * @param config - validated plugin config.
 */
export declare function apply(ctx: Context, config: Config): void;
