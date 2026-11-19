// Pure sync-merge decision logic, unit-tested in scripts/test-merge.mjs.

const TRACKER_KEY = /^(idx|p|h)\.(?:.+\.)?v1$/;

export type RemoteRow = { key: string; value: unknown; updated_at: string };
export type MergePlan = {
    localWrites: Record<string, string>;  // remote -> local (remote newer, or key missing locally)
    pushRaw: Record<string, string>;      // local -> remote (local newer or unknown-age)
    metaUpdates: Record<string, string>;
};

// Pure merge decision, unit-tested. Rules:
// - remote row wins when local is absent or known-older (meta timestamp)
// - a local key with NO timestamp (fresh import, or charts saved before sync
//   existed) is treated as newest and pushed UP, never clobbered
// - local keys missing remotely are pushed up (first sign-in on a used phone)
export function planMerge(
    localEntries: Record<string, string | null>,
    meta: Record<string, string>,
    remoteRows: RemoteRow[],
): MergePlan {
    const plan: MergePlan = { localWrites: {}, pushRaw: {}, metaUpdates: {} };
    const remote = new Map<string, RemoteRow>();
    for (const row of remoteRows) if (TRACKER_KEY.test(row.key)) remote.set(row.key, row);
    const now = new Date().toISOString();

    for (const [k, row] of remote) {
        const localTs = meta[k];
        const localRaw = localEntries[k] ?? null;
        if (localRaw == null || (localTs && new Date(row.updated_at).getTime() > new Date(localTs).getTime())) {
            plan.localWrites[k] = JSON.stringify(row.value);
            plan.metaUpdates[k] = row.updated_at;
        }
    }
    for (const [k, raw] of Object.entries(localEntries)) {
        if (raw == null || !TRACKER_KEY.test(k)) continue;
        const row = remote.get(k);
        const localTs = plan.metaUpdates[k] ?? meta[k];
        const localNewer = localTs && row && new Date(localTs).getTime() > new Date(row.updated_at).getTime();
        if (plan.localWrites[k] !== undefined) continue; // remote already won this key
        if (!row || localNewer || !localTs) {
            if (!localTs) plan.metaUpdates[k] = now;
            plan.pushRaw[k] = raw;
        }
    }
    return plan;
}

