window.__ModuleLoader__.load({
	id: "@deepforce/dsh-balance",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/BalanceDock.tsx
		/**
		* Composer-dock entry rendering the DeepSeek account balance, the current
		* session's estimated spend, and a click-to-expand daily-spend bar chart.
		* Balance and price tier arrive from the host's `/dsh-balance` route; the
		* session token usage rides the standard `tokenUsage` projection (the same one
		* the stats line's cache-hit figure uses); the chart fetches `/dsh-usage`.
		* Copy comes from the `balance` locale namespace, so it follows the active dsh
		* language. The API key never leaves the host.
		*/
		/** Map the well-known currency codes to symbols; fall back to the code itself. */
		function symbolFor(currency) {
			if (currency === "CNY") return "¥";
			if (currency === "USD") return "$";
			return `${currency} `;
		}
		/** Compact CNY amount: two decimals below ¥1000, else one. */
		function formatCny(value) {
			if (value >= 1e3) return `¥${Math.round(value)}`;
			return `¥${value.toFixed(2)}`;
		}
		/** Per-token price from the per-million figures. */
		function perToken(perMillion) {
			return perMillion / 1e6;
		}
		const ROOT_STYLE = {
			display: "flex",
			flexDirection: "column",
			alignItems: "flex-start",
			gap: 4,
			fontSize: 12,
			color: "var(--dsw-text-secondary, #8a8f98)"
		};
		const ROW_STYLE = {
			display: "inline-flex",
			alignItems: "center",
			gap: 6
		};
		const BUTTON_STYLE = {
			border: "none",
			background: "none",
			padding: 0,
			cursor: "pointer",
			fontSize: 12,
			lineHeight: 1,
			color: "inherit",
			opacity: .7
		};
		const USAGE_BUTTON_STYLE = {
			...BUTTON_STYLE,
			opacity: 1,
			textDecoration: "underline",
			textUnderlineOffset: 2
		};
		const LINK_STYLE = {
			color: "inherit",
			textDecoration: "underline",
			textUnderlineOffset: 2
		};
		const CHART_WRAP_STYLE = {
			padding: "4px 8px",
			background: "var(--dsw-surface-secondary, rgba(0,0,0,0.03))",
			borderRadius: 6
		};
		/** The stats-line companion: balance readout, top-up link, session spend, and the daily chart. */
		function BalanceDock({ useProjection, t }) {
			const usage = useProjection("tokenUsage");
			const [state, setState] = (0, react.useState)({ kind: "loading" });
			const [refreshSeq, setRefreshSeq] = (0, react.useState)(0);
			const refresh = (0, react.useCallback)(() => setRefreshSeq((seq) => seq + 1), []);
			const [usageOpen, setUsageOpen] = (0, react.useState)(false);
			const [chart, setChart] = (0, react.useState)({ kind: "idle" });
			(0, react.useEffect)(() => {
				let cancelled = false;
				setState({ kind: "loading" });
				fetch("/dsh-balance", { headers: { accept: "application/json" } }).then((response) => {
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					return response.json();
				}).then((result) => {
					if (cancelled) return;
					if (!result.ok || result.data === void 0) {
						setState({
							kind: "error",
							message: result.error ?? "unknown error"
						});
						return;
					}
					setState({
						kind: "ok",
						data: result.data
					});
				}).catch((error) => {
					if (cancelled) return;
					setState({
						kind: "error",
						message: error instanceof Error ? error.message : String(error)
					});
				});
				return () => {
					cancelled = true;
				};
			}, [refreshSeq]);
			const loadChart = (0, react.useCallback)((days) => {
				setChart({ kind: "loading" });
				fetch(`/dsh-usage?days=${days}`, { headers: { accept: "application/json" } }).then((response) => {
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					return response.json();
				}).then((result) => {
					if (!result.ok || result.data === void 0) {
						setChart({
							kind: "error",
							message: result.error ?? "unknown error"
						});
						return;
					}
					setChart({
						kind: "ok",
						days: result.data.days
					});
				}).catch((error) => {
					setChart({
						kind: "error",
						message: error instanceof Error ? error.message : String(error)
					});
				});
			}, []);
			const toggleChart = (0, react.useCallback)(() => {
				setUsageOpen((open) => {
					const next = !open;
					if (next && state.kind === "ok" && (chart.kind === "idle" || chart.kind === "error")) loadChart(state.data.usageDays);
					return next;
				});
			}, [
				state,
				chart.kind,
				loadChart
			]);
			const cost = (0, react.useMemo)(() => {
				if (state.kind !== "ok" || usage === void 0) return null;
				const p = state.data.pricing.perMillion;
				return usage.uncachedInputTokens * perToken(p.input) + usage.cacheReadTokens * perToken(p.cacheHit) + usage.outputTokens * perToken(p.output);
			}, [state, usage]);
			const chartTotal = (0, react.useMemo)(() => chart.kind === "ok" ? chart.days.reduce((sum, day) => sum + day.cost, 0) : null, [chart]);
			const balanceText = state.kind === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("balance.loading") }) : state.kind === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: state.message,
				side: "top",
				delayMs: 400,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("balance.unavailable") })
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: balanceDetail(state.data, t),
				side: "top",
				delayMs: 400,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("balance.label", { total: balanceTotal(state.data, t) }) })
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: ROOT_STYLE,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: ROW_STYLE,
					children: [balanceText, state.kind === "ok" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
							href: state.data.topUpUrl,
							target: "_blank",
							rel: "noreferrer",
							style: LINK_STYLE,
							children: t("balance.topUp")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: refresh,
							title: t("balance.refresh"),
							"aria-label": t("balance.refresh"),
							style: BUTTON_STYLE,
							children: "⟳"
						}),
						cost !== null && usage !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: costDetail(usage, state.data.pricing, t),
							side: "top",
							delayMs: 400,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("cost.label", { cost: formatCny(cost) }) })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: toggleChart,
							title: t("usage.title"),
							"aria-expanded": usageOpen,
							style: USAGE_BUTTON_STYLE,
							children: [usageOpen ? "▾ " : "▸ ", t("usage.summary", {
								days: state.data.usageDays,
								cost: chartTotal === null ? "…" : formatCny(chartTotal)
							})]
						})
					] })]
				}), usageOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: CHART_WRAP_STYLE,
					children: [
						chart.kind === "loading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("usage.loading") }),
						chart.kind === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: chart.message,
							side: "top",
							delayMs: 400,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("usage.error") })
						}),
						chart.kind === "ok" && (chart.days.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("usage.empty", { days: state.kind === "ok" ? state.data.usageDays : "" }) }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageBars, {
							days: chart.days,
							t
						}))
					]
				})]
			});
		}
		/** A tiny dependency-free SVG bar chart of per-day spend. */
		function UsageBars({ days, t }) {
			const width = 300;
			const height = 60;
			const baseline = 52;
			const max = Math.max(...days.map((day) => day.cost), .01);
			const barW = Math.max(8, Math.min(26, width / days.length - 4));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width,
				height,
				role: "img",
				"aria-label": t("usage.title"),
				children: days.map((day, index) => {
					const barH = Math.max(2, day.cost / max * 48);
					const x = index * (barW + 4);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x,
						y: baseline - barH,
						width: barW,
						height: barH,
						rx: 2,
						fill: "var(--dsw-accent, #4c8dff)",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("title", { children: t("usage.day", {
							date: day.date,
							cost: formatCny(day.cost)
						}) })
					}, day.date);
				})
			});
		}
		/** Render the first balance row compactly, or an unavailable marker. */
		function balanceTotal(data, t) {
			const info = data.balance_infos?.[0];
			if (!data.is_available || info === void 0) return t("balance.none");
			return `${symbolFor(info.currency)}${info.total_balance}`;
		}
		/** Hover detail: topped-up and granted for every reported currency. */
		function balanceDetail(data, t) {
			const rows = (data.balance_infos ?? []).map((info) => t("balance.detail", {
				symbol: symbolFor(info.currency),
				total: info.total_balance,
				toppedUp: info.topped_up_balance,
				granted: info.granted_balance
			}));
			return rows.length > 0 ? rows.join(" / ") : t("balance.detail.unavailable");
		}
		/** Hover detail for the spend figure: token buckets times the active tier. */
		function costDetail(usage, pricing, t) {
			const p = pricing.perMillion;
			const tierKey = pricing.tier === "peak" ? "tier.peak" : "tier.offpeak";
			return [
				t("cost.detail.input", {
					tokens: String(usage.uncachedInputTokens),
					price: p.input
				}),
				t("cost.detail.cacheHit", {
					tokens: String(usage.cacheReadTokens),
					price: p.cacheHit
				}),
				t("cost.detail.output", {
					tokens: String(usage.outputTokens),
					price: p.output
				}),
				t("cost.detail.tier", { tier: t(tierKey) })
			].join(" · ");
		}
		//#endregion
		//#region src/client/locales.ts
		/** `balance` namespace dictionaries — the readout copy of the dsh-balance UI. */
		/** Dictionary namespace owned by this plugin. */
		const NS = "balance";
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"balance.loading": "余额: …",
			"balance.unavailable": "余额: 不可用",
			"balance.label": "余额: {total}",
			"balance.none": "—",
			"balance.topUp": "充值",
			"balance.refresh": "刷新余额",
			"balance.detail": "{symbol}{total} · 充值 {symbol}{toppedUp} · 赠送 {symbol}{granted}",
			"balance.detail.unavailable": "DeepSeek 余额不可用",
			"cost.label": "本会话 ≈ {cost}",
			"cost.detail.input": "输入 {tokens} × ¥{price}/M",
			"cost.detail.cacheHit": "缓存命中 {tokens} × ¥{price}/M",
			"cost.detail.output": "输出 {tokens} × ¥{price}/M",
			"cost.detail.tier": "时段: {tier}",
			"tier.peak": "高峰",
			"tier.offpeak": "空闲",
			"usage.summary": "近{days}天 ≈ {cost}",
			"usage.title": "每日消耗",
			"usage.loading": "加载中…",
			"usage.empty": "近 {days} 天无消耗",
			"usage.error": "消耗数据不可用",
			"usage.day": "{date} · ¥{cost}"
		};
		/** English dictionary, key-identical to the Chinese source of truth. */
		const en = {
			"balance.loading": "Balance: …",
			"balance.unavailable": "Balance: unavailable",
			"balance.label": "Balance: {total}",
			"balance.none": "—",
			"balance.topUp": "Top up",
			"balance.refresh": "Refresh balance",
			"balance.detail": "{symbol}{total} · topped up {symbol}{toppedUp} · granted {symbol}{granted}",
			"balance.detail.unavailable": "DeepSeek balance unavailable",
			"cost.label": "Session ≈ {cost}",
			"cost.detail.input": "input {tokens} × ¥{price}/M",
			"cost.detail.cacheHit": "cache hit {tokens} × ¥{price}/M",
			"cost.detail.output": "output {tokens} × ¥{price}/M",
			"cost.detail.tier": "tier: {tier}",
			"tier.peak": "peak",
			"tier.offpeak": "off-peak",
			"usage.summary": "Last {days}d ≈ {cost}",
			"usage.title": "Daily spend",
			"usage.loading": "Loading…",
			"usage.empty": "No usage in the last {days} days",
			"usage.error": "Usage unavailable",
			"usage.day": "{date} · ¥{cost}"
		};
		//#endregion
		//#region src/client/index.ts
		/** Required services: the slot registry and the locale dictionary registry. */
		const inject = ["slots", "locale"];
		/**
		* Client plugin body: register the dictionaries and contribute the balance
		* readout to the composer dock, after the shipped stats line (`order: 1`
		* follows its `order: 0`).
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-balance: dictionaries");
			ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
				name: "conversation.composer.dock",
				id: "balance",
				order: 1,
				locale: NS
			}, BalanceDock));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map