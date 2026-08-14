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
		* Composer-dock entry rendering the DeepSeek account balance under the
		* conversation stats line. Self-contained: it issues no RPC and declares no
		* props — the data arrives from the host's `/dsh-balance` route, fetched on
		* mount and on the manual refresh button. The API key never leaves the host.
		*/
		/** Map the well-known currency codes to symbols; fall back to the code itself. */
		function symbolFor(currency) {
			if (currency === "CNY") return "¥";
			if (currency === "USD") return "$";
			return `${currency} `;
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
		/** The stats-line companion: one balance readout with a manual refresh. */
		function BalanceDock() {
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
					const infos = result.data.balance_infos ?? [];
					if (!result.data.is_available || infos.length === 0) {
						setState({
							kind: "ok",
							currency: "",
							total: "—",
							detail: "DeepSeek balance unavailable"
						});
						return;
					}
					const info = infos[0];
					const symbol = symbolFor(info.currency);
					setState({
						kind: "ok",
						currency: symbol,
						total: info.total_balance,
						detail: `Topped up: ${symbol}${info.topped_up_balance} · Granted: ${symbol}${info.granted_balance}`
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
			const content = state.kind === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "余额: …" }) : state.kind === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: state.message,
				side: "top",
				delayMs: 400,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "余额: 不可用" })
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: state.detail,
				side: "top",
				delayMs: 400,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
					"余额: ",
					state.currency,
					state.total
				] })
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: ROOT_STYLE,
				children: [content, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: refresh,
					title: "刷新余额",
					"aria-label": "刷新余额",
					style: BUTTON_STYLE,
					children: "⟳"
				})]
			});
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