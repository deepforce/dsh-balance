/**
 * Human-facing `/balance` command that queries the DeepSeek account balance.
 *
 * A single-function Cordis plugin: it injects the `commands` service, then
 * registers one slash command whose handler resolves the API key through the
 * optional credential seam (`ctx.credentials`, falling back to the launching
 * environment) and calls DeepSeek's `GET /user/balance`. The key never appears
 * in configuration or in the text returned to the UI.
 *
 * Reload probe: this line changes the compiled lib/ artifact so upgrading the
 * plugin can be observed end-to-end through dsh-plugin-reloader's hot reload.
 *
 * @module @deepforce/dsh-balance
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
// Type-only: merges the optional ctx.webServer declaration and the service type.
import type WebServer from '@deepseek-ai/dsh-host-webserver'
// Type-only: merges the optional ctx.sessionPersistence declaration.
import type {} from '@deepseek-ai/dsh-session-persistence'
import z from '@deepseek-ai/schemastery'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'dsh-balance'

/** Services this plugin requires before it loads. */
export const inject = ['commands']

const DEFAULT_API_KEY_ENV = 'DEEPSEEK_API_KEY'
const DEFAULT_BASE_URL = 'https://api.deepseek.com'
const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_ESTIMATE_MODEL = 'deepseek-v4-flash'
const DEFAULT_TOP_UP_URL = 'https://platform.deepseek.com/top_up'
/** DeepSeek official off-peak per-million-token CNY prices (from 2026-08-17). */
const DEFAULT_OFFPEAK_PRICES = { input: 1.5, cacheHit: 0.05, output: 4.5 } as const
const DEFAULT_PEAK_MULTIPLIER = 2
/** Beijing-time peak windows (peak = off-peak × multiplier). */
const DEFAULT_PEAK_WINDOWS: readonly (readonly [number, number])[] = [[9, 12], [14, 18]]
const DEFAULT_USAGE_DAYS = 7

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
  /** Default model used for the session-cost estimate. */
  estimateModel?: string
  /** Off-peak per-million-token CNY prices: uncached input, cache hit, output. */
  offpeakPrices?: { input: number; cacheHit: number; output: number }
  /** Peak-hour multiplier over the off-peak prices (DeepSeek peak = 2×). */
  peakMultiplier?: number
  /** Beijing-time peak windows as [startHour, endHour) pairs. */
  peakWindows?: number[][]
  /** DeepSeek platform top-up page the web readout links to. */
  topUpUrl?: string
  /** Default historical window (in days) for the daily-spend chart. */
  usageDays?: number
}

/** One resolved per-million-token price tier for the estimate model. */
export interface TierPricing {
  /** Peak or off-peak tier selected by the current Beijing time. */
  tier: 'peak' | 'offpeak'
  /** Per-million-token CNY prices in effect for that tier. */
  perMillion: { input: number; cacheHit: number; output: number }
}

/** Resolve optional config fields to their effective values. */
function resolveConfig(config: Config) {
  return {
    apiKeyEnv: config.apiKeyEnv ?? DEFAULT_API_KEY_ENV,
    baseURL: config.baseURL ?? DEFAULT_BASE_URL,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    estimateModel: config.estimateModel ?? DEFAULT_ESTIMATE_MODEL,
    offpeakPrices: config.offpeakPrices ?? { ...DEFAULT_OFFPEAK_PRICES },
    peakMultiplier: config.peakMultiplier ?? DEFAULT_PEAK_MULTIPLIER,
    peakWindows: normalizeWindows(config.peakWindows),
    topUpUrl: config.topUpUrl ?? DEFAULT_TOP_UP_URL,
    usageDays: config.usageDays ?? DEFAULT_USAGE_DAYS,
  }
}

/** Validate and normalize configured peak windows to [startHour, endHour) pairs. */
function normalizeWindows(
  windows: number[][] | undefined,
): readonly (readonly [number, number])[] {
  if (windows === undefined) return DEFAULT_PEAK_WINDOWS
  for (const window of windows) {
    const [start, end] = window
    if (window.length !== 2 || !Number.isInteger(start) || !Number.isInteger(end)
      || start < 0 || start >= 24 || end < 0 || end >= 24 || start >= end) {
      throw new Error(
        `dsh-balance: invalid peakWindows entry [${window.join(', ')}]; `
        + 'expected [startHour, endHour) with integers in [0, 24) and start < end',
      )
    }
  }
  return windows as unknown as readonly (readonly [number, number])[]
}

/** Current hour in Beijing time (UTC+8; China observes no DST). */
function beijingHour(date: Date): number {
  return (date.getUTCHours() + 8) % 24
}

/** Whether `hour` falls inside any [start, end) window. */
function inWindows(hour: number, windows: readonly (readonly [number, number])[]): boolean {
  return windows.some(([start, end]) => hour >= start && hour < end)
}

/** Select the price tier in effect at the given time (defaults to now). */
function resolvePricing(config: Config, at: Date = new Date()): TierPricing {
  const resolved = resolveConfig(config)
  const peak = inWindows(beijingHour(at), resolved.peakWindows)
  const multiplier = peak ? resolved.peakMultiplier : 1
  return {
    tier: peak ? 'peak' : 'offpeak',
    perMillion: {
      input: resolved.offpeakPrices.input * multiplier,
      cacheHit: resolved.offpeakPrices.cacheHit * multiplier,
      output: resolved.offpeakPrices.output * multiplier,
    },
  }
}

