# dsh-balance

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that adds a
`/balance` slash command to a session, querying the DeepSeek account balance live.

It calls DeepSeek's official [Get User Balance](https://api-docs.deepseek.com/api/get-user-balance/)
endpoint and returns the total, topped-up, and granted balance per currency. The API key is
resolved through the credential seam (`ctx.credentials`) or the environment on every call —
it is never written into configuration or into the text returned to the UI.

## Install

### Option A: `dsh plugin` (recommended)

After pushing to GitHub:

```sh
dsh plugin --profile web add github:deepforce/dsh-balance
```

Replace `github:deepforce/dsh-balance` with your actual git URL.

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

### Local development

```sh
git clone https://github.com/deepforce/dsh-balance
cd dsh-balance
npm install
npm run build
```

## Configuration

| Field | Default | Meaning |
| --- | --- | --- |
| `apiKeyEnv` | `DEEPSEEK_API_KEY` | Credential reference (environment-variable name), resolved per call |
| `baseURL` | `https://api.deepseek.com` | API endpoint base |
| `timeoutMs` | `10000` | Per-request timeout in milliseconds |

## Usage

Type in the session composer:

```
/balance
```

Output looks like:

```
Balance (CNY): 110.00
  Topped up: 100.00
  Granted:   10.00
```

## Security

- `apiKeyEnv` is a credential reference: resolved through the dsh credential service first,
  then the environment. The key is never hard-coded or printed.
- Only `GET https://api.deepseek.com/user/balance` is called; no other data leaves the process.
- This is a human-only command (`recordInput: false`): it never enters model context.

## Build

```sh
npm run build       # tsc emits to lib/
npm run typecheck
```

## License

MIT