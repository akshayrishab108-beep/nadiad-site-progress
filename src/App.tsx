import React, { useEffect, useRef, useState } from 'react';
import { useLocalState } from './localState';
import { AdminPanel } from './AdminPanel';
import type { Hist, Index, Item, Loc, Project, Snap, St, Trade } from './types';

const LABEL: Record<St, string> = { r: 'Not started', o: 'WIP', g: 'Done', n: 'NA' };
const NEXT: Record<St, St> = { r: 'o', o: 'g', g: 'n', n: 'r' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const uid = () => Math.random().toString(36).slice(2, 7);
const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const prettyIso = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
};
const shortDate = () => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getFullYear()).slice(2)}`;
};

function snapOf(p: Project, d: string): Snap {
    const s: Record<string, string> = {};
    p.trades.forEach(t => t.items.forEach(it => { s[it.i] = it.s; }));
    return { d, l: p.locs.map(l => l.i).join(','), s };
}
const blankProject = (id: string, name: string): Project => ({
    id, name, date: shortDate(),
    locs: ['G-2 Floor', 'G-1 Floor', 'Ground Floor', '1st Floor', '2nd Floor', '3rd Floor', 'Terrace'].map((n, k) => ({ i: 'l' + (k + 1), n, g: 'Floor' })),
    trades: [],
});
const blankItem = (p: Project): Item => ({ i: uid(), n: 'New item', e: '', a: '', l: '', w: 'r', wn: '', r: '', s: 'r'.repeat(p.locs.length) });

function stats(items: Item[]) {
    let r = 0, o = 0, g = 0;
    items.forEach(it => { for (const c of it.s) { if (c === 'r') r++; else if (c === 'o') o++; else if (c === 'g') g++; } });
    const tot = r + o + g;
    return { r, o, g, tot, pct: tot ? Math.round((g / tot) * 100) : 0 };
}
const allItems = (p: Project) => p.trades.flatMap(t => t.items);

function TextField({ label, value, onCommit, multiline, placeholder }: { label: string; value: string; onCommit: (v: string) => void; multiline?: boolean; placeholder?: string }) {
    const [draft, setDraft] = useState(value);
    useEffect(() => { setDraft(value); }, [value]);
    const commit = () => { if (draft !== value) onCommit(draft); };
    return <label className="fld">
        <span>{label}</span>
        {multiline
            ? <textarea value={draft} rows={2} placeholder={placeholder} onChange={e => setDraft(e.target.value)} onBlur={commit} />
            : <input value={draft} placeholder={placeholder} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />}
    </label>;
}

function Confirm({ label, onYes, tone }: { label: string; onYes: () => void; tone?: string }) {
    const [ask, setAsk] = useState(false);
    useEffect(() => { if (!ask) return; const t = setTimeout(() => setAsk(false), 4000); return () => clearTimeout(t); }, [ask]);
    return <button className={'btn ' + (tone || 'danger')} onClick={() => { if (ask) { setAsk(false); onYes(); } else setAsk(true); }}>{ask ? 'Tap again to confirm' : label}</button>;
}

function Tile({ st, children, onTap, big, label }: { st: St; children?: React.ReactNode; onTap: () => void; big?: boolean; label?: string }) {
    return <button className={`tile st-${st}${big ? ' big' : ''}`} onClick={onTap} aria-label={(label ? label + ': ' : '') + LABEL[st]}>{children}</button>;
}

function Strip({ item }: { item: Item }) {
    return <span className="strip" aria-hidden="true">{item.s.split('').map((c, k) => <i key={k} className={'st-' + c} />)}</span>;
}

export function ProjectScreen({ id, initial, onRename, sync }: { id: string; initial: Project; onRename: (n: string) => void; sync: (p: Project) => void }) {
    const [p, setP, savedP] = useLocalState<Project>(`p.${id}.v1`, initial);
    const [h, setH, savedH] = useLocalState<Hist>(`h.${id}.v1`, { snaps: [] });
    const [tab, setTab] = useState<'list' | 'grid' | 'changes' | 'setup'>('list');
    const [open, setOpen] = useState<string>('');
    const [closed, setClosed] = useState<Record<string, boolean>>({});
    const ready = savedP.ready && savedH.ready;
    const booted = useRef(false);

    useEffect(() => {
        if (!ready || booted.current) return;
        booted.current = true;
        setP(p);
        const t = todayIso();
        const snaps = h.snaps;
        if (!snaps.length || snaps[snaps.length - 1].d !== t) setH({ snaps: [...snaps, snapOf(p, t)].slice(-8) });
        else setH(h);
    }, [ready]);

    useEffect(() => { sync(p); }, [p]);
    const commit = (np: Project) => { if (ready) setP(np); };
    const patchItem = (iid: string, patch: Partial<Item>) =>
        commit({ ...p, trades: p.trades.map(t => ({ ...t, items: t.items.map(it => it.i === iid ? { ...it, ...patch } : it) })) });
    const setCell = (it: Item, k: number, c: St) => patchItem(it.i, { s: it.s.slice(0, k) + c + it.s.slice(k + 1) });
    const tapCell = (it: Item, k: number) => setCell(it, k, NEXT[(it.s[k] || 'r') as St]);
    const patchTrade = (tid: string, patch: Partial<Trade>) => commit({ ...p, trades: p.trades.map(t => t.i === tid ? { ...t, ...patch } : t) });
    const moveItemTrade = (it: Item, to: string) => {
        const trades = p.trades.map(t => ({ ...t, items: t.items.filter(x => x.i !== it.i) }));
        commit({ ...p, trades: trades.map(t => t.i === to ? { ...t, items: [...t.items, it] } : t) });
    };
    const delItem = (iid: string) => { setOpen(''); commit({ ...p, trades: p.trades.map(t => ({ ...t, items: t.items.filter(x => x.i !== iid) })) }); };
    const addItem = (tid: string) => {
        const it = blankItem(p);
        commit({ ...p, trades: p.trades.map(t => t.i === tid ? { ...t, items: [...t.items, it] } : t) });
        setOpen(it.i);
        setClosed({ ...closed, [tid]: false });
    };
    const addTrade = () => {
        const t: Trade = { i: uid(), n: 'New trade', items: [] };
        commit({ ...p, trades: [...p.trades, t] });
    };
    const delTrade = (tid: string) => commit({ ...p, trades: p.trades.filter(t => t.i !== tid) });
    const moveTrade = (tid: string, dir: number) => {
        const k = p.trades.findIndex(t => t.i === tid), j = k + dir;
        if (j < 0 || j >= p.trades.length) return;
        const a = [...p.trades]; [a[k], a[j]] = [a[j], a[k]];
        commit({ ...p, trades: a });
    };
    const moveItem = (tid: string, iid: string, dir: number) => {
        const t = p.trades.find(x => x.i === tid); if (!t) return;
        const k = t.items.findIndex(x => x.i === iid), j = k + dir;
        if (j < 0 || j >= t.items.length) return;
        const a = [...t.items]; [a[k], a[j]] = [a[j], a[k]];
        patchTrade(tid, { items: a });
    };
    const patchLoc = (lid: string, patch: Partial<Loc>) => commit({ ...p, locs: p.locs.map(l => l.i === lid ? { ...l, ...patch } : l) });
    const addLoc = () => {
        const l: Loc = { i: uid(), n: 'New location', g: p.locs.length ? p.locs[p.locs.length - 1].g : 'Floor' };
        commit({ ...p, locs: [...p.locs, l], trades: p.trades.map(t => ({ ...t, items: t.items.map(it => ({ ...it, s: it.s + 'r' })) })) });
    };
    const delLoc = (lid: string) => {
        const k = p.locs.findIndex(l => l.i === lid);
        commit({ ...p, locs: p.locs.filter(l => l.i !== lid), trades: p.trades.map(t => ({ ...t, items: t.items.map(it => ({ ...it, s: it.s.slice(0, k) + it.s.slice(k + 1) })) })) });
    };
    const moveLoc = (lid: string, dir: number) => {
        const k = p.locs.findIndex(l => l.i === lid), j = k + dir;
        if (j < 0 || j >= p.locs.length) return;
        const a = [...p.locs]; [a[k], a[j]] = [a[j], a[k]];
        const swap = (s: string) => { const c = s.split(''); [c[k], c[j]] = [c[j], c[k]]; return c.join(''); };
        commit({ ...p, locs: a, trades: p.trades.map(t => ({ ...t, items: t.items.map(it => ({ ...it, s: swap(it.s) })) })) });
    };

    const all = allItems(p);
    const total = stats(all);
    const used = Math.round(JSON.stringify(p).length / 1024 * 10) / 10 + Math.round(JSON.stringify(h).length / 1024 * 10) / 10;

    // groups of locations for headings
    const groups: { g: string; from: number; n: number }[] = [];
    p.locs.forEach((l, k) => { const last = groups[groups.length - 1]; if (last && last.g === l.g) last.n++; else groups.push({ g: l.g, from: k, n: 1 }); });

    const itemEditor = (it: Item, tid: string) => <div className="editor">
        <TextField label="Item name" value={it.n} onCommit={v => patchItem(it.i, { n: v })} />
        <div className="two">
            <TextField label="Engineer" value={it.e} onCommit={v => patchItem(it.i, { e: v })} />
            <TextField label="Agency" value={it.a} onCommit={v => patchItem(it.i, { a: v })} />
        </div>
        <div className="two">
            <TextField label="Last date" value={it.l} placeholder="e.g. 30-Oct" onCommit={v => patchItem(it.i, { l: v })} />
            <TextField label="WO / PO no." value={it.wn} placeholder="optional" onCommit={v => patchItem(it.i, { wn: v })} />
        </div>
        <div className="fld"><span>WO / PO status (tap to change)</span>
            <Tile st={it.w} big onTap={() => patchItem(it.i, { w: it.w === 'r' ? 'o' : it.w === 'o' ? 'g' : 'r' })}>{it.w === 'g' ? 'WO/PO issued' : it.w === 'o' ? 'WO/PO in process' : 'WO/PO not issued'}</Tile>
        </div>
        <label className="fld"><span>Trade</span>
            <select value={tid} onChange={e => moveItemTrade(it, e.target.value)}>{p.trades.map(t => <option key={t.i} value={t.i}>{t.n}</option>)}</select>
        </label>
        <div className="fld"><span>Set every location to</span>
            <div className="quick">{(['r', 'o', 'g', 'n'] as St[]).map(c => <button key={c} className={'chip st-' + c} onClick={() => patchItem(it.i, { s: c.repeat(p.locs.length) })}>{LABEL[c]}</button>)}</div>
        </div>
        {groups.map(g => <div key={g.from} className="fld"><span>{g.g}</span>
            <div className="locgrid">{p.locs.slice(g.from, g.from + g.n).map((l, j) => {
                const k = g.from + j; const c = (it.s[k] || 'r') as St;
                return <Tile key={l.i} st={c} big label={l.n} onTap={() => tapCell(it, k)}><b>{l.n}</b><small>{LABEL[c]}</small></Tile>;
            })}</div>
        </div>)}
        <TextField label="Remark" value={it.r} multiline onCommit={v => patchItem(it.i, { r: v })} />
        <div className="row-btns">
            <button className="btn" onClick={() => setOpen('')}>Close</button>
            <Confirm label="Delete item" onYes={() => delItem(it.i)} />
        </div>
    </div>;

    const renderList = () => <div>
        <div className="legend"><span><i className="st-r" />Not started</span><span><i className="st-o" />WIP</span><span><i className="st-g" />Done</span><span><i className="st-n" />NA</span></div>
        {p.trades.map(t => {
            const ts = stats(t.items); const isClosed = closed[t.i];
            return <section key={t.i} className="trade">
                <button className="trade-h" onClick={() => setClosed({ ...closed, [t.i]: !isClosed })} aria-expanded={!isClosed}>
                    <span className="tn">{t.n}</span><span className="tp">{ts.tot ? ts.pct + '%' : '-'}</span><span className="caret">{isClosed ? '+' : '-'}</span>
                </button>
                {!isClosed && <div>
                    {t.items.map(it => {
                        const is = stats([it]); const isOpen = open === it.i;
                        return <div key={it.i} className={'item' + (isOpen ? ' open' : '')}>
                            <button className="item-h" onClick={() => setOpen(isOpen ? '' : it.i)}>
                                <span className="in">{it.n}</span>
                                <span className="im">{[it.a, it.e].filter(Boolean).join(' · ') || 'No agency set'}{it.l ? ' · ' + it.l : ''}</span>
                                <span className="ir"><Strip item={it} /><em>{is.tot ? is.pct + '%' : 'NA'}</em></span>
                            </button>
                            {isOpen && itemEditor(it, t.i)}
                        </div>;
                    })}
                    <button className="btn add" onClick={() => addItem(t.i)}>+ Add item to {t.n}</button>
                </div>}
            </section>;
        })}
        {!p.trades.length && <p className="empty">No work items yet. Go to Setup and add a trade, then add items.</p>}
    </div>;

    const renderGrid = () => <div className="gridwrap">
        <div className="hint">Tap a box to change it: red, then WIP, then done, then NA. Swipe sideways for more.</div>
        <div className="scroller"><table className="grid">
            <thead>
                <tr><th className="sticky h0" rowSpan={2}>Item</th><th rowSpan={2} className="wo"><span className="vt">WO/PO</span></th>
                    {groups.map(g => <th key={g.from} colSpan={g.n} className="grp">{g.g}</th>)}</tr>
                <tr>{p.locs.map(l => <th key={l.i} className="loc"><span className="vt">{l.n}</span></th>)}</tr>
            </thead>
            <tbody>
                {p.trades.map(t => <React.Fragment key={t.i}>
                    <tr><td className="sticky trow" colSpan={p.locs.length + 2}>{t.n}</td></tr>
                    {t.items.map(it => <tr key={it.i}>
                        <td className="sticky iname" onClick={() => { setTab('list'); setOpen(it.i); }}>{it.n}</td>
                        <td><Tile st={it.w} label={it.n + ', WO/PO'} onTap={() => patchItem(it.i, { w: it.w === 'r' ? 'g' : it.w === 'g' ? 'o' : 'r' })} /></td>
                        {p.locs.map((l, k) => { const c = (it.s[k] || 'r') as St; return <td key={l.i}><Tile st={c} label={it.n + ', ' + l.n} onTap={() => tapCell(it, k)}>{c === 'n' ? 'NA' : ''}</Tile></td>; })}
                    </tr>)}
                </React.Fragment>)}
            </tbody>
        </table></div>
    </div>;

    const prior = h.snaps.filter(s => s.d < todayIso());
    const [base, setBase] = useState<string>('');
    const baseSnap = h.snaps.find(s => s.d === base) || prior[prior.length - 1] || h.snaps[0];
    const renderChanges = () => {
        const changes: { item: string; loc: string; from: St; to: St }[] = [];
        let added = 0;
        if (baseSnap) {
            const ids = baseSnap.l.split(',');
            all.forEach(it => {
                const old = baseSnap.s[it.i];
                if (old === undefined) { added++; return; }
                p.locs.forEach((l, k) => {
                    const oi = ids.indexOf(l.i); if (oi < 0) return;
                    const a = (old[oi] || 'r') as St, b = (it.s[k] || 'r') as St;
                    if (a !== b) changes.push({ item: it.n, loc: l.n, from: a, to: b });
                });
            });
        }
        const prog = (s: Snap) => { let g = 0, tot = 0; Object.values(s.s).forEach(v => { for (const c of v) { if (c !== 'n') tot++; if (c === 'g') g++; } }); return tot ? Math.round(g / tot * 100) : 0; };
        return <div>
            <div className="card">
                <div className="fld"><span>Compare today with</span>
                    <select value={baseSnap ? baseSnap.d : ''} onChange={e => setBase(e.target.value)}>
                        {h.snaps.map(s => <option key={s.d} value={s.d}>{prettyIso(s.d)} ({prog(s)}% done)</option>)}
                    </select></div>
                {baseSnap ? <p className="big-line">Since {prettyIso(baseSnap.d)}: <b>{changes.length}</b> box{changes.length === 1 ? '' : 'es'} changed{added ? `, ${added} new item${added > 1 ? 's' : ''}` : ''}. Done: {prog(baseSnap)}% to {total.pct}%.</p> : <p>No saved days yet.</p>}
            </div>
            {changes.slice(0, 200).map((c, k) => <div key={k} className="chg"><div><b>{c.item}</b><small>{c.loc}</small></div><span className={'chip st-' + c.from}>{LABEL[c.from]}</span><span className="arrow">to</span><span className={'chip st-' + c.to}>{LABEL[c.to]}</span></div>)}
            {baseSnap && !changes.length && <p className="empty">Nothing has changed since that day.</p>}
            <div className="card">
                <p className="small">The app saves a snapshot of the chart the first time you open it each day (last 8 days are kept). Use the button below to save today's snapshot again at the end of the day.</p>
                <button className="btn" onClick={() => { if (!ready) return; const t = todayIso(); setH({ snaps: [...h.snaps.filter(s => s.d !== t), snapOf(p, t)].slice(-8) }); }}>Save today's snapshot now</button>
            </div>
        </div>;
    };

    const renderSetup = () => <div>
        <div className="card">
            <h3>This project</h3>
            <TextField label="Project name" value={p.name} onCommit={v => { commit({ ...p, name: v }); onRename(v); }} />
            <TextField label="Chart date" value={p.date} onCommit={v => commit({ ...p, date: v })} />
            <button className="btn" onClick={() => commit({ ...p, date: shortDate() })}>Set chart date to today</button>
        </div>
        <div className="card">
            <h3>Trades</h3>
            {p.trades.map((t, k) => <div key={t.i} className="setrow">
                <TextField label={`Trade ${k + 1} (${t.items.length} items)`} value={t.n} onCommit={v => patchTrade(t.i, { n: v })} />
                <div className="mini">
                    <button className="btn sm" onClick={() => moveTrade(t.i, -1)} aria-label="Move up">Up</button>
                    <button className="btn sm" onClick={() => moveTrade(t.i, 1)} aria-label="Move down">Down</button>
                    <Confirm label="Delete" onYes={() => delTrade(t.i)} />
                </div>
                {t.items.length > 1 && <details className="reorder"><summary>Reorder items</summary>
                    {t.items.map(it => <div key={it.i} className="ro"><span>{it.n}</span><button className="btn sm" onClick={() => moveItem(t.i, it.i, -1)}>Up</button><button className="btn sm" onClick={() => moveItem(t.i, it.i, 1)}>Down</button></div>)}
                </details>}
            </div>)}
            <button className="btn add" onClick={addTrade}>+ Add trade</button>
            <p className="small">Deleting a trade deletes its items too.</p>
        </div>
        <div className="card">
            <h3>Locations (floors, staircases, areas)</h3>
            <p className="small">The "Group" is the heading shown above the boxes, like Floor or Staircase.</p>
            {p.locs.map(l => <div key={l.i} className="setrow">
                <div className="two"><TextField label="Name" value={l.n} onCommit={v => patchLoc(l.i, { n: v })} /><TextField label="Group" value={l.g} onCommit={v => patchLoc(l.i, { g: v })} /></div>
                <div className="mini">
                    <button className="btn sm" onClick={() => moveLoc(l.i, -1)}>Left</button>
                    <button className="btn sm" onClick={() => moveLoc(l.i, 1)}>Right</button>
                    <Confirm label="Delete" onYes={() => delLoc(l.i)} />
                </div>
            </div>)}
            <button className="btn add" onClick={addLoc}>+ Add location</button>
            <p className="small">New locations start as Not started for every item.</p>
        </div>
        <Backup p={p} onImport={np => commit({ ...np, id: p.id })} />
        <AdminPanel />
        <p className="small">Storage used by this project: about {used} KB, saved in this phone's browser. {savedP.message}</p>
    </div>;

    return <div>
        <div className="ph">
            <div className="ph-top"><h1>{p.name}</h1><span className="date">Chart date: {p.date}</span></div>
            <div className="bar"><div className="bar-g" style={{ width: total.pct + '%' }} /></div>
            <div className="sum"><b>{total.pct}% done</b><span><i className="st-g" />{total.g}</span><span><i className="st-o" />{total.o} WIP</span><span><i className="st-r" />{total.r} to start</span></div>
        </div>
        {!ready && <p className="empty">Loading your saved chart...</p>}
        {ready && !savedP.message.toLowerCase().includes('saved') && savedP.message && <p className="warn">{savedP.message}</p>}
        <nav className="tabs">{([['list', 'Progress'], ['grid', 'Grid'], ['changes', 'Changes'], ['setup', 'Setup']] as const).map(([k, n]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{n}</button>)}</nav>
        <div className="body">
            {tab === 'list' && renderList()}
            {tab === 'grid' && renderGrid()}
            {tab === 'changes' && renderChanges()}
            {tab === 'setup' && renderSetup()}
        </div>
    </div>;
}

function Backup({ p, onImport }: { p: Project; onImport: (p: Project) => void }) {
    const [txt, setTxt] = useState('');
    const [msg, setMsg] = useState('');
    return <div className="card">
        <h3>Backup</h3>
        <p className="small">Your chart is saved on this phone. To keep a copy or move it, tap "Show backup", copy the text and keep it in Notes or WhatsApp. To restore, paste it and tap Restore.</p>
        <div className="row-btns">
            <button className="btn" onClick={() => { setTxt(JSON.stringify(p)); setMsg('Select all the text below and copy it.'); }}>Show backup</button>
            <Confirm tone="" label="Restore from text" onYes={() => {
                try { const o = JSON.parse(txt); if (!o || !Array.isArray(o.trades) || !Array.isArray(o.locs)) throw new Error('x'); onImport(o as Project); setMsg('Restored.'); } catch { setMsg('That text is not a valid backup.'); }
            }} />
        </div>
        <textarea className="bk" rows={4} value={txt} onChange={e => setTxt(e.target.value)} placeholder="Backup text appears here" />
        {msg && <p className="small">{msg}</p>}
    </div>;
}

export function App() {
    const [idx, setIdx, savedI] = useLocalState<Index>('idx.v1', { list: [{ id: 'site1', name: 'My site' }], active: 'site1' });
    const [fresh, setFresh] = useState<Record<string, Project>>({});
    const [menu, setMenu] = useState(false);
    const [newName, setNewName] = useState('');
    const [copyStruct, setCopyStruct] = useState(true);
    const bootI = useRef(false);
    const cur = useRef<Project | undefined>(undefined);
    useEffect(() => { if (savedI.ready && !bootI.current) { bootI.current = true; setIdx(idx); } }, [savedI.ready]);
    if (!savedI.ready) return <div className="app"><p className="empty">Loading...</p></div>;

    const active = idx.list.find(x => x.id === idx.active) || idx.list[0];
    const initialFor = (id: string): Project => fresh[id] || blankProject(id, idx.list.find(x => x.id === id)?.name || 'Project');
    const addProject = (sourceProj?: Project) => {
        const name = newName.trim() || 'New project';
        const id = 'p' + uid();
        let np = blankProject(id, name);
        if (copyStruct && sourceProj) {
            np = { ...sourceProj, id, name, date: shortDate(), trades: sourceProj.trades.map(t => ({ ...t, i: uid(), items: t.items.map(it => ({ ...it, i: uid(), l: '', wn: '', r: '', w: 'r' as St, s: it.s.split('').map(c => c === 'n' ? 'n' : 'r').join('') })) })) };
        }
        setFresh({ ...fresh, [id]: np });
        setIdx({ list: [...idx.list, { id, name }], active: id });
        setNewName(''); setMenu(false);
    };
    const removeProject = (id: string) => {
        if (idx.list.length < 2) return;
        const list = idx.list.filter(x => x.id !== id);
        setIdx({ list, active: list[0].id });
    };

    return <div className="app">
        <div className="proj-pick">
            <button className="pick" onClick={() => setMenu(!menu)} aria-expanded={menu}>Project: <b>{active.name}</b> <span>{menu ? 'close' : 'change'}</span></button>
            {menu && <div className="menu">
                {idx.list.map(x => <div key={x.id} className="mrow">
                    <button className={'mname' + (x.id === active.id ? ' on' : '')} onClick={() => { setIdx({ ...idx, active: x.id }); setMenu(false); }}>{x.name}</button>
                    {idx.list.length > 1 && <Confirm label="Delete" onYes={() => removeProject(x.id)} />}
                </div>)}
                <div className="newp">
                    <label className="fld"><span>New project name</span><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Site 2" /></label>
                    <label className="chk"><input type="checkbox" checked={copyStruct} onChange={e => setCopyStruct(e.target.checked)} /> Copy trades, items and locations from "{active.name}" (all reset to Not started)</label>
                    <button className="btn primary" onClick={() => addProject(cur.current)}>Create project</button>
                </div>
            </div>}
        </div>
        <ProjectScreen key={active.id} sync={q => { cur.current = q; }} id={active.id} initial={initialFor(active.id)} onRename={n => setIdx({ ...idx, list: idx.list.map(x => x.id === active.id ? { ...x, name: n } : x) })} />
    </div>;
}

