import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { runImport } from './importLink';
import { useGate, sendLoginLink, signOutAndClear } from './sync';
import './style.css';

runImport();

function Login() {
    const [email, setEmail] = useState('');
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);
    return <div className="app">
        <div className="card" style={{ marginTop: 40 }}>
            <h2>Sign in</h2>
            <p className="small">Your charts are private. Enter your email and tap the sign-in link that arrives. No password needed.</p>
            <label className="fld"><span>Email</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
            <button className="btn primary" disabled={busy || !email.includes('@')} onClick={async () => { setBusy(true); setMsg(await sendLoginLink(email.trim())); setBusy(false); }}>{busy ? 'Sending...' : 'Send sign-in link'}</button>
            {msg && <p className="small">{msg}</p>}
        </div>
    </div>;
}

function ConfigError() {
    return <div className="app"><div className="card" style={{ marginTop: 40 }}>
        <h2>Unavailable</h2>
        <p className="small">This installation is not configured correctly. No data is shown or stored here.</p>
    </div></div>;
}

function Gate() {
    const g = useGate();
    if (g.kind === 'config-error') return <ConfigError />;
    if (g.kind === 'loading') return <div className="app"><p className="empty">Loading...</p></div>;
    if (g.kind === 'login') return <Login />;
    return <>
        {g.kind === 'ready' && <div className="syncbar">
            <span>Signed in · charts sync to your private cloud</span>
            <button className="btn" onClick={async () => { await signOutAndClear(); location.reload(); }}>Sign out</button>
        </div>}
        <App />
    </>;
}

createRoot(document.getElementById('root')!).render(<Gate />);
