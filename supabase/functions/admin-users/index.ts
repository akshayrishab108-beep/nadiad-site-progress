// admin-users Edge Function
// Server-side admin user management for the site progress tracker.
// Privilege model: caller must present a valid session JWT and its user ID
// must match the ADMIN_UID function secret. No client-supplied role data is
// trusted. The service role key never leaves this function.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOW_ORIGIN = 'https://akshayrishab108-beep.github.io';

function cors(extra: Record<string, string> = {}) {
    return {
        'Access-Control-Allow-Origin': ALLOW_ORIGIN,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        ...extra,
    };
}
function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: cors({ 'Content-Type': 'application/json' }) });
}
function genPassword(len = 14): string {
    const sets = ['abcdefghjkmnpqrstuvwxyz', 'ABCDEFGHJKMNPQRSTUVWXYZ', '23456789'];
    const all = sets.join('');
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    let out = sets.map(s => s[Math.floor(Math.random() * s.length)]).join('');
    for (let i = out.length; i < len; i++) out += all[bytes[i] % all.length];
    return out.split('').sort(() => (crypto.getRandomValues(new Uint8Array(1))[0] % 3) - 1).join('');
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors() });
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    const adminUid = Deno.env.get('ADMIN_UID');
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!adminUid || !url || !serviceKey) return json({ error: 'server not configured' }, 500);

    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'not signed in' }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
    if (authErr || !user) return json({ error: 'not signed in' }, 401);
    if (user.id !== adminUid) return json({ error: 'not an admin' }, 403, );

    let body: { action?: string; email?: string; id?: string } = {};
    try { body = await req.json(); } catch { return json({ error: 'bad request' }, 400); }

    if (body.action === 'whoami') return json({ admin: true });

    if (body.action === 'list') {
        const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
        if (error) return json({ error: error.message }, 400);
        return json({ users: data.users.map(u => ({ id: u.id, email: u.email || '', created: u.created_at, last: u.last_sign_in_at || null })) });
    }

    if (body.action === 'create') {
        const email = (body.email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'invalid email' }, 400);
        const password = genPassword();
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (error) return json({ error: error.message }, 400);
        return json({ email: data.user.email, password });
    }

    if (body.action === 'delete') {
        if (!body.id) return json({ error: 'missing id' }, 400);
        if (body.id === adminUid) return json({ error: 'the admin login cannot be deleted' }, 400);
        const { error } = await admin.auth.admin.deleteUser(body.id);
        if (error) return json({ error: error.message }, 400);
        return json({ deleted: true });
    }

    return json({ error: 'unknown action' }, 400);
});
