import { useState } from 'react';
import {
  changeAppLockPassword,
  clearAppLock,
  isPasswordValid,
  setAppLockPassword,
  setLockTiming,
  TIMING_LABELS,
  TIMING_OPTIONS,
  type LockTiming,
} from '@/lib/appLock';
import { Check, ChevronRight, Loader2, LockKeyhole, X } from 'lucide-react';

type Mode =
  | { kind: 'set' }
  | { kind: 'off'; requireCurrent: boolean }
  | { kind: 'change' }
  | { kind: 'timing' };

export function AppLockModal({ enabled, currentTiming, onClose, onEnabledChange, onTimingChange }: {
  enabled: boolean;
  currentTiming: LockTiming;
  onClose: () => void;
  onEnabledChange: (enabled: boolean) => void;
  onTimingChange: (timing: LockTiming) => void;
}) {
  const [mode, setMode] = useState<Mode>({ kind: 'set' });
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [timing, setTiming] = useState<LockTiming>(currentTiming);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const reset = () => { setCurrent(''); setNext(''); setConfirm(''); setError(''); setSuccess(''); };

  const handleSet = async () => {
    setError('');
    if (!isPasswordValid(next)) { setError('Password must be at least 4 characters, letters and numbers only.'); return; }
    if (next !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await setAppLockPassword(next, 'immediate');
      onEnabledChange(true);
      onTimingChange('immediate');
      setSuccess('App Lock is now on.');
      setTimeout(onClose, 700);
    } catch {
      setError('Unable to save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleTurnOff = async () => {
    setError('');
    if (!current) { setError('Enter your current app password.'); return; }
    setBusy(true);
    try {
      const ok = await changeAppLockPassword(current, current);
      if (!ok) { setError('Current password is incorrect.'); setBusy(false); return; }
      clearAppLock();
      onEnabledChange(false);
      setSuccess('App Lock turned off.');
      setTimeout(onClose, 700);
    } catch {
      setError('Unable to turn off. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleChange = async () => {
    setError('');
    if (!current) { setError('Enter your current app password.'); return; }
    if (!isPasswordValid(next)) { setError('New password must be at least 4 characters, letters and numbers only.'); return; }
    if (next !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const ok = await changeAppLockPassword(current, next);
      if (!ok) { setError('Current password is incorrect.'); setBusy(false); return; }
      setSuccess('Password updated.');
      setTimeout(onClose, 700);
    } catch {
      setError('Unable to update. Try again.');
      setBusy(false);
    }
  };

  const handleTiming = async () => {
    setError('');
    if (!current) { setError('Enter your current app password to change timing.'); return; }
    setBusy(true);
    try {
      const ok = await setLockTiming(current, timing);
      if (!ok) { setError('Current password is incorrect.'); setBusy(false); return; }
      onTimingChange(timing);
      setSuccess('Lock timing updated.');
      setTimeout(onClose, 700);
    } catch {
      setError('Unable to update timing. Try again.');
      setBusy(false);
    }
  };

  const title = mode.kind === 'set' ? 'Set App Password'
    : mode.kind === 'off' ? 'Turn Off App Lock'
    : mode.kind === 'change' ? 'Change App Password'
    : 'Lock Timing';
  const sub = mode.kind === 'set' ? 'Choose an app password. You will need it each time you return to the app.'
    : mode.kind === 'off' ? 'Enter your current app password to turn App Lock off.'
    : mode.kind === 'change' ? 'Enter your current password, then choose a new one.'
    : 'Choose when the app should require your password.';

  return (
    <div className="photo-modal edit-profile-modal" onClick={onClose}>
      <div className="forgot-panel" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="forgot-brand"><LockKeyhole size={26} /></div>
        <span className="eyebrow">APP LOCK</span>
        <h2>{title}</h2>
        <p>{sub}</p>

        {success ? (
          <div className="forgot-done">
            <div className="forgot-done-icon"><Check size={28} /></div>
            <strong>{success}</strong>
          </div>
        ) : mode.kind === 'set' ? (
          <form className="auth-form" onSubmit={(e) => { e.preventDefault(); void handleSet(); }}>
            <label>New app password<input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Min 4 characters (letters & numbers)" autoFocus /></label>
            <label>Confirm password<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" /></label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" type="submit" disabled={busy || !next || !confirm}>{busy ? <><Loader2 size={16} className="spin" /> Saving...</> : <>Enable App Lock <ChevronRight size={18} /></>}</button>
          </form>
        ) : mode.kind === 'off' ? (
          <form className="auth-form" onSubmit={(e) => { e.preventDefault(); void handleTurnOff(); }}>
            <label>Current app password<input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Enter current password" autoFocus /></label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" type="submit" disabled={busy || !current}>{busy ? <><Loader2 size={16} className="spin" /> Turning off...</> : <>Turn off App Lock</>}</button>
          </form>
        ) : mode.kind === 'change' ? (
          <form className="auth-form" onSubmit={(e) => { e.preventDefault(); void handleChange(); }}>
            <label>Current app password<input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Enter current password" autoFocus /></label>
            <label>New app password<input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Min 4 characters (letters & numbers)" /></label>
            <label>Confirm new password<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter new password" /></label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" type="submit" disabled={busy || !current || !next || !confirm}>{busy ? <><Loader2 size={16} className="spin" /> Updating...</> : <>Update password <ChevronRight size={18} /></>}</button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={(e) => { e.preventDefault(); void handleTiming(); }}>
            <label>Current app password<input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Enter current password" autoFocus /></label>
            <div className="timing-options">
              {TIMING_OPTIONS.map((opt) => (
                <button type="button" key={opt} className={timing === opt ? 'timing-option active' : 'timing-option'} onClick={() => setTiming(opt)}>
                  <span>{TIMING_LABELS[opt]}</span>
                  {timing === opt && <Check size={16} />}
                </button>
              ))}
            </div>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" type="submit" disabled={busy || !current}>{busy ? <><Loader2 size={16} className="spin" /> Saving...</> : <>Save timing <ChevronRight size={18} /></>}</button>
          </form>
        )}

        {enabled && !success && (
          <div className="applock-shortcuts">
            {mode.kind !== 'change' && <button type="button" className="shortcut-link" onClick={() => { reset(); setMode({ kind: 'change' }); }}>Change password</button>}
            {mode.kind !== 'timing' && <button type="button" className="shortcut-link" onClick={() => { reset(); setTiming(currentTiming); setMode({ kind: 'timing' }); }}>Lock timing: {TIMING_LABELS[currentTiming]}</button>}
            {mode.kind !== 'off' && <button type="button" className="shortcut-link danger" onClick={() => { reset(); setMode({ kind: 'off', requireCurrent: true }); }}>Turn off App Lock</button>}
          </div>
        )}
      </div>
    </div>
  );
}