export const Config: z<Config> = z.object({
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV),
  baseURL: z.string().default(DEFAULT_BASE_URL),
  timeoutMs: z.number().step(1).min(1).default(DEFAULT_TIMEOUT_MS),
  estimateModel: z.string().default(DEFAULT_ESTIMATE_MODEL),
  offpeakPrices: z.object({
    input: z.number().min(0).default(DEFAULT_OFFPEAK_PRICES.input),
    cacheHit: z.number().min(0).default(DEFAULT_OFFPEAK_PRICES.cacheHit),
    output: z.number().min(0).default(DEFAULT_OFFPEAK_PRICES.output),
  }).default({ ...DEFAULT_OFFPEAK_PRICES }),
  peakMultiplier: z.number().min(1).default(DEFAULT_PEAK_MULTIPLIER),
  peakWindows: z.array(z.array(z.number())).default([[9, 12], [14, 18]] as unknown as number[][]),
  topUpUrl: z.string().default(DEFAULT_TOP_UP_URL),
  usageDays: z.number().step(1).min(1).max(365).default(DEFAULT_USAGE_DAYS),
})

/** One day's aggregated provider usage and estimated spend. */
export interface DailyUsage {
  /** Local calendar date `YYYY-MM-DD`. */
  date: string
  /** Assistant completions that reported usage. */
  requests: number
  uncachedInput: number
  cacheRead: number
  cacheWrite: number
  output: number
  /** Estimated CNY spend for that day (each request priced at its own tier). */
  cost: number
}

/** Local calendar date (YYYY-MM-DD) for a timestamp, in the host's timezone. */
function localDate(ms: number): string {
  const d = new Date(ms)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** Parse and validate the `days` query parameter (1–365). */
function parseDays(value: string | null, fallback: number): number {
  if (value === null) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
    throw new Error(`invalid days "${value}"; expected an integer in [1, 365]`)
  }
  return parsed
}

/** Aggregate provider usage across sessions created within the last `days`, by local date. */
async function queryDailyUsage(ctx: Context, config: Config, days: number): Promise<DailyUsage[]> {
  const persistence = ctx.get('sessionPersistence')
  if (persistence === undefined) {
    throw new Error('session persistence is not configured; cannot read historical usage')
  }
  const cutoff = Date.now() - days * 86_400_000
  const headers = await persistence.list()
  const perDay = new Map<string, DailyUsage>()
  for (const header of headers) {
    if (header.createdAt < cutoff) continue
    const { events } = await persistence.inspect(header.id)
    for (const event of events) {
      if (event.type !== 'assistant/message' || event.data.usage === undefined) continue
      const usage = event.data.usage
      const date = localDate(event.time)
      const entry = perDay.get(date) ?? {
        date, requests: 0, uncachedInput: 0, cacheRead: 0, cacheWrite: 0, output: 0, cost: 0,
      }
      // Each request is priced at the tier in effect at ITS own time, so a day
      // that straddles a peak window still gets an accurate split.
      const p = resolvePricing(config, new Date(event.time)).perMillion
      entry.requests += 1
      entry.uncachedInput += usage.inputTokens
      entry.cacheRead += usage.cacheReadTokens ?? 0
      entry.cacheWrite += usage.cacheWriteTokens ?? 0
      entry.output += usage.outputTokens
      entry.cost += (
        usage.inputTokens * p.input
        + (usage.cacheReadTokens ?? 0) * p.cacheHit
        + usage.outputTokens * p.output
      ) / 1_000_000
      perDay.set(entry.date, entry)
    }
  }
  return [...perDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
}

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
  const resolved = resolveConfig(config)
  return async (_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    try {
      const apiKey = await resolveApiKey(ctx, resolved.apiKeyEnv)
      const balance = await fetchBalance(
        resolved.baseURL,
        apiKey,
        resolved.timeoutMs,
        new AbortController().signal,
      )
      const pricing = resolvePricing(config)
      res.end(JSON.stringify({
        ok: true,
        data: {
          ...balance,
          pricing: {
            model: resolved.estimateModel,
            tier: pricing.tier,
            perMillion: pricing.perMillion,
          },
          topUpUrl: resolved.topUpUrl,
          usageDays: resolved.usageDays,
        },
      }))
    } catch (error: unknown) {
      res.end(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }))
    }
  }
}

/**
 * One `/dsh-usage` request handler: aggregate provider usage over the last
 * `days` (query param or config default) and answer JSON.
 * @param ctx - plugin context (session persistence seam).
 * @param config - resolved plugin config.
 * @returns the route handler.
 */
function usageRouteHandler(
  ctx: Context,
  config: Config,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const resolved = resolveConfig(config)
  return async (req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    try {
      const url = new URL(req.url ?? '/', 'http://x')
      const days = parseDays(url.searchParams.get('days'), resolved.usageDays)
      const daysReport = await queryDailyUsage(ctx, config, days)
      res.end(JSON.stringify({
        ok: true,
        data: {
          days: daysReport,
          model: resolved.estimateModel,
        },
      }))
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
 * and `/dsh-usage` web routes on the optional web server.
 * @param ctx - context carrying the command registry.
 * @param config - validated plugin config.
 */
export function apply(ctx: Context, config: Config): void {
  // Browser-facing readouts: the web GUI's composer dock fetches these routes
  // on mount and on manual refresh. The webServer service may be provided
  // AFTER this plugin activates (bundle row order does not decide activation
  // order), so register on first sight: directly when already present,
  // otherwise through the internal/service binding event.
  ctx.effect(() => {
    const register = (server: WebServer): (() => void) => {
      const disposers = [
        server.register({
          kind: 'exact',
          path: '/dsh-balance',
          handler: balanceRouteHandler(ctx, config),
        }),
        server.register({
          kind: 'exact',
          path: '/dsh-usage',
          handler: usageRouteHandler(ctx, config),
        }),
      ]
      return () => { for (const disposer of disposers) disposer() }
    }
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
