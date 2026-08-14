import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Composer-dock entry rendering the DeepSeek account balance and the current
 * session's estimated spend under the conversation stats line. The balance and
 * price tier arrive from the host's `/dsh-balance` route; the session token
 * usage rides the standard `tokenUsage` projection (the same one the stats
 * line's cache-hit figure uses). The API key never leaves the host.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';
/** Map the well-known currency codes to symbols; fall back to the code itself. */
function symbolFor(currency) {
    if (currency === 'CNY')
        return '¥';
    if (currency === 'USD')
        return '$';
    return `${currency} `;
}
/** Compact CNY amount: two decimals below ¥1000, else one. */
function formatCny(value) {
    if (value >= 1000)
        return `¥${Math.round(value)}`;
    return `¥${value.toFixed(2)}`;
}
/** Per-token price from the per-million figures. */
function perToken(perMillion) {
    return perMillion / 1_000_000;
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
const LINK_STYLE = {
    color: 'inherit',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
};
/** The stats-line companion: balance readout, top-up link, and session spend. */
export function BalanceDock({ useProjection }) {
    const usage = useProjection('tokenUsage');
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
            setState({ kind: 'ok', data: result.data });
        })
            .catch((error) => {
            if (cancelled)
                return;
            setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
        });
        return () => { cancelled = true; };
    }, [refreshSeq]);
    // Estimated session spend: the token buckets priced at the host-selected
    // tier. Cache-write tokens are unpriced by DeepSeek's published table, so
    // they contribute nothing. The model is the host's configured estimateModel.
    const cost = useMemo(() => {
        if (state.kind !== 'ok' || usage === undefined)
            return null;
        const p = state.data.pricing.perMillion;
        const tokens = usage.uncachedInputTokens * perToken(p.input)
            + usage.cacheReadTokens * perToken(p.cacheHit)
            + usage.outputTokens * perToken(p.output);
        return tokens;
    }, [state, usage]);
    const balanceText = state.kind === 'loading'
        ? _jsx("span", { children: "\u4F59\u989D: \u2026" })
        : state.kind === 'error'
            ? _jsx(Tooltip, { label: state.message, side: "top", delayMs: 400, children: _jsx("span", { children: "\u4F59\u989D: \u4E0D\u53EF\u7528" }) })
            : (_jsx(Tooltip, { label: balanceDetail(state.data), side: "top", delayMs: 400, children: _jsxs("span", { children: ["\u4F59\u989D: ", balanceTotal(state.data)] }) }));
    return (_jsxs("div", { style: ROOT_STYLE, children: [balanceText, state.kind === 'ok' && (_jsxs(_Fragment, { children: [_jsx("a", { href: state.data.topUpUrl, target: "_blank", rel: "noreferrer", style: LINK_STYLE, children: "\u5145\u503C" }), _jsx("button", { type: "button", onClick: refresh, title: "\u5237\u65B0\u4F59\u989D", "aria-label": "\u5237\u65B0\u4F59\u989D", style: BUTTON_STYLE, children: "\u27F3" }), cost !== null && usage !== undefined && (_jsx(Tooltip, { label: costDetail(usage, state.data.pricing), side: "top", delayMs: 400, children: _jsxs("span", { children: ["\u672C\u4F1A\u8BDD \u2248 ", formatCny(cost)] }) }))] }))] }));
}
/** Render the first balance row compactly, or an unavailable marker. */
function balanceTotal(data) {
    const info = data.balance_infos?.[0];
    if (!data.is_available || info === undefined)
        return '—';
    return `${symbolFor(info.currency)}${info.total_balance}`;
}
/** Hover detail: topped-up and granted for every reported currency. */
function balanceDetail(data) {
    const rows = (data.balance_infos ?? []).map((info) => `${symbolFor(info.currency)}${info.total_balance} · 充值 ${symbolFor(info.currency)}${info.topped_up_balance} · 赠送 ${symbolFor(info.currency)}${info.granted_balance}`);
    return rows.length > 0 ? rows.join(' / ') : 'DeepSeek balance unavailable';
}
/** Hover detail for the spend figure: token buckets times the active tier. */
function costDetail(usage, pricing) {
    const p = pricing.perMillion;
    return [
        `输入 ${usage.uncachedInputTokens} × ¥${p.input}/M`,
        `缓存命中 ${usage.cacheReadTokens} × ¥${p.cacheHit}/M`,
        `输出 ${usage.outputTokens} × ¥${p.output}/M`,
        `时段: ${pricing.tier === 'peak' ? '高峰' : '空闲'}`,
    ].join(' · ');
}
