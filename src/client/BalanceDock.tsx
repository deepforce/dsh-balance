/**
 * Composer-dock entry rendering the DeepSeek account balance and the current
 * session's estimated spend under the conversation stats line. The balance and
 * price tier arrive from the host's `/dsh-balance` route; the session token
 * usage rides the standard `tokenUsage` projection (the same one the stats
 * line's cache-hit figure uses). The API key never leaves the host.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { UseProjection } from '@deepseek-ai/dsh-client-runtime/client'
import type { TokenUsageProjection } from '@deepseek-ai/dsh-token-meter/client'

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
}

/** Wire payload of the host's `/dsh-balance` route. */
interface BalanceResult {
  ok: boolean
  data?: BalanceData
  error?: string
}

/** Local readout state; only the component knows it (no shared store). */
type DockState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; data: BalanceData }

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
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  color: 'var(--dsw-text-secondary, #8a8f98)',
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

const LINK_STYLE: CSSProperties = {
  color: 'inherit',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
}

/** Props: the standard projection hook the runtime injects for session scope. */
export interface BalanceDockProps {
  useProjection: UseProjection
}

/** The stats-line companion: balance readout, top-up link, and session spend. */
export function BalanceDock({ useProjection }: BalanceDockProps) {
  const usage = useProjection('tokenUsage')
  const [state, setState] = useState<DockState>({ kind: 'loading' })
  const [refreshSeq, setRefreshSeq] = useState(0)
  const refresh = useCallback(() => setRefreshSeq((seq) => seq + 1), [])

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

  const balanceText = state.kind === 'loading'
    ? <span>余额: …</span>
    : state.kind === 'error'
      ? <Tooltip label={state.message} side="top" delayMs={400}><span>余额: 不可用</span></Tooltip>
      : (
        <Tooltip label={balanceDetail(state.data)} side="top" delayMs={400}>
          <span>余额: {balanceTotal(state.data)}</span>
        </Tooltip>
      )

  return (
    <div style={ROOT_STYLE}>
      {balanceText}
      {state.kind === 'ok' && (
        <>
          <a href={state.data.topUpUrl} target="_blank" rel="noreferrer" style={LINK_STYLE}>充值</a>
          <button type="button" onClick={refresh} title="刷新余额" aria-label="刷新余额" style={BUTTON_STYLE}>⟳</button>
          {cost !== null && usage !== undefined && (
            <Tooltip label={costDetail(usage, state.data.pricing)} side="top" delayMs={400}>
              <span>本会话 ≈ {formatCny(cost)}</span>
            </Tooltip>
          )}
        </>
      )}
    </div>
  )
}

/** Render the first balance row compactly, or an unavailable marker. */
function balanceTotal(data: BalanceData): string {
  const info = data.balance_infos?.[0]
  if (!data.is_available || info === undefined) return '—'
  return `${symbolFor(info.currency)}${info.total_balance}`
}

/** Hover detail: topped-up and granted for every reported currency. */
function balanceDetail(data: BalanceData): string {
  const rows = (data.balance_infos ?? []).map((info) =>
    `${symbolFor(info.currency)}${info.total_balance} · 充值 ${symbolFor(info.currency)}${info.topped_up_balance} · 赠送 ${symbolFor(info.currency)}${info.granted_balance}`,
  )
  return rows.length > 0 ? rows.join(' / ') : 'DeepSeek balance unavailable'
}

/** Hover detail for the spend figure: token buckets times the active tier. */
function costDetail(usage: TokenUsageProjection, pricing: TierPricing): string {
  const p = pricing.perMillion
  return [
    `输入 ${usage.uncachedInputTokens} × ¥${p.input}/M`,
    `缓存命中 ${usage.cacheReadTokens} × ¥${p.cacheHit}/M`,
    `输出 ${usage.outputTokens} × ¥${p.output}/M`,
    `时段: ${pricing.tier === 'peak' ? '高峰' : '空闲'}`,
  ].join(' · ')
}
