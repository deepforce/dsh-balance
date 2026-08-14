/** `balance` namespace dictionaries — the readout copy of the dsh-balance UI. */
/** Dictionary namespace owned by this plugin. */
export const NS = 'balance';
/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
    'balance.loading': '余额: …',
    'balance.unavailable': '余额: 不可用',
    'balance.label': '余额: {total}',
    'balance.none': '—',
    'balance.topUp': '充值',
    'balance.refresh': '刷新余额',
    'balance.detail': '{symbol}{total} · 充值 {symbol}{toppedUp} · 赠送 {symbol}{granted}',
    'balance.detail.unavailable': 'DeepSeek 余额不可用',
    'cost.label': '本会话 ≈ {cost}',
    'cost.detail.input': '输入 {tokens} × ¥{price}/M',
    'cost.detail.cacheHit': '缓存命中 {tokens} × ¥{price}/M',
    'cost.detail.output': '输出 {tokens} × ¥{price}/M',
    'cost.detail.tier': '时段: {tier}',
    'tier.peak': '高峰',
    'tier.offpeak': '空闲',
};
/** English dictionary, key-identical to the Chinese source of truth. */
export const en = {
    'balance.loading': 'Balance: …',
    'balance.unavailable': 'Balance: unavailable',
    'balance.label': 'Balance: {total}',
    'balance.none': '—',
    'balance.topUp': 'Top up',
    'balance.refresh': 'Refresh balance',
    'balance.detail': '{symbol}{total} · topped up {symbol}{toppedUp} · granted {symbol}{granted}',
    'balance.detail.unavailable': 'DeepSeek balance unavailable',
    'cost.label': 'Session ≈ {cost}',
    'cost.detail.input': 'input {tokens} × ¥{price}/M',
    'cost.detail.cacheHit': 'cache hit {tokens} × ¥{price}/M',
    'cost.detail.output': 'output {tokens} × ¥{price}/M',
    'cost.detail.tier': 'tier: {tier}',
    'tier.peak': 'peak',
    'tier.offpeak': 'off-peak',
};
