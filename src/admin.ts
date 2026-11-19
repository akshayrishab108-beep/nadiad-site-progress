import { sb } from './sync';

// Admin user management. All privilege checks happen server-side in the
// "admin-users" Edge Function (session JWT verified, admin allow-list held as
// a function secret). This module only calls it; no secrets here.

const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export interface AdminUserRow { id: string; email: string; created: string; last: string; }

async function adminCall(body: Record<string, unknown>): Promise<{ ok: boolean; data?: any; error?: string }> {
    if (!sb || !base || !anon) return { ok: false, error: 'Sync is not configured.' };
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return { ok: false, error: 'Not signed in.' };
    try {
        const r = await fetch(base + '/functions/v1/admin-users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token, apikey: anon },
            body: JSON.stringify(body),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return { ok: false, error: j.error || ('Request failed (' + r.status + ')') };
        return { ok: true, data: j };
    } catch (e) {
        return { ok: false, error: 'Network error reaching the admin service.' };
    }
}

export async function checkAdmin(): Promise<boolean> {
    const r = await adminCall({ action: 'whoami' });
    return Boolean(r.ok && r.data && r.data.admin);
}

export async function listUsers(): Promise<{ users?: AdminUserRow[]; error?: string }> {
    const r = await adminCall({ action: 'list' });
    return r.ok ? { users: r.data.users } : { error: r.error };
}

export async function createUser(email: string): Promise<{ email?: string; password?: string; error?: string }> {
    const r = await adminCall({ action: 'create', email });
    return r.ok ? { email: r.data.email, password: r.data.password } : { error: r.error };
}

export async function deleteUser(id: string): Promise<{ error?: string }> {
    const r = await adminCall({ action: 'delete', id });
    return r.ok ? {} : { error: r.error };
}
