# dsh-balance

[English](README.md) | 中文

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件：为 Web GUI 添加 `/balance` 斜杠命令和对话框底部常驻的余额显示，实时查询 DeepSeek 账户余额。

它调用 DeepSeek 官方 [查询余额](https://api-docs.deepseek.com/zh-cn/api/get-user-balance/) 接口，返回每种货币的总额、充值与赠送余额。API key 通过凭证服务（`ctx.credentials`）或环境变量按次解析——绝不写入配置、返回文本或进入浏览器。

## 功能

- `/balance` — 人用斜杠命令，在会话里输出完整的余额明细。
- **Web GUI 底部余额条** — 对话页统计条区域（缓存命中率下方）显示简洁的 `余额: ¥…`，hover 显示充值/赠送详情，附带 **充值** 链接（跳转 DeepSeek 平台充值页）、手动刷新按钮，以及估算的 **本会话 ≈ ¥…** 花费（hover 显示 token 分桶 × 单价）。浏览器只请求宿主端的 `/dsh-balance` 路由；API key 始终留在宿主端。文案双语，跟随 dsh 当前语言（中文 / English）。
- **每日消耗图** — `近{days}天 ≈ ¥…` 开关就地展开一张内联 SVG 柱状图，展示最近 `usageDays` 天的估算花费（hover 柱子显示日期与金额）。数据来自宿主端 `/dsh-usage` 路由：遍历已持久化的会话，折叠 `assistant/message` 的用量，并按每次请求发生时所在的时段单独计价。

## 会话花费估算

`本会话 ≈ ¥…` 按 DeepSeek 公布的每百万 token 单价（高峰/空闲分档，按当前北京时间自动选择），对会话累计 token 用量计价——数据源与统计条「缓存命中率」用的是同一个 `tokenUsage` 投影。这是**估算值，不是账单记录**：模型取配置的 `estimateModel`（而非每个请求实际使用的模型），缓存写入 token 不计价。价格可通过 `offpeakPrices` / `peakMultiplier` / `peakWindows` 配置项调整。

## 兼容性

已在 DeepSeek Harness `0.1.0-rc.6`（web profile，Windows 11）上实测通过——`/balance` 命令与对话框底部余额条均于 2026-08-14 在线验证。npm 上的 `@deepseek-ai/dsh-*` 包处于 pre-release（无兼容性承诺）；若新版 dsh 改变了 `conversation.composer.dock` 槽位或 `webServer` 服务，请重新验证并提交 issue。

## 安装

### 方式 A：`dsh plugin`（推荐）

推送后执行：

```sh
dsh plugin --profile web add github:deepforce/dsh-balance
```

把 `github:deepforce/dsh-balance` 换成你的实际 git 地址。该 bundle 同时安装两部分：宿主端插件（斜杠命令 + `/dsh-balance` 路由）和浏览器端底部余额条插件（因为包声明了 `dsh.client`）。安装后**重启 `dsh web`**，让客户端插件表扫描到新条目。

### 方式 B：`--patch` overlay

```yaml
# balance.cordis.yml
- insert:
    - id: balance
      name: '@deepforce/dsh-balance'
```

```sh
dsh web --patch "$PWD/balance.cordis.yml"
```

## 配置

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `apiKeyEnv` | `DEEPSEEK_API_KEY` | 凭证引用（环境变量名），每次调用解析 |
| `baseURL` | `https://api.deepseek.com` | API 端点基础地址 |
| `timeoutMs` | `10000` | 单次请求超时（毫秒） |
| `estimateModel` | `deepseek-v4-flash` | 会话花费估算使用的模型 |
| `offpeakPrices` | `{input: 1.5, cacheHit: 0.05, output: 4.5}` | 空闲时段每百万 token 单价（CNY：未缓存输入 / 缓存命中 / 输出） |
| `peakMultiplier` | `2` | 高峰时段相对空闲价格的倍数 |
| `peakWindows` | `[[9,12],[14,18]]` | 北京时间高峰时段，格式 `[开始小时, 结束小时)` |
| `topUpUrl` | `https://platform.deepseek.com/top_up` | 底部余额条「充值」链接的目标页面 |
| `usageDays` | `7` | 每日消耗图默认覆盖的历史天数 |

## 用法

- 在会话输入框敲 `/balance`：

  ```
  Balance (CNY): 110.00
    Topped up: 100.00
    Granted:   10.00
  ```

- Web GUI 中，输入框下方的统计条区域显示 `余额: ¥110.00 充值 ⟳ · 本会话 ≈ ¥0.42`；hover「余额」查看充值/赠送拆分，点击 `⟳` 手动刷新。

## 安全

- `apiKeyEnv` 是凭证引用：优先通过 dsh 凭证服务解析，其次环境变量。key 从不硬编码或打印。
- 浏览器端只通过宿主端 `/dsh-balance` 路由获取公开的余额数字；key 始终留在宿主端。
- 只调用 `GET https://api.deepseek.com/user/balance`，无其他数据离开进程。

## 本地构建

```sh
pnpm install        # 依赖 pnpm-workspace.yaml 的 overrides 以绕过上游 npm 缺失包
pnpm run build      # tsc（宿主端 + 类型）→ tsdown（lib/client.js 浏览器 bundle）
pnpm run typecheck
```

上游 `@deepseek-ai` npm 版本（0.0.1-rc.1）声明了几个 npm 上不存在的依赖；`pnpm-workspace.yaml` 将它们别名到真实包，以便本仓库安装和构建。dsh 运行时从自己的依赖树解析这些包，因此这些 overrides 不影响已安装的插件。

## 许可证

MIT
