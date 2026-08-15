import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Composer-dock entry rendering the DeepSeek account balance, the current
 * session's estimated spend, and a hover-revealed daily-spend bar chart with
 * axes. Balance and price tier arrive from the host's `/dsh-balance` route;
 * the session token usage rides the standard `tokenUsage` projection (the same
 * one the stats line's cache-hit figure uses); the chart fetches `/dsh-usage`.
 * Copy comes from the `balance` locale namespace, so it follows the active dsh
 * language. The API key never leaves the host.
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
/** Compact axis tick: ¥0 / ¥1.5 / ¥27. */
function formatAxisTick(value) {
    if (value === 0)
        return '¥0';
    if (value >= 100)
        return `¥${Math.round(value)}`;
    if (value >= 10)
        return `¥${Math.round(value * 10) / 10}`;
    return `¥${Math.round(value * 100) / 100}`;
}
/** Compact token count: 517 / 12.3K / 1.2M. */
function formatTokens(value) {
    if (value < 1_000)
        return String(value);
    if (value < 1_000_000)
        return `${Math.round(value / 100) / 10}K`;
    return `${Math.round(value / 100_000) / 10}M`;
}
/** Per-token price from the per-million figures. */
function perToken(perMillion) {
    return perMillion / 1_000_000;
}
const ROOT_STYLE = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    fontSize: 12,
    color: 'var(--dsw-text-secondary, #8a8f98)',
};
const ROW_STYLE = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
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
const USAGE_SUMMARY_STYLE = {
    textDecoration: 'underline',
    textUnderlineOffset: 2,
    whiteSpace: 'nowrap',
};
const LINK_STYLE = {
    color: 'inherit',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
};
const CHART_WRAP_STYLE = {
    padding: '4px 8px',
    background: 'var(--dsw-surface-secondary, rgba(0,0,0,0.03))',
    borderRadius: 6,
};
/** The stats-line companion: balance readout, top-up link, session spend, and the hover chart. */
export function BalanceDock({ useProjection, t }) {
    const usage = useProjection('tokenUsage');
    const [state, setState] = useState({ kind: 'loading' });
    const [refreshSeq, setRefreshSeq] = useState(0);
    const refresh = useCallback(() => setRefreshSeq((seq) => seq + 1), []);
    const [usageOpen, setUsageOpen] = useState(false);
    const [chart, setChart] = useState({ kind: 'idle' });
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
    const loadChart = useCallback((days) => {
        setChart({ kind: 'loading' });
        fetch(`/dsh-usage?days=${days}`, { headers: { accept: 'application/json' } })
            .then((response) => {
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
            .then((result) => {
            if (!result.ok || result.data === undefined) {
                setChart({ kind: 'error', message: result.error ?? 'unknown error' });
                return;
            }
            setChart({ kind: 'ok', days: result.data.days });
        })
            .catch((error) => {
            setChart({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
        });
    }, []);
    // Hover-to-reveal: entering the summary opens the chart (loading it on
    // first use); leaving the whole dock closes it. Moving between the summary
    // and the chart stays inside ROOT, so the chart does not flicker.
    const openChart = useCallback(() => {
        setUsageOpen(true);
        if (state.kind === 'ok' && (chart.kind === 'idle' || chart.kind === 'error')) {
            loadChart(state.data.usageDays);
        }
    }, [state, chart.kind, loadChart]);
    const closeChart = useCallback(() => setUsageOpen(false), []);
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
    const chartTotal = useMemo(() => chart.kind === 'ok' ? chart.days.reduce((sum, day) => sum + day.cost, 0) : null, [chart]);
    const balanceText = state.kind === 'loading'
        ? _jsx("span", { children: t('balance.loading') })
        : state.kind === 'error'
            ? _jsx(Tooltip, { label: state.message, side: "top", delayMs: 400, children: _jsx("span", { children: t('balance.unavailable') }) })
            : (_jsx(Tooltip, { label: balanceDetail(state.data, t), side: "top", delayMs: 400, children: _jsx("span", { children: t('balance.label', { total: balanceTotal(state.data, t) }) }) }));
    return (_jsxs("div", { style: ROOT_STYLE, onMouseLeave: closeChart, children: [_jsxs("div", { style: ROW_STYLE, children: [balanceText, state.kind === 'ok' && (_jsxs(_Fragment, { children: [_jsx("a", { href: state.data.topUpUrl, target: "_blank", rel: "noreferrer", style: LINK_STYLE, children: t('balance.topUp') }), _jsx("button", { type: "button", onClick: refresh, title: t('balance.refresh'), "aria-label": t('balance.refresh'), style: BUTTON_STYLE, children: "\u27F3" }), cost !== null && usage !== undefined && (_jsx(Tooltip, { label: costDetail(usage, state.data.pricing, t), side: "top", delayMs: 400, children: _jsx("span", { children: t('cost.label', { cost: formatCny(cost) }) }) })), _jsxs("span", { onMouseEnter: openChart, title: t('usage.title'), style: USAGE_SUMMARY_STYLE, children: [usageOpen ? '▾ ' : '▸ ', t('usage.summary', {
                                        days: state.data.usageDays,
                                        cost: chartTotal === null ? '…' : formatCny(chartTotal),
                                    })] })] }))] }), usageOpen && (_jsxs("div", { style: CHART_WRAP_STYLE, children: [chart.kind === 'loading' && _jsx("span", { children: t('usage.loading') }), chart.kind === 'error' && _jsx(Tooltip, { label: chart.message, side: "top", delayMs: 400, children: _jsx("span", { children: t('usage.error') }) }), chart.kind === 'ok' && (chart.days.length === 0
                        ? _jsx("span", { children: t('usage.empty', { days: state.kind === 'ok' ? state.data.usageDays : '' }) })
                        : _jsx(UsageBars, { days: chart.days, t: t }))] }))] }));
}
/**
 * A tiny dependency-free SVG bar chart of per-day spend: Y axis with grid
 * ticks, an X-axis date label per bar, and a comic-style speech bubble that
 * floats up from each bar on hover.
 */
function UsageBars({ days, t }) {
    const [hovered, setHovered] = useState(null);
    // Top margin reserves room for the speech bubble above the tallest bar.
    const margin = { top: 40, right: 8, bottom: 18, left: 40 };
    const width = 320;
    const height = 110;
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    const max = Math.max(...days.map((day) => day.cost), 0.01);
    const step = plotW / days.length;
    const barW = Math.max(7, Math.min(24, step * 0.62));
    const ticks = [0, max / 2, max];
    const baseline = margin.top + plotH;
    return (_jsxs("svg", { width: width, height: height, role: "img", "aria-label": t('usage.title'), children: [ticks.map((tick) => {
                const y = baseline - tick / max * plotH;
                return (_jsxs("g", { children: [_jsx("line", { x1: margin.left, y1: y, x2: width - margin.right, y2: y, stroke: "rgba(128,128,128,0.18)", strokeDasharray: "3 3" }), _jsx("text", { x: margin.left - 5, y: y + 3, textAnchor: "end", fontSize: 9, fill: "currentColor", children: formatAxisTick(tick) })] }, tick));
            }), _jsx("line", { x1: margin.left, y1: baseline, x2: width - margin.right, y2: baseline, stroke: "rgba(128,128,128,0.3)" }), days.map((day, index) => {
                const barH = Math.max(2, day.cost / max * plotH);
                const x = margin.left + index * step + (step - barW) / 2;
                const y = baseline - barH;
                const active = hovered === index;
                return (_jsxs("g", { onMouseEnter: () => setHovered(index), onMouseLeave: () => setHovered(null), children: [_jsx("rect", { x: x, y: y, width: barW, height: barH, rx: 2, fill: active ? 'var(--dsw-accent-strong, #7aa8ff)' : 'var(--dsw-accent, #4c8dff)' }), _jsx("text", { x: x + barW / 2, y: height - 5, textAnchor: "middle", fontSize: 8, fill: "currentColor", children: day.date.slice(5) }), active && _jsx(SpeechBubble, { day: day, barX: x + barW / 2, barTop: y, width: width, t: t })] }, day.date));
            })] }));
}
/** A comic-style speech bubble floating above a bar, with a tail pointing at it. */
function SpeechBubble({ day, barX, barTop, width, t, }) {
    const tipW = 118;
    const tipH = 34;
    const tailH = 4;
    const x = Math.min(Math.max(barX - tipW / 2, 0), width - tipW);
    const y = Math.max(1, barTop - tipH - tailH);
    const fill = 'var(--dsw-surface, #1f2430)';
    return (_jsxs("g", { children: [_jsx("polygon", { points: `${barX - 5},${y + tipH} ${barX + 5},${y + tipH} ${barX},${barTop}`, fill: fill }), _jsx("rect", { x: x, y: y, width: tipW, height: tipH, rx: 4, fill: fill, stroke: "rgba(128,128,128,0.45)" }), _jsx("text", { x: x + 6, y: y + 12, fontSize: 9, fill: "currentColor", children: t('usage.bar', { date: day.date, cost: formatCny(day.cost) }) }), _jsx("text", { x: x + 6, y: y + 25, fontSize: 9, fill: "currentColor", children: t('usage.barDetail', {
                    requests: String(day.requests),
                    input: formatTokens(day.uncachedInput + day.cacheRead + day.cacheWrite),
                    output: formatTokens(day.output),
                }) })] }));
}
/** Render the first balance row compactly, or an unavailable marker. */
function balanceTotal(data, t) {
    const info = data.balance_infos?.[0];
    if (!data.is_available || info === undefined)
        return t('balance.none');
    return `${symbolFor(info.currency)}${info.total_balance}`;
}
/** Hover detail: topped-up and granted for every reported currency. */
function balanceDetail(data, t) {
    const rows = (data.balance_infos ?? []).map((info) => t('balance.detail', {
        symbol: symbolFor(info.currency),
        total: info.total_balance,
        toppedUp: info.topped_up_balance,
        granted: info.granted_balance,
    }));
    return rows.length > 0 ? rows.join(' / ') : t('balance.detail.unavailable');
}
/** Hover detail for the spend figure: token buckets times the active tier. */
function costDetail(usage, pricing, t) {
    const p = pricing.perMillion;
    const tierKey = pricing.tier === 'peak' ? 'tier.peak' : 'tier.offpeak';
    return [
        t('cost.detail.input', { tokens: String(usage.uncachedInputTokens), price: p.input }),
        t('cost.detail.cacheHit', { tokens: String(usage.cacheReadTokens), price: p.cacheHit }),
        t('cost.detail.output', { tokens: String(usage.outputTokens), price: p.output }),
        t('cost.detail.tier', { tier: t(tierKey) }),
    ].join(' · ');
}
