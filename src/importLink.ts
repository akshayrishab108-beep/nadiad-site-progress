// One-time private import: opening the site with #import=<base64url project JSON>
// loads a chart onto this device. The link itself contains the private chart:
// anyone who has it can read it, so it must only travel in private chat and
// must never be sent to third-party URL processors or public paste tools.
const MAX_CHARS = 300000; // ~225 KB decoded; a full chart is well under 50 KB

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length <= 500;

function validProject(o: any): boolean {
    if (!o || typeof o !== 'object') return false;
    if (!Array.isArray(o.locs) || !Array.isArray(o.trades)) return false;
    if (o.locs.length > 60 || o.trades.length > 60) return false;
    if (o.name !== undefined && !isStr(o.name)) return false;
    if (o.date !== undefined && !isStr(o.date)) return false;
    for (const l of o.locs) {
        if (!l || !isStr(l.i) || !isStr(l.n) || !isStr(l.g)) return false;
    }
    for (const t of o.trades) {
        if (!t || !isStr(t.i) || !isStr(t.n) || !Array.isArray(t.items) || t.items.length > 200) return false;
        for (const it of t.items) {
            if (!it || !isStr(it.i) || !isStr(it.n) || !isStr(it.e) || !isStr(it.a) || !isStr(it.l) || !isStr(it.wn) || !isStr(it.r)) return false;
            if (typeof it.s !== 'string' || it.s.length > 60 || !/^[rogn]*$/.test(it.s)) return false;
            if (typeof it.w !== 'string' || !/^[rog]$/.test(it.w)) return false;
        }
    }
    return true;
}

export function runImport(): void {
    try {
        const h = window.location.hash;
        if (!h.startsWith('#import=')) return;
        // Strip the fragment first so the private data does not linger in the address bar or history.
        history.replaceState(null, '', location.pathname + location.search);
        const enc = h.slice(8);
        if (!enc.length || enc.length > MAX_CHARS) return;
        const b64 = enc.replace(/-/g, '+').replace(/_/g, '/');
        const data = JSON.parse(decodeURIComponent(escape(atob(b64))));
        if (!validProject(data)) return;
        const id = 'site1';
        const next = JSON.stringify({ ...data, id });
        const existing = localStorage.getItem('p.' + id + '.v1');
        if (existing && existing !== next) {
            if (!window.confirm(`Import chart "${data.name || 'My site'}"? This replaces the chart currently saved on this phone.`)) return;
        }
        localStorage.setItem('idx.v1', JSON.stringify({ list: [{ id, name: data.name || 'My site' }], active: id }));
        localStorage.setItem('p.' + id + '.v1', next);
        localStorage.setItem('h.' + id + '.v1', JSON.stringify({ snaps: [] }));
    } catch { /* ignore invalid import links */ }
}
