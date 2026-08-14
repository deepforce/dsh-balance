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
		* Composer-dock entry rendering the DeepSeek account balance and the current
		* session's estimated spend under the conversation stats line. The balance and
		* price tier arrive from the host's `/dsh-balance` route; the session token
		* usage rides the standard `tokenUsage` projection (the same one the stats
		* line's cache-hit figure uses). The API key never leaves the host.
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
			display: "inline-flex",
			alignItems: "center",
			gap: 6,
			fontSize: 12,
			color: "var(--dsw-text-secondary, #8a8f98)"
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
		const LINK_STYLE = {
			color: "inherit",
			textDecoration: "underline",
			textUnderlineOffset: 2
		};
		/** The stats-line companion: balance readout, top-up link, and session spend. */
		function BalanceDock({ useProjection }) {
			const usage = useProjection("tokenUsage");
			const [state, setState] = (0, react.useState)({ kind: "loading" });
			const [refreshSeq, setRefreshSeq] = (0, react.useState)(0);
			const refresh = (0, react.useCallback)(() => setRefreshSeq((seq) => seq + 1), []);
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
			const cost = (0, react.useMemo)(() => {
				if (state.kind !== "ok" || usage === void 0) return null;
				const p = state.data.pricing.perMillion;
				return usage.uncachedInputTokens * perToken(p.input) + usage.cacheReadTokens * perToken(p.cacheHit) + usage.outputTokens * perToken(p.output);
			}, [state, usage]);
			const balanceText = state.kind === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "余额: …" }) : state.kind === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: state.message,
				side: "top",
				delayMs: 400,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "余额: 不可用" })
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: balanceDetail(state.data),
				side: "top",
				delayMs: 400,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["余额: ", balanceTotal(state.data)] })
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: ROOT_STYLE,
				children: [balanceText, state.kind === "ok" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
						href: state.data.topUpUrl,
						target: "_blank",
						rel: "noreferrer",
						style: LINK_STYLE,
						children: "充值"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: refresh,
						title: "刷新余额",
						"aria-label": "刷新余额",
						style: BUTTON_STYLE,
						children: "⟳"
					}),
					cost !== null && usage !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
						label: costDetail(usage, state.data.pricing),
						side: "top",
						delayMs: 400,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["本会话 ≈ ", formatCny(cost)] })
					})
				] })]
			});
		}
		/** Render the first balance row compactly, or an unavailable marker. */
		function balanceTotal(data) {
			const info = data.balance_infos?.[0];
			if (!data.is_available || info === void 0) return "—";
			return `${symbolFor(info.currency)}${info.total_balance}`;
		}
		/** Hover detail: topped-up and granted for every reported currency. */
		function balanceDetail(data) {
			const rows = (data.balance_infos ?? []).map((info) => `${symbolFor(info.currency)}${info.total_balance} · 充值 ${symbolFor(info.currency)}${info.topped_up_balance} · 赠送 ${symbolFor(info.currency)}${info.granted_balance}`);
			return rows.length > 0 ? rows.join(" / ") : "DeepSeek balance unavailable";
		}
		/** Hover detail for the spend figure: token buckets times the active tier. */
		function costDetail(usage, pricing) {
			const p = pricing.perMillion;
			return [
				`输入 ${usage.uncachedInputTokens} × ¥${p.input}/M`,
				`缓存命中 ${usage.cacheReadTokens} × ¥${p.cacheHit}/M`,
				`输出 ${usage.outputTokens} × ¥${p.output}/M`,
				`时段: ${pricing.tier === "peak" ? "高峰" : "空闲"}`
			].join(" · ");
		}
		//#endregion
		//#region src/client/index.ts
		/** Required services: the slot registry (ui-slots platform module). */
		const inject = ["slots"];
		/**
		* Client plugin body: contribute the balance readout to the composer dock,
		* after the shipped stats line (`order: 1` follows its `order: 0`).
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
				name: "conversation.composer.dock",
				id: "balance",
				order: 1
			}, BalanceDock));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map