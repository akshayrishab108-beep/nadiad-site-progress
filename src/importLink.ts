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

// Inline confirm, not window.confirm: a native confirm blocks the page and is
// a poor experience on phones. Same rule: never overwrite without a tap.
function askInline(message: string): Promise<boolean> {
    return new Promise(resolve => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;inset:0;background:rgba(15,18,25,.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:24px';
        const card = document.createElement('div');
        card.style.cssText = 'background:#fff;color:#14181f;border-radius:14px;padding:20px;max-width:360px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.25)';
        const p = document.createElement('p');
        p.textContent = message;
        p.style.cssText = 'margin:0 0 16px;font:15px/1.45 system-ui,sans-serif';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end';
        const mk = (label: string, primary: boolean) => {
            const b = document.createElement('button');
            b.textContent = label;
            b.style.cssText = 'min-height:44px;padding:0 16px;border-radius:10px;font:600 14px system-ui,sans-serif;border:1px solid ' + (primary ? '#14181f' : '#c8ccd4') + ';background:' + (primary ? '#14181f' : '#fff') + ';color:' + (primary ? '#fff' : '#14181f');
            return b;
        };
        const no = mk('Cancel', false);
        const yes = mk('Import', true);
        const done = (v: boolean) => { wrap.remove(); resolve(v); };
        no.onclick = () => done(false);
        yes.onclick = () => done(true);
        row.append(no, yes);
        card.append(p, row);
        wrap.append(card);
        document.body.append(wrap);
    });
}

export function runImport(): void {
    void (async () => {
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
            if (!(await askInline(`Import chart "${data.name || 'My site'}"? This replaces the chart currently saved on this phone.`))) return;
        }
        localStorage.setItem('idx.v1', JSON.stringify({ list: [{ id, name: data.name || 'My site' }], active: id }));
        localStorage.setItem('p.' + id + '.v1', next);
        localStorage.setItem('h.' + id + '.v1', JSON.stringify({ snaps: [] }));
        // State was written outside React: reload so every store picks it up.
        location.reload();
    } catch { /* ignore invalid import links */ }
    })();
}
