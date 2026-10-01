/** Never put configured RPC credentials or signing material in browser/CLI diagnostics. */
export function safeError(e: unknown) {
    let message = e && typeof e === 'object' && 'shortMessage' in e ? String(e.shortMessage) : e instanceof Error ? e.message : 'Settlement failed';
    for (const key of ['SETTLEMENT_RPC', 'SETTLEMENT_DATABASE_URL', 'SETTLEMENT_RELAYER_KEY']) {
        const secret = process.env[key];
        if (secret) {
            message = message.split(secret).join('[redacted]');
            try {
                const u = new URL(secret);
                if (u.password)
                    message = message.split(u.password).join('[redacted]');
                for (const value of u.searchParams.values())
                    if (value.length > 4)
                        message = message.split(value).join('[redacted]');
            }
            catch { }
        }
    }
    return message.slice(0, 600);
}
