// set-owner-password — ONE-TIME bootstrap function.
// Sets the owner account's password exactly once, then this function is
// deleted. Guards: a random SETUP_TOKEN function secret, a hardcoded expiry,
// a single exact user id, and a small attempt budget. Delete after use.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPIRES_AT = 0; // epoch ms — set at deploy time (e.g. Date.now() + 6h)
const MAX_ATTEMPTS = 5;
let attempts = 0;

const ALLOW_ORIGIN = 'https://akshayrishab108-beep.github.io';
function cors(extra: Record<string, string> = {}) {
    return {
        'Access-Control-Allow-Origin': ALLOW_ORIGIN,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-setup-token',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        ...extra,
    };
}
function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: cors({ 'Content-Type': 'application/json' }) });
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors() });
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
    if (!EXPIRES_AT || Date.now() > EXPIRES_AT) return json({ error: 'expired' }, 410);
    if (++attempts > MAX_ATTEMPTS) return json({ error: 'too many attempts' }, 429);

    const token = req.headers.get('x-setup-token') || '';
    const expected = Deno.env.get('SETUP_TOKEN') || '';
    const ownerUid = Deno.env.get('OWNER_UID') || '';
    if (!expected || token !== expected) return json({ error: 'forbidden' }, 403);

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    let body: { password?: string } = {};
    try { body = await req.json(); } catch { return json({ error: 'bad request' }, 400); }
    const pw = body.password || '';
    if (pw.length < 8 || pw.length > 128) return json({ error: 'password must be 8-128 characters' }, 400);

    const { error } = await admin.auth.admin.updateUserById(ownerUid, { password: pw });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
});
