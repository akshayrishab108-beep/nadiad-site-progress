import React, { useEffect, useState } from 'react';
import { checkAdmin, listUsers, createUser, deleteUser, AdminUserRow } from './admin';

// Admin panel: only visible to the server-verified admin account. Lets the
// admin create user logins with generated passwords and remove users. New
// passwords are shown exactly once, here, and must be shared privately.
export function AdminPanel() {
    const [state, setState] = useState<'loading' | 'no' | 'yes'>('loading');
    const [users, setUsers] = useState<AdminUserRow[]>([]);
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
    const [confirmDel, setConfirmDel] = useState<string | null>(null);

    const refresh = async () => {
        const r = await listUsers();
        if (r.users) setUsers(r.users); else if (r.error) setMsg(r.error);
    };

    useEffect(() => {
        (async () => {
            const ok = await checkAdmin();
            setState(ok ? 'yes' : 'no');
            if (ok) refresh();
        })();
    }, []);

    if (state !== 'yes') return null;

    const onCreate = async () => {
        setBusy(true); setMsg(''); setCreated(null);
        const r = await createUser(email.trim());
        setBusy(false);
        if (r.error) { setMsg(r.error); return; }
        setCreated({ email: r.email!, password: r.password! });
        setEmail('');
        refresh();
    };

    const onDelete = async (id: string) => {
        setBusy(true); setMsg('');
        const r = await deleteUser(id);
        setBusy(false);
        setConfirmDel(null);
        if (r.error) { setMsg(r.error); return; }
        refresh();
    };

    return <div className="card">
        <h3>Admin · user logins</h3>
        <p className="small">Create a login for each person who should use this app. Each login gets its own private charts; nobody sees anyone else's data. Share a new password privately — it is shown once and cannot be recovered here.</p>
        <label className="fld"><span>New user's email (their login name)</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="person@example.com" autoComplete="off" /></label>
        <button className="btn primary" disabled={busy || !email.includes('@')} onClick={onCreate}>{busy ? 'Working...' : 'Create login + generate password'}</button>
        {created && <div className="pw-once">
            <p className="small"><b>Login created.</b> Give these details to {created.email} privately:</p>
            <p className="big-line">Login name: {created.email}<br />Password: <code className="pw">{created.password}</code></p>
            <button className="btn sm" onClick={() => { navigator.clipboard?.writeText('Login: ' + created.email + '\nPassword: ' + created.password).catch(() => {}); }}>Copy</button>
            <button className="btn sm" onClick={() => setCreated(null)}>Done, hide it</button>
        </div>}
        {msg && <p className="small">{msg}</p>}
        <div className="setrow">
            <h3>Existing logins</h3>
            {users.map(u => <div key={u.id} className="ro">
                <span>{u.email}{u.last ? ' · last used ' + new Date(u.last).toLocaleDateString() : ''}</span>
                {confirmDel === u.id ? <>
                    <button className="btn sm danger" disabled={busy} onClick={() => onDelete(u.id)}>Yes, delete</button>
                    <button className="btn sm" onClick={() => setConfirmDel(null)}>Keep</button>
                </> : <button className="btn sm" onClick={() => setConfirmDel(u.id)}>Delete</button>}
            </div>)}
        </div>
    </div>;
}
