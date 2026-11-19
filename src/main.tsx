import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { runImport } from './importLink';
import { useGate, sendLoginLink, signInWithPassword, signOutAndClear } from './sync';
import './style.css';

runImport();

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);
    const [linkMode, setLinkMode] = useState(false);
    const signIn = async () => {
        setBusy(true);
        const err = await signInWithPassword(email.trim(), password);
        if (err) setMsg(err);
        setBusy(false);
    };
    return <div className="app">
        <div className="card" style={{ marginTop: 40 }}>
            <h2>Sign in</h2>
            <p className="small">Your charts are private. Your login name is your email address.</p>
            <label className="fld"><span>Email (login name)</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
            {!linkMode && <>
                <label className="fld"><span>Password</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" /></label>
                <button className="btn primary" disabled={busy || !email.includes('@') || !password} onClick={signIn}>{busy ? 'Signing in...' : 'Sign in'}</button>
                <p className="small"><button className="linkbtn" onClick={() => { setLinkMode(true); setMsg(''); }}>Email me a sign-in link instead</button></p>
            </>}
            {linkMode && <>
                <p className="small">Tap the button, then open the email on this phone and tap the link. Sign-in emails are limited to about 2 per hour.</p>
                <button className="btn primary" disabled={busy || !email.includes('@')} onClick={async () => { setBusy(true); setMsg(await sendLoginLink(email.trim())); setBusy(false); }}>{busy ? 'Sending...' : 'Send sign-in link'}</button>
                <p className="small"><button className="linkbtn" onClick={() => { setLinkMode(false); setMsg(''); }}>Back to password sign-in</button></p>
            </>}
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
