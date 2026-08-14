import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Composer-dock entry rendering the DeepSeek account balance under the
 * conversation stats line. Self-contained: it issues no RPC and declares no
 * props — the data arrives from the host's `/dsh-balance` route, fetched on
 * mount and on the manual refresh button. The API key never leaves the host.
 */
import { useCallback, useEffect, useState } from 'react';
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';
/** Map the well-known currency codes to symbols; fall back to the code itself. */
function symbolFor(currency) {
    if (currency === 'CNY')
        return '¥';
    if (currency === 'USD')
        return '$';
    return `${currency} `;
}
const ROOT_STYLE = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: 'var(--dsw-text-secondary, #8a8f98)',
};
const BUTTON_STYLE = {
    border: 'none',
    background: 'none',
    padding: 0,
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: 1,
    color: 'inherit',
    opacity: 0.7,
};
/** The stats-line companion: one balance readout with a manual refresh. */
export function BalanceDock() {
    const [state, setState] = useState({ kind: 'loading' });
    const [refreshSeq, setRefreshSeq] = useState(0);
    const refresh = useCallback(() => setRefreshSeq((seq) => seq + 1), []);
    useEffect(() => {
        let cancelled = false;
        setState({ kind: 'loading' });
        fetch('/dsh-balance', { headers: { accept: 'application/json' } })
            .then((response) => {
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
            .then((result) => {
            if (cancelled)
                return;
            if (!result.ok || result.data === undefined) {
                setState({ kind: 'error', message: result.error ?? 'unknown error' });
                return;
            }
            const infos = result.data.balance_infos ?? [];
            if (!result.data.is_available || infos.length === 0) {
                setState({ kind: 'ok', currency: '', total: '—', detail: 'DeepSeek balance unavailable' });
                return;
            }
            const info = infos[0];
            const symbol = symbolFor(info.currency);
            setState({
                kind: 'ok',
                currency: symbol,
                total: info.total_balance,
                detail: `Topped up: ${symbol}${info.topped_up_balance} · Granted: ${symbol}${info.granted_balance}`,
            });
        })
            .catch((error) => {
            if (cancelled)
                return;
            setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
        });
        return () => { cancelled = true; };
    }, [refreshSeq]);
    const content = state.kind === 'loading'
        ? _jsx("span", { children: "\u4F59\u989D: \u2026" })
        : state.kind === 'error'
            ? (_jsx(Tooltip, { label: state.message, side: "top", delayMs: 400, children: _jsx("span", { children: "\u4F59\u989D: \u4E0D\u53EF\u7528" }) }))
            : (_jsx(Tooltip, { label: state.detail, side: "top", delayMs: 400, children: _jsxs("span", { children: ["\u4F59\u989D: ", state.currency, state.total] }) }));
    return (_jsxs("div", { style: ROOT_STYLE, children: [content, _jsx("button", { type: "button", onClick: refresh, title: "\u5237\u65B0\u4F59\u989D", "aria-label": "\u5237\u65B0\u4F59\u989D", style: BUTTON_STYLE, children: "\u27F3" })] }));
}
