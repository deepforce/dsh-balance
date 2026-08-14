# dsh-balance

English | [中文](README.zh.md)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that adds a
`/balance` slash command and a composer-dock balance readout to the web GUI, querying the
DeepSeek account balance live.

It calls DeepSeek's official [Get User Balance](https://api-docs.deepseek.com/api/get-user-balance/)
endpoint and returns the total, topped-up, and granted balance per currency. The API key is
resolved through the credential seam (`ctx.credentials`) or the environment on every call —
it is never written into configuration, into the returned text, or into the browser.

## Features

- `/balance` — human slash command that prints the full balance breakdown in the session.
- **Web GUI readout** — the conversation stats area (below the cache-hit figure) shows a
  compact `余额: ¥…` line with hover details (topped-up / granted), a **充值** link to the
  DeepSeek platform top-up page, a manual refresh button, and an estimated **本会话 ≈ ¥…**
  spend figure (hover shows the token buckets × unit prices). The readout copy is
  bilingual and follows the active dsh language (中文 / English). The browser fetches the
  host's `/dsh-balance` route; the API key never leaves the host.

## Session-cost estimate

The `本会话 ≈ ¥…` figure prices the session's cumulative token usage — the same
`tokenUsage` projection the cache-hit stat reads — at DeepSeek's published per-million-token
rates (peak/off-peak, selected by the current Beijing time). It is an **estimate, not a
billing record**: the model used is the configured `estimateModel` (not per-request model
selection), and cache-write tokens are unpriced. Prices can be adjusted through the
`offpeakPrices` / `peakMultiplier` / `peakWindows` config fields.

## Compatibility

Tested against DeepSeek Harness `0.1.0-rc.6` (web profile, Windows 11) — the `/balance`
command and the composer-dock readout were both verified live on 2026-08-14. The npm
`@deepseek-ai/dsh-*` packages are pre-release (no compatibility promise); if a newer dsh
version changes the `conversation.composer.dock` slot or the `webServer` service, re-run
the check below and file an issue.

## Install

### Option A: `dsh plugin` (recommended)

After pushing to GitHub:

```sh
dsh plugin --profile web add github:deepforce/dsh-balance
```

Replace `github:deepforce/dsh-balance` with your actual git URL. The bundle installs both
halves: the host plugin (slash command + `/dsh-balance` route) and, because the package
declares `dsh.client`, the browser-side composer-dock plugin. Restart `dsh web` after
installing so the client plugin table picks the new entry up.

### Option B: `--patch` overlay

```yaml
# balance.cordis.yml
- insert:
    - id: balance
      name: '@deepforce/dsh-balance'
```

```sh
dsh web --patch "$PWD/balance.cordis.yml"
```

## Configuration

| Field | Default | Meaning |
| --- | --- | --- |
| `apiKeyEnv` | `DEEPSEEK_API_KEY` | Credential reference (environment-variable name), resolved per call |
| `baseURL` | `https://api.deepseek.com` | API endpoint base |
| `timeoutMs` | `10000` | Per-request timeout in milliseconds |
| `estimateModel` | `deepseek-v4-flash` | Model whose prices the session-cost estimate uses |
| `offpeakPrices` | `{input: 1.5, cacheHit: 0.05, output: 4.5}` | Off-peak CNY per-million-token prices (uncached input / cache hit / output) |
| `peakMultiplier` | `2` | Peak-hour multiplier over the off-peak prices |
| `peakWindows` | `[[9,12],[14,18]]` | Beijing-time peak windows as `[startHour, endHour)` pairs |
| `topUpUrl` | `https://platform.deepseek.com/top_up` | DeepSeek platform top-up page the readout links to |

## Usage

- Type `/balance` in the session composer:

  ```
  Balance (CNY): 110.00
    Topped up: 100.00
    Granted:   10.00
  ```

- In the web GUI, the stats area under the composer shows `余额: ¥110.00 ⟳`; hover reveals
  the topped-up / granted split, and the ⟳ button refreshes.

## Security

- `apiKeyEnv` is a credential reference: resolved through the dsh credential service first,
  then the environment. The key is never hard-coded or printed.
- The browser readout only ever sees the public balance figures via the host's
  `/dsh-balance` route; the key stays on the host.
- Only `GET https://api.deepseek.com/user/balance` is called; no other data leaves the process.

## Building locally

```sh
pnpm install        # uses pnpm-workspace.yaml overrides for upstream npm gaps
pnpm run build      # tsc (node half + types) then tsdown (lib/client.js browser bundle)
pnpm run typecheck
```

The upstream `@deepseek-ai` npm release (0.0.1-rc.1) declares a few dependencies that do not
exist on npm; `pnpm-workspace.yaml` aliases them to the real packages so this repo can
install and build. The dsh runtime resolves those dependencies from its own tree, so the
overrides do not affect the installed plugin.

## License

MIT
