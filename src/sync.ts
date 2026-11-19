import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { planMerge, RemoteRow } from './merge';

// Optional cloud sync. When VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set at
// build time, the app gates on an email magic-link login and mirrors the
// localStorage tracker keys to a private per-user table.
// Hosted production builds also set VITE_REQUIRE_SYNC=true: if the backend
// config is missing there, the app fails closed (error screen) instead of
// silently running in unauthenticated local-only mode. Plain `npm run build`
// without any env stays local-only for development.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const requireSync = (import.meta.env.VITE_REQUIRE_SYNC as string | undefined) === 'true';
export const syncEnabled = Boolean(url && anon);
export const configError = requireSync && !syncEnabled;
export const sb: SupabaseClient | null = syncEnabled ? createClient(url!, anon!) : null;

// Only tracker state keys sync. Nothing else in localStorage leaves the device.
const TRACKER_KEY = /^(idx|p|h)\.(?:.+\.)?v1$/;
const META_KEY = 'sync.meta.v1'; // key -> ISO timestamp of last local write

let uid: string | null = null;
let hydrating = false;
const pending = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let origSet: typeof localStorage.setItem | null = null;

function metaRead(): Record<string, string> {
    try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; }
}
function metaWrite(m: Record<string, string>) {
    origSet ? origSet.call(localStorage, META_KEY, JSON.stringify(m)) : localStorage.setItem(META_KEY, JSON.stringify(m));
}

// Wraps localStorage.setItem so every tracker-state write is queued for cloud
// upsert (debounced). Call once, after sign-in.
export function installWriteThrough(userId: string) {
    if (!sb || origSet) return;
    uid = userId;
    origSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k: string, v: string) {
        origSet!(k, v);
        if (!hydrating && uid && TRACKER_KEY.test(k)) {
            const m = metaRead();
            m[k] = new Date().toISOString();
            metaWrite(m);
            pending.set(k, v);
            if (timer) clearTimeout(timer);
            timer = setTimeout(flush, 800);
        }
    };
}

async function flush(): Promise<void> {
    if (!sb || !uid || pending.size === 0) return;
    const meta = metaRead();
    const rows = [...pending.entries()].map(([k, v]) => {
        try { return { user_id: uid as string, key: k, value: JSON.parse(v), updated_at: meta[k] || new Date().toISOString() }; }
        catch { return null; }
    }).filter(Boolean) as { user_id: string; key: string; value: unknown; updated_at: string }[];
    const { error } = await sb.from('tracker_kv').upsert(rows);
    if (error) return; // keep entries queued; retried on next write or sign-in
    pending.clear();
}

// Merges cloud and local state before the app renders, per planMerge.
// FAIL CLOSED: returns false when the cloud read cannot be completed (network
// error, transient 5xx, empty-but-erroring response), after retries. The gate
// must not mount the app on false — mounting unhydrated once let a pristine
// default project overwrite a populated cloud.
export async function hydrateFromCloud(): Promise<boolean> {
    if (!sb || !uid) return true; // local-only build: nothing to hydrate
    for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 900 * attempt));
        try {
            const { data, error } = await sb.from('tracker_kv').select('key,value,updated_at');
            if (error || !data) continue;
            hydrating = true;
            try {
                const meta = metaRead();
                const localEntries: Record<string, string | null> = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && TRACKER_KEY.test(k)) localEntries[k] = localStorage.getItem(k);
                }
                const plan = planMerge(localEntries, meta, data as RemoteRow[]);
                for (const [k, v] of Object.entries(plan.localWrites)) origSet!(k, v);
                Object.assign(meta, plan.metaUpdates);
                for (const [k, raw] of Object.entries(plan.pushRaw)) pending.set(k, raw);
                metaWrite(meta);
            } finally {
                hydrating = false;
            }
            await flush();
            return true;
        } catch {
            // retry
        }
    }
    return false;
}

export type GateState =
    | { kind: 'local' }        // no backend configured (development builds)
    | { kind: 'config-error' } // hosted build missing backend config: fail closed
    | { kind: 'sync-error' }   // signed in but cloud hydration failed after retries: fail closed
    | { kind: 'loading' }
    | { kind: 'login' }
    | { kind: 'ready'; session: Session };

export function useGate(): GateState {
    const [session, setSession] = useState<Session | null | 'loading'>(syncEnabled ? 'loading' : null);
    const [hydrated, setHydrated] = useState<'no' | 'ok' | 'error'>('no');
    useEffect(() => {
        if (!sb) return;
        sb.auth.getSession().then(r => setSession(r.data.session));
        const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
        return () => sub.subscription.unsubscribe();
    }, []);
    useEffect(() => {
        if (!sb || !session || typeof session === 'string') return;
        installWriteThrough(session.user.id);
        hydrateFromCloud().then(ok => setHydrated(ok ? 'ok' : 'error'));
    }, [session]);
    if (configError) return { kind: 'config-error' };
    if (!syncEnabled) return { kind: 'local' };
    if (session === 'loading') return { kind: 'loading' };
    if (!session) return { kind: 'login' };
    if (hydrated === 'error') return { kind: 'sync-error' };
    if (hydrated !== 'ok') return { kind: 'loading' };
    return { kind: 'ready', session };
}

export async function signInWithPassword(email: string, password: string): Promise<string> {
    if (!sb) return 'Sync is not configured.';
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return error ? 'Could not sign in: ' + error.message : '';
}

export async function sendLoginLink(email: string): Promise<string> {
    if (!sb) return 'Sync is not configured.';
    const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.origin + location.pathname },
    });
    return error ? 'Could not send the link: ' + error.message : 'Link sent. Open the email on this phone and tap the link.';
}

// Sign out and clear this device's cached charts, so a shared phone shows
// nothing after sign-out. Pending edits are pushed first; the cloud copy is
// the surviving record and a fresh sign-in restores it.
export async function signOutAndClear(): Promise<void> {
    await flush();
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (TRACKER_KEY.test(k) || k === META_KEY)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
    if (sb) await sb.auth.signOut();
}
