/**
 * Composer-dock entry rendering the DeepSeek account balance under the
 * conversation stats line. Self-contained: it issues no RPC and declares no
 * props — the data arrives from the host's `/dsh-balance` route, fetched on
 * mount and on the manual refresh button. The API key never leaves the host.
 */

import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'

/** One currency row from `GET /user/balance`. */
interface BalanceInfo {
  currency: string
  total_balance: string
  granted_balance: string
  topped_up_balance: string
}

/** Wire payload of the host's `/dsh-balance` route. */
interface BalanceResult {
  ok: boolean
  data?: { is_available: boolean; balance_infos: BalanceInfo[] }
  error?: string
}

/** Local readout state; only the component knows it (no shared store). */
type DockState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; currency: string; total: string; detail: string }

/** Map the well-known currency codes to symbols; fall back to the code itself. */
function symbolFor(currency: string): string {
  if (currency === 'CNY') return '¥'
  if (currency === 'USD') return '$'
  return `${currency} `
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

/** The stats-line companion: one balance readout with a manual refresh. */
export function BalanceDock() {
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
        const infos = result.data.balance_infos ?? []
        if (!result.data.is_available || infos.length === 0) {
          setState({ kind: 'ok', currency: '', total: '—', detail: 'DeepSeek balance unavailable' })
          return
        }
        const info = infos[0]
        const symbol = symbolFor(info.currency)
        setState({
          kind: 'ok',
          currency: symbol,
          total: info.total_balance,
          detail: `Topped up: ${symbol}${info.topped_up_balance} · Granted: ${symbol}${info.granted_balance}`,
        })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
      })
    return () => { cancelled = true }
  }, [refreshSeq])

  const content = state.kind === 'loading'
    ? <span>余额: …</span>
    : state.kind === 'error'
      ? (
        <Tooltip label={state.message} side="top" delayMs={400}>
          <span>余额: 不可用</span>
        </Tooltip>
      )
      : (
        <Tooltip label={state.detail} side="top" delayMs={400}>
          <span>余额: {state.currency}{state.total}</span>
        </Tooltip>
      )

  return (
    <div style={ROOT_STYLE}>
      {content}
      <button type="button" onClick={refresh} title="刷新余额" aria-label="刷新余额" style={BUTTON_STYLE}>⟳</button>
    </div>
  )
}
