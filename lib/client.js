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
		* session's estimated spend, and a hover-revealed daily-spend bar chart with
		* axes. Balance and price tier arrive from the host's `/dsh-balance` route;
		* the session token usage rides the standard `tokenUsage` projection (the same
		* one the stats line's cache-hit figure uses); the chart fetches `/dsh-usage`.
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
		/** Compact axis tick: ¥0 / ¥1.5 / ¥27. */
		function formatAxisTick(value) {
			if (value === 0) return "¥0";
			if (value >= 100) return `¥${Math.round(value)}`;
			if (value >= 10) return `¥${Math.round(value * 10) / 10}`;
			return `¥${Math.round(value * 100) / 100}`;
		}
		/** Compact token count: 517 / 12.3K / 1.2M. */
		function formatTokens(value) {
			if (value < 1e3) return String(value);
			if (value < 1e6) return `${Math.round(value / 100) / 10}K`;
			return `${Math.round(value / 1e5) / 10}M`;
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
		const USAGE_SUMMARY_STYLE = {
			textDecoration: "underline",
			textUnderlineOffset: 2,
			whiteSpace: "nowrap"
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
		/** The stats-line companion: balance readout, top-up link, session spend, and the hover chart. */
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
			const openChart = (0, react.useCallback)(() => {
				setUsageOpen(true);
				if (state.kind === "ok" && (chart.kind === "idle" || chart.kind === "error")) loadChart(state.data.usageDays);
			}, [
				state,
				chart.kind,
				loadChart
			]);
			const closeChart = (0, react.useCallback)(() => setUsageOpen(false), []);
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
				onMouseLeave: closeChart,
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
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							onMouseEnter: openChart,
							title: t("usage.title"),
							style: USAGE_SUMMARY_STYLE,
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
		/**
		* A tiny dependency-free SVG bar chart of per-day spend: Y axis with grid
		* ticks, an X-axis date label per bar, and a comic-style speech bubble that
		* floats up from each bar on hover.
		*/
		function UsageBars({ days, t }) {
			const [hovered, setHovered] = (0, react.useState)(null);
			const margin = {
				top: 40,
				right: 8,
				bottom: 18,
				left: 40
			};
			const width = 320;
			const height = 110;
			const plotW = width - margin.left - margin.right;
			const plotH = height - margin.top - margin.bottom;
			const max = Math.max(...days.map((day) => day.cost), .01);
			const step = plotW / days.length;
			const barW = Math.max(7, Math.min(24, step * .62));
			const ticks = [
				0,
				max / 2,
				max
			];
			const baseline = margin.top + plotH;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width,
				height,
				role: "img",
				"aria-label": t("usage.title"),
				children: [
					ticks.map((tick) => {
						const y = baseline - tick / max * plotH;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
							x1: margin.left,
							y1: y,
							x2: width - margin.right,
							y2: y,
							stroke: "rgba(128,128,128,0.18)",
							strokeDasharray: "3 3"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
							x: margin.left - 5,
							y: y + 3,
							textAnchor: "end",
							fontSize: 9,
							fill: "currentColor",
							children: formatAxisTick(tick)
						})] }, tick);
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
						x1: margin.left,
						y1: baseline,
						x2: width - margin.right,
						y2: baseline,
						stroke: "rgba(128,128,128,0.3)"
					}),
					days.map((day, index) => {
						const barH = Math.max(2, day.cost / max * plotH);
						const x = margin.left + index * step + (step - barW) / 2;
						const y = baseline - barH;
						const active = hovered === index;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
							onMouseEnter: () => setHovered(index),
							onMouseLeave: () => setHovered(null),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
									x,
									y,
									width: barW,
									height: barH,
									rx: 2,
									fill: active ? "var(--dsw-accent-strong, #7aa8ff)" : "var(--dsw-accent, #4c8dff)"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
									x: x + barW / 2,
									y: 105,
									textAnchor: "middle",
									fontSize: 8,
									fill: "currentColor",
									children: day.date.slice(5)
								}),
								active && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SpeechBubble, {
									day,
									barX: x + barW / 2,
									barTop: y,
									width,
									t
								})
							]
						}, day.date);
					})
				]
			});
		}
		/** A comic-style speech bubble floating above a bar, with a tail pointing at it. */
		function SpeechBubble({ day, barX, barTop, width, t }) {
			const tipW = 118;
			const tipH = 34;
			const tailH = 4;
			const x = Math.min(Math.max(barX - tipW / 2, 0), width - tipW);
			const y = Math.max(1, barTop - tipH - tailH);
			const fill = "var(--dsw-surface, #1f2430)";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("polygon", {
					points: `${barX - 5},${y + tipH} ${barX + 5},${y + tipH} ${barX},${barTop}`,
					fill
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x,
					y,
					width: tipW,
					height: tipH,
					rx: 4,
					fill,
					stroke: "rgba(128,128,128,0.45)"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
					x: x + 6,
					y: y + 12,
					fontSize: 9,
					fill: "currentColor",
					children: t("usage.bar", {
						date: day.date,
						cost: formatCny(day.cost)
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
					x: x + 6,
					y: y + 25,
					fontSize: 9,
					fill: "currentColor",
					children: t("usage.barDetail", {
						requests: String(day.requests),
						input: formatTokens(day.uncachedInput + day.cacheRead + day.cacheWrite),
						output: formatTokens(day.output)
					})
				})
			] });
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
			"usage.bar": "{date} · ¥{cost}",
			"usage.barDetail": "{requests} 次请求 · 输入 {input} · 输出 {output}"
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
			"usage.bar": "{date} · ¥{cost}",
			"usage.barDetail": "{requests} requests · {input} in · {output} out"
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