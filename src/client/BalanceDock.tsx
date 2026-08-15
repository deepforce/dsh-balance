/**
 * Composer-dock entry rendering the DeepSeek account balance, the current
 * session's estimated spend, and a hover-revealed daily-spend bar chart with
 * axes. Balance and price tier arrive from the host's `/dsh-balance` route;
 * the session token usage rides the standard `tokenUsage` projection (the same
 * one the stats line's cache-hit figure uses); the chart fetches `/dsh-usage`.
 * Copy comes from the `balance` locale namespace, so it follows the active dsh
 * language. The API key never leaves the host.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

/** Compact axis tick: ¥0 / ¥1.5 / ¥27. */
function formatAxisTick(value: number): string {
  if (value === 0) return '¥0'
  if (value >= 100) return `¥${Math.round(value)}`
  if (value >= 10) return `¥${Math.round(value * 10) / 10}`
  return `¥${Math.round(value * 100) / 100}`
}

/** Compact token count: 517 / 12.3K / 1.2M. */
function formatTokens(value: number): string {
  if (value < 1_000) return String(value)
  if (value < 1_000_000) return `${Math.round(value / 100) / 10}K`
  return `${Math.round(value / 100_000) / 10}M`
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
  position: 'relative',
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

const USAGE_SUMMARY_STYLE: CSSProperties = {
  textDecoration: 'underline',
  textUnderlineOffset: 2,
  whiteSpace: 'nowrap',
}

const LINK_STYLE: CSSProperties = {
  color: 'inherit',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
}

/** Opaque bubble surface: hides the chat content underneath. */
const CHART_WRAP_STYLE: CSSProperties = {
  padding: '4px 8px',
  background: 'var(--dsw-surface, #1f2430)',
  border: '1px solid rgba(128,128,128,0.35)',
  borderRadius: 6,
  boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
}

/** The chart floats UP from the summary like a comic speech bubble. */
const CHART_POPOVER_STYLE: CSSProperties = {
  position: 'absolute',
  bottom: '100%',
  left: 0,
  marginBottom: 8,
  zIndex: 30,
}

/** The tail triangle pointing back at the summary, same opaque surface. */
const TAIL_STYLE: CSSProperties = {
  position: 'absolute',
  bottom: -7,
  width: 0,
  height: 0,
  borderLeft: '6px solid transparent',
  borderRight: '6px solid transparent',
  borderTop: '8px solid var(--dsw-surface, #1f2430)',
  filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.25))',
}

/** Props: the projection hook the runtime injects plus the locale seat. */
export interface BalanceDockProps {
  useProjection: UseProjection
  t: TranslateNS<'balance'>
}

/** The stats-line companion: balance readout, top-up link, session spend, and the hover chart. */
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

  // Hover-to-reveal: entering the summary opens the chart (loading it on
  // first use); leaving the whole dock closes it. Moving between the summary
  // and the chart stays inside ROOT, so the chart does not flicker.
  const summaryRef = useRef<HTMLSpanElement | null>(null)
  const [tailX, setTailX] = useState(24)
  const openChart = useCallback(() => {
    setUsageOpen(true)
    // Point the bubble tail at the summary's horizontal center.
    const el = summaryRef.current
    if (el !== null) setTailX(el.offsetLeft + el.offsetWidth / 2)
    if (state.kind === 'ok' && (chart.kind === 'idle' || chart.kind === 'error')) {
      loadChart(state.data.usageDays)
    }
  }, [state, chart.kind, loadChart])

  const closeChart = useCallback(() => setUsageOpen(false), [])

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
    <div style={ROOT_STYLE} onMouseLeave={closeChart}>
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
            <span
              ref={summaryRef}
              onMouseEnter={openChart}
              title={t('usage.title')}
              style={USAGE_SUMMARY_STYLE}
            >
              {usageOpen ? '▾ ' : '▸ '}{t('usage.summary', {
                days: state.data.usageDays,
                cost: chartTotal === null ? '…' : formatCny(chartTotal),
              })}
            </span>
          </>
        )}
      </div>
      {usageOpen && (
        <div style={CHART_POPOVER_STYLE}>
          <div style={CHART_WRAP_STYLE}>
            {chart.kind === 'loading' && <span>{t('usage.loading')}</span>}
            {chart.kind === 'error' && <Tooltip label={chart.message} side="top" delayMs={400}><span>{t('usage.error')}</span></Tooltip>}
            {chart.kind === 'ok' && (chart.days.length === 0
              ? <span>{t('usage.empty', { days: state.kind === 'ok' ? state.data.usageDays : '' })}</span>
              : <UsageBars days={chart.days} t={t} />)}
          </div>
          <div style={{ ...TAIL_STYLE, left: tailX - 6 }} aria-hidden />
        </div>
      )}
    </div>
  )
}

/**
 * A tiny dependency-free SVG bar chart of per-day spend: Y axis with grid
 * ticks, an X-axis date label per bar, and a comic-style speech bubble that
 * floats up from each bar on hover.
 */
function UsageBars({ days, t }: { days: DailyUsage[]; t: TranslateNS<'balance'> }) {
  const [hovered, setHovered] = useState<number | null>(null)
  // Top margin reserves room for the speech bubble above the tallest bar.
  const margin = { top: 40, right: 8, bottom: 18, left: 40 }
  const width = 320
  const height = 110
  const plotW = width - margin.left - margin.right
  const plotH = height - margin.top - margin.bottom
  const max = Math.max(...days.map((day) => day.cost), 0.01)
  const step = plotW / days.length
  const barW = Math.max(7, Math.min(24, step * 0.62))
  const ticks = [0, max / 2, max]
  const baseline = margin.top + plotH

  return (
    <svg width={width} height={height} role="img" aria-label={t('usage.title')}>
      {/* Y-axis grid lines and tick labels. */}
      {ticks.map((tick) => {
        const y = baseline - tick / max * plotH
        return (
          <g key={tick}>
            <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="rgba(128,128,128,0.18)" strokeDasharray="3 3" />
            <text x={margin.left - 5} y={y + 3} textAnchor="end" fontSize={9} fill="currentColor">{formatAxisTick(tick)}</text>
          </g>
        )
      })}
      {/* X-axis baseline. */}
      <line x1={margin.left} y1={baseline} x2={width - margin.right} y2={baseline} stroke="rgba(128,128,128,0.3)" />
      {days.map((day, index) => {
        const barH = Math.max(2, day.cost / max * plotH)
        const x = margin.left + index * step + (step - barW) / 2
        const y = baseline - barH
        const active = hovered === index
        return (
          <g key={day.date} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={2}
              fill={active ? 'var(--dsw-accent-strong, #7aa8ff)' : 'var(--dsw-accent, #4c8dff)'}
            />
            <text x={x + barW / 2} y={height - 5} textAnchor="middle" fontSize={8} fill="currentColor">
              {day.date.slice(5)}
            </text>
            {active && <SpeechBubble day={day} barX={x + barW / 2} barTop={y} width={width} t={t} />}
          </g>
        )
      })}
    </svg>
  )
}

/** A comic-style speech bubble floating above a bar, with a tail pointing at it. */
function SpeechBubble({
  day,
  barX,
  barTop,
  width,
  t,
}: {
  day: DailyUsage
  barX: number
  barTop: number
  width: number
  t: TranslateNS<'balance'>
}) {
  const tipW = 118
  const tipH = 34
  const tailH = 4
  const x = Math.min(Math.max(barX - tipW / 2, 0), width - tipW)
  const y = Math.max(1, barTop - tipH - tailH)
  const fill = 'var(--dsw-surface, #1f2430)'
  return (
    <g>
      {/* Tail triangle pointing at the bar top. */}
      <polygon
        points={`${barX - 5},${y + tipH} ${barX + 5},${y + tipH} ${barX},${barTop}`}
        fill={fill}
      />
      <rect x={x} y={y} width={tipW} height={tipH} rx={4} fill={fill} stroke="rgba(128,128,128,0.45)" />
      <text x={x + 6} y={y + 12} fontSize={9} fill="currentColor">
        {t('usage.bar', { date: day.date, cost: formatCny(day.cost) })}
      </text>
      <text x={x + 6} y={y + 25} fontSize={9} fill="currentColor">
        {t('usage.barDetail', {
          requests: String(day.requests),
          input: formatTokens(day.uncachedInput + day.cacheRead + day.cacheWrite),
          output: formatTokens(day.output),
        })}
      </text>
    </g>
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
