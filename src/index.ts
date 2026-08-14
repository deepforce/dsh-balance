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

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
// Type-only: merges the optional ctx.webServer declaration and the service type.
import type WebServer from '@deepseek-ai/dsh-host-webserver'
import z from '@deepseek-ai/schemastery'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'dsh-balance'

/** Services this plugin requires before it loads. */
export const inject = ['commands']

const DEFAULT_API_KEY_ENV = 'DEEPSEEK_API_KEY'
const DEFAULT_BASE_URL = 'https://api.deepseek.com'
const DEFAULT_TIMEOUT_MS = 10_000

/**
 * Plugin config, validated by the same-named schemastery schema. Every field
 * is optional in yml: a missing API key is resolved per invocation from the
 * credential seam or the launching environment.
 */
export interface Config {
  /** Credential reference (environment-variable name) resolved per call. */
  apiKeyEnv?: string
  /** Endpoint base; defaults to the public DeepSeek API. */
  baseURL?: string
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number
}

export const Config: z<Config> = z.object({
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV),
  baseURL: z.string().default(DEFAULT_BASE_URL),
  timeoutMs: z.number().step(1).min(1).default(DEFAULT_TIMEOUT_MS),
})

/** One currency row from `GET /user/balance`. */
interface BalanceInfo {
  currency: string
  total_balance: string
  granted_balance: string
  topped_up_balance: string
}

/** Response body of DeepSeek's balance endpoint. */
interface BalanceResponse {
  is_available: boolean
  balance_infos: BalanceInfo[]
}

/** Resolve the key once per invocation: the credential seam first, then the environment. */
async function resolveApiKey(ctx: Context, apiKeyEnv: string): Promise<string> {
  const credentials = ctx.get('credentials')
  if (credentials !== undefined) {
    const hit = await credentials.resolve(credentialRef(apiKeyEnv))
    if (hit !== undefined && hit.value.length > 0) return hit.value
  }
  const ambient = process.env[apiKeyEnv]
  if (ambient !== undefined && ambient.length > 0) return ambient
  throw new Error(
    `no API key: store ${apiKeyEnv} through the credentials service (the Web Models page writes it), `
    + `or export ${apiKeyEnv} in the launching environment`,
  )
}

/** Fetch the balance, aborting on the command signal or the timeout. */
async function fetchBalance(
  baseURL: string,
  apiKey: string,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<BalanceResponse> {
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(new Error(`balance request timed out after ${timeoutMs} ms`)),
    timeoutMs,
  )
  const onAbort = (): void => controller.abort(signal.reason)
  signal.addEventListener('abort', onAbort, { once: true })
  try {
    const response = await fetch(`${baseURL.replace(/\/+$/, '')}/user/balance`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(
        `balance request failed with HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
      )
    }
    return await response.json() as BalanceResponse
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', onAbort)
  }
}

/** Render balance rows as a concise, key-free human result. */
function render(balance: BalanceResponse): CommandResult {
  if (!balance.is_available) {
    return { kind: 'success', text: 'DeepSeek balance is currently unavailable.' }
  }
  const infos = balance.balance_infos
  if (!Array.isArray(infos) || infos.length === 0) {
    return { kind: 'success', text: 'No balance information returned.' }
  }
  const text = infos.map((info) => [
    `Balance (${info.currency}): ${info.total_balance}`,
    `  Topped up: ${info.topped_up_balance}`,
    `  Granted:   ${info.granted_balance}`,
  ].join('\n')).join('\n\n')
  return { kind: 'success', text }
}

/**
 * One `/dsh-balance` request handler: resolve the key on the host, fetch the
 * balance, and answer JSON. The browser only ever receives the public figures.
 * @param ctx - plugin context (credential seam + environment fallback).
 * @param config - resolved plugin config.
 * @returns the route handler.
 */
function balanceRouteHandler(
  ctx: Context,
  config: Config,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    try {
      const apiKey = await resolveApiKey(ctx, config.apiKeyEnv ?? DEFAULT_API_KEY_ENV)
      const balance = await fetchBalance(
        config.baseURL ?? DEFAULT_BASE_URL,
        apiKey,
        config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        new AbortController().signal,
      )
      res.end(JSON.stringify({ ok: true, data: balance }))
    } catch (error: unknown) {
      res.end(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }))
    }
  }
}

/**
 * Register `/balance` on the composed command registry and the `/dsh-balance`
 * web route on the optional web server.
 * @param ctx - context carrying the command registry.
 * @param config - validated plugin config.
 */
export function apply(ctx: Context, config: Config): void {
  // Browser-facing balance readout: the web GUI's composer dock fetches this
  // route on mount and on manual refresh. The webServer service may be
  // provided AFTER this plugin activates (bundle row order does not decide
  // activation order), so register on first sight: directly when already
  // present, otherwise through the internal/service binding event.
  ctx.effect(() => {
    const register = (server: WebServer): (() => void) => server.register({
      kind: 'exact',
      path: '/dsh-balance',
      handler: balanceRouteHandler(ctx, config),
    })
    const present = ctx.get('webServer')
    if (present !== undefined) return register(present)
    const disposers: (() => void)[] = []
    let registered = false
    const off = ctx.on('internal/service', (name, value) => {
      // Notify fires on every service (re)binding; register exactly once.
      if (name !== 'webServer' || registered) return
      registered = true
      disposers.push(register(value as WebServer))
    })
    return () => {
      off()
      for (const disposer of disposers) disposer()
    }
  }, 'dsh-balance: web route')

  ctx.effect(function* () {
    yield ctx.commands.register({
      name: 'balance',
      description: 'Query the DeepSeek account balance',
      recordInput: false,
      handler: async (invocation: CommandInvocation): Promise<CommandResult> => {
        try {
          const apiKey = await resolveApiKey(ctx, config.apiKeyEnv ?? DEFAULT_API_KEY_ENV)
          const balance = await fetchBalance(
            config.baseURL ?? DEFAULT_BASE_URL,
            apiKey,
            config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            invocation.signal,
          )
          return render(balance)
        } catch (error: unknown) {
          if (invocation.signal.aborted) {
            return { kind: 'error', text: 'Balance request cancelled.' }
          }
          return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
        }
      },
    })
  }, 'dsh-balance lifecycle')
}
