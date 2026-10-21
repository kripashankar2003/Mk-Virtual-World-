import { useEffect, useRef, useState } from 'react';
import { verifyAppLockPassword, clearAppLock } from '@/lib/appLock';
import { logOut } from '@/lib/firebaseService';
import { AlertCircle, ArrowLeft, KeyRound, Loader2, LockKeyhole } from 'lucide-react';

const logo = '/Screenshot_2026-06-11-20-43-00-14_99c04817c0de5652397fc8b56c3b3817.jpg';

export function LockScreen({ onUnlocked, onForgot }: { onUnlocked: () => void; onForgot: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = async () => {
    setError('');
    if (!password) { setError('Enter your app password.'); return; }
    setBusy(true);
    try {
      const ok = await verifyAppLockPassword(password);
      if (ok) { onUnlocked(); }
      else { setError('Incorrect password. Try again.'); setPassword(''); inputRef.current?.focus(); }
    } catch {
      setError('Unable to verify. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async () => {
    setBusy(true);
    try {
      clearAppLock();
      await logOut();
      onForgot();
    } catch {
      setError('Unable to reset. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <div className="lock-brand">
          <img src={logo} alt="MK Virtual World" />
          <span>MK</span>
        </div>
        <div className="lock-icon"><LockKeyhole size={26} /></div>
        <h1>App Locked</h1>
        <p>Enter your app password to continue.</p>

        {!showForgot ? (
          <>
            <form className="auth-form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
              <label>Password
                <input ref={inputRef} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter app password" autoComplete="off" />
              </label>
              {error && <div className="form-error"><AlertCircle size={14} /> {error}</div>}
              <button className="primary-button" type="submit" disabled={busy || !password}>
                {busy ? <><Loader2 size={16} className="spin" /> Unlocking...</> : <>Unlock</>}
              </button>
            </form>
            <button className="forgot-link" type="button" onClick={() => { setShowForgot(true); setError(''); }}>Forgot app password?</button>
          </>
        ) : (
          <div className="lock-forgot">
            <div className="lock-forgot-icon"><KeyRound size={22} /></div>
            <strong>Reset app lock?</strong>
            <p>This will sign you out and remove the app lock. You will need to log in again with your account password.</p>
            <button className="primary-button" type="button" onClick={() => void handleForgot()} disabled={busy}>
              {busy ? <><Loader2 size={16} className="spin" /> Resetting...</> : <>Reset & sign out</>}
            </button>
            <button className="back-button" type="button" onClick={() => { setShowForgot(false); setError(''); }}><ArrowLeft size={16} /> Back</button>
          </div>
        )}
      </div>
    </div>
  );
}
