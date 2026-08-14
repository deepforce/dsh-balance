/**
 * Composer-dock entry rendering the DeepSeek account balance, the current
 * session's estimated spend, and a click-to-expand daily-spend bar chart.
 * Balance and price tier arrive from the host's `/dsh-balance` route; the
 * session token usage rides the standard `tokenUsage` projection (the same one
 * the stats line's cache-hit figure uses); the chart fetches `/dsh-usage`.
 * Copy comes from the `balance` locale namespace, so it follows the active dsh
 * language. The API key never leaves the host.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { UseProjection } from '@deepseek-ai/dsh-client-runtime/client'
import type { TokenUsageProjection } from '@deepseek-ai/dsh-token-meter/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { BalanceKey } from './locales.ts'

/** One currency row from `GET /user/balance`. */
interface BalanceInfo {
  currency: string
  total_balance: string
  granted_balance: string
  topped_up_balance: string
}

/** Price tier in effect, in CNY per million tokens. */
interface TierPricing {
  tier: 'peak' | 'offpeak'
  perMillion: { input: number; cacheHit: number; output: number }
}

/** Balance payload plus the estimate facts the host computed. */
interface BalanceData {
  is_available: boolean
  balance_infos: BalanceInfo[]
  pricing: TierPricing
  topUpUrl: string
  usageDays: number
}

/** Wire payload of the host's `/dsh-balance` route. */
interface BalanceResult {
  ok: boolean
  data?: BalanceData
  error?: string
}

/** One day's aggregated spend from the `/dsh-usage` route. */
interface DailyUsage {
  date: string
  requests: number
  uncachedInput: number
  cacheRead: number
  cacheWrite: number
  output: number
  cost: number
}

/** Wire payload of the host's `/dsh-usage` route. */
interface UsageResult {
  ok: boolean
  data?: { days: DailyUsage[]; model: string }
  error?: string
}

/** Local readout state; only the component knows it (no shared store). */
type DockState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; data: BalanceData }

/** Chart data state; only the component knows it. */
type UsageState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; days: DailyUsage[] }

/** Map the well-known currency codes to symbols; fall back to the code itself. */
function symbolFor(currency: string): string {
  if (currency === 'CNY') return '¥'
  if (currency === 'USD') return '$'
  return `${currency} `
}

/** Compact CNY amount: two decimals below ¥1000, else one. */
function formatCny(value: number): string {
  if (value >= 1000) return `¥${Math.round(value)}`
  return `¥${value.toFixed(2)}`
}

/** Per-token price from the per-million figures. */
function perToken(perMillion: number): number {
  return perMillion / 1_000_000
}

const ROOT_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 4,
  fontSize: 12,
  color: 'var(--dsw-text-secondary, #8a8f98)',
}

const ROW_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

const BUTTON_STYLE: CSSProperties = {
  border: 'none',
  background: 'none',
  padding: 0,
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: 1,
  color: 'inherit',
  opacity: 0.7,
}

const USAGE_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  opacity: 1,
  textDecoration: 'underline',
  textUnderlineOffset: 2,
}

const LINK_STYLE: CSSProperties = {
  color: 'inherit',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
}

const CHART_WRAP_STYLE: CSSProperties = {
  padding: '4px 8px',
  background: 'var(--dsw-surface-secondary, rgba(0,0,0,0.03))',
  borderRadius: 6,
}

/** Props: the projection hook the runtime injects plus the locale seat. */
export interface BalanceDockProps {
  useProjection: UseProjection
  t: TranslateNS<'balance'>
}

