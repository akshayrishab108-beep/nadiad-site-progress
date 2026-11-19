import { useEffect, useRef, useState } from 'react';

// localStorage-backed replacement for the hosted viewer's useLocalState.
// Same signature: [value, setValue, { ready, message }].
export function useLocalState<T>(key: string, initial: T): [T, (v: T) => void, { ready: boolean; message: string }] {
    const [value, setValue] = useState<T>(initial);
    const [ready, setReady] = useState(false);
    const [message, setMessage] = useState('');
    const loaded = useRef(false);
    useEffect(() => {
        try {
            const raw = localStorage.getItem(key);
            if (raw != null) setValue(JSON.parse(raw));
            setMessage('Saved on this phone');
        } catch {
            setMessage('Not saved. Changes last only while this page is open.');
        }
        loaded.current = true;
        setReady(true);
    }, [key]);
    const set = (v: T) => {
        setValue(v);
        if (!loaded.current) return;
        try { localStorage.setItem(key, JSON.stringify(v)); setMessage('Saved on this phone'); }
        catch { setMessage('Not saved. Changes last only while this page is open.'); }
    };
    return [value, set, { ready, message }];
}
