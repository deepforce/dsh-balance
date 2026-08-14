/** `balance` namespace dictionaries — the readout copy of the dsh-balance UI. */
/** Dictionary namespace owned by this plugin. */
export declare const NS = "balance";
/** Simplified Chinese dictionary (the key-set source of truth). */
export declare const zh: {
    readonly 'balance.loading': "余额: …";
    readonly 'balance.unavailable': "余额: 不可用";
    readonly 'balance.label': "余额: {total}";
    readonly 'balance.none': "—";
    readonly 'balance.topUp': "充值";
    readonly 'balance.refresh': "刷新余额";
    readonly 'balance.detail': "{symbol}{total} · 充值 {symbol}{toppedUp} · 赠送 {symbol}{granted}";
    readonly 'balance.detail.unavailable': "DeepSeek 余额不可用";
    readonly 'cost.label': "本会话 ≈ {cost}";
    readonly 'cost.detail.input': "输入 {tokens} × ¥{price}/M";
    readonly 'cost.detail.cacheHit': "缓存命中 {tokens} × ¥{price}/M";
    readonly 'cost.detail.output': "输出 {tokens} × ¥{price}/M";
    readonly 'cost.detail.tier': "时段: {tier}";
    readonly 'tier.peak': "高峰";
    readonly 'tier.offpeak': "空闲";
    readonly 'usage.summary': "近{days}天 ≈ {cost}";
    readonly 'usage.title': "每日消耗";
    readonly 'usage.loading': "加载中…";
    readonly 'usage.empty': "近 {days} 天无消耗";
    readonly 'usage.error': "消耗数据不可用";
    readonly 'usage.day': "{date} · ¥{cost}";
};
/** English dictionary, key-identical to the Chinese source of truth. */
export declare const en: Record<BalanceKey, string>;
/** Key domain of the `balance` namespace (zh is the source of truth). */
export type BalanceKey = keyof typeof zh;