/** The stats-line companion: balance readout, top-up link, session spend, and the daily chart. */
export function BalanceDock({ useProjection, t }: BalanceDockProps) {
  const usage = useProjection('tokenUsage')
  const [state, setState] = useState<DockState>({ kind: 'loading' })
  const [refreshSeq, setRefreshSeq] = useState(0)
  const refresh = useCallback(() => setRefreshSeq((seq) => seq + 1), [])
  const [usageOpen, setUsageOpen] = useState(false)
  const [chart, setChart] = useState<UsageState>({ kind: 'idle' })

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    fetch('/dsh-balance', { headers: { accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<BalanceResult>
      })
      .then((result) => {
        if (cancelled) return
        if (!result.ok || result.data === undefined) {
          setState({ kind: 'error', message: result.error ?? 'unknown error' })
          return
        }
        setState({ kind: 'ok', data: result.data })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
      })
    return () => { cancelled = true }
  }, [refreshSeq])

  const loadChart = useCallback((days: number) => {
    setChart({ kind: 'loading' })
    fetch(`/dsh-usage?days=${days}`, { headers: { accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<UsageResult>
      })
      .then((result) => {
        if (!result.ok || result.data === undefined) {
          setChart({ kind: 'error', message: result.error ?? 'unknown error' })
          return
        }
        setChart({ kind: 'ok', days: result.data.days })
      })
      .catch((error: unknown) => {
        setChart({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
      })
  }, [])

  const toggleChart = useCallback(() => {
    setUsageOpen((open) => {
      const next = !open
      if (next && state.kind === 'ok' && (chart.kind === 'idle' || chart.kind === 'error')) {
        loadChart(state.data.usageDays)
      }
      return next
    })
  }, [state, chart.kind, loadChart])

  // Estimated session spend: the token buckets priced at the host-selected
  // tier. Cache-write tokens are unpriced by DeepSeek's published table, so
  // they contribute nothing. The model is the host's configured estimateModel.
  const cost = useMemo(() => {
    if (state.kind !== 'ok' || usage === undefined) return null
    const p = state.data.pricing.perMillion
    const tokens =
      usage.uncachedInputTokens * perToken(p.input)
      + usage.cacheReadTokens * perToken(p.cacheHit)
      + usage.outputTokens * perToken(p.output)
    return tokens
  }, [state, usage])

  const chartTotal = useMemo(
    () => chart.kind === 'ok' ? chart.days.reduce((sum, day) => sum + day.cost, 0) : null,
    [chart],
  )

  const balanceText = state.kind === 'loading'
    ? <span>{t('balance.loading')}</span>
    : state.kind === 'error'
      ? <Tooltip label={state.message} side="top" delayMs={400}><span>{t('balance.unavailable')}</span></Tooltip>
      : (
        <Tooltip label={balanceDetail(state.data, t)} side="top" delayMs={400}>
          <span>{t('balance.label', { total: balanceTotal(state.data, t) })}</span>
        </Tooltip>
      )

  return (
    <div style={ROOT_STYLE}>
      <div style={ROW_STYLE}>
        {balanceText}
        {state.kind === 'ok' && (
          <>
            <a href={state.data.topUpUrl} target="_blank" rel="noreferrer" style={LINK_STYLE}>{t('balance.topUp')}</a>
            <button type="button" onClick={refresh} title={t('balance.refresh')} aria-label={t('balance.refresh')} style={BUTTON_STYLE}>⟳</button>
            {cost !== null && usage !== undefined && (
              <Tooltip label={costDetail(usage, state.data.pricing, t)} side="top" delayMs={400}>
                <span>{t('cost.label', { cost: formatCny(cost) })}</span>
              </Tooltip>
            )}
            <button
              type="button"
              onClick={toggleChart}
              title={t('usage.title')}
              aria-expanded={usageOpen}
              style={USAGE_BUTTON_STYLE}
            >
              {usageOpen ? '▾ ' : '▸ '}{t('usage.summary', {
                days: state.data.usageDays,
                cost: chartTotal === null ? '…' : formatCny(chartTotal),
              })}
            </button>
          </>
        )}
      </div>
      {usageOpen && (
        <div style={CHART_WRAP_STYLE}>
          {chart.kind === 'loading' && <span>{t('usage.loading')}</span>}
          {chart.kind === 'error' && <Tooltip label={chart.message} side="top" delayMs={400}><span>{t('usage.error')}</span></Tooltip>}
          {chart.kind === 'ok' && (chart.days.length === 0
            ? <span>{t('usage.empty', { days: state.kind === 'ok' ? state.data.usageDays : '' })}</span>
            : <UsageBars days={chart.days} t={t} />)}
        </div>
      )}
    </div>
  )
}

/** A tiny dependency-free SVG bar chart of per-day spend. */
function UsageBars({ days, t }: { days: DailyUsage[]; t: TranslateNS<'balance'> }) {
  const width = 300
  const height = 60
  const baseline = height - 8
  const max = Math.max(...days.map((day) => day.cost), 0.01)
  const barW = Math.max(8, Math.min(26, width / days.length - 4))
  return (
    <svg width={width} height={height} role="img" aria-label={t('usage.title')}>
      {days.map((day, index) => {
        const barH = Math.max(2, day.cost / max * (baseline - 4))
        const x = index * (barW + 4)
        return (
          <rect
            key={day.date}
            x={x}
            y={baseline - barH}
            width={barW}
            height={barH}
            rx={2}
            fill="var(--dsw-accent, #4c8dff)"
          >
            <title>{t('usage.day', { date: day.date, cost: formatCny(day.cost) })}</title>
          </rect>
        )
      })}
    </svg>
  )
}

/** Render the first balance row compactly, or an unavailable marker. */
function balanceTotal(data: BalanceData, t: TranslateNS<'balance'>): string {
  const info = data.balance_infos?.[0]
  if (!data.is_available || info === undefined) return t('balance.none')
  return `${symbolFor(info.currency)}${info.total_balance}`
}

/** Hover detail: topped-up and granted for every reported currency. */
function balanceDetail(data: BalanceData, t: TranslateNS<'balance'>): string {
  const rows = (data.balance_infos ?? []).map((info) =>
    t('balance.detail', {
      symbol: symbolFor(info.currency),
      total: info.total_balance,
      toppedUp: info.topped_up_balance,
      granted: info.granted_balance,
    }),
  )
  return rows.length > 0 ? rows.join(' / ') : t('balance.detail.unavailable')
}

/** Hover detail for the spend figure: token buckets times the active tier. */
function costDetail(
  usage: TokenUsageProjection,
  pricing: TierPricing,
  t: TranslateNS<'balance'>,
): string {
  const p = pricing.perMillion
  const tierKey: BalanceKey = pricing.tier === 'peak' ? 'tier.peak' : 'tier.offpeak'
  return [
    t('cost.detail.input', { tokens: String(usage.uncachedInputTokens), price: p.input }),
    t('cost.detail.cacheHit', { tokens: String(usage.cacheReadTokens), price: p.cacheHit }),
    t('cost.detail.output', { tokens: String(usage.outputTokens), price: p.output }),
    t('cost.detail.tier', { tier: t(tierKey) }),
  ].join(' · ')
}
