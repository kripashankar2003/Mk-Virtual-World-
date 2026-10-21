import { useEffect, useRef, useState } from 'react';
import {
  findProfileForRecovery,
  startPhoneVerification,
  updateCurrentUserPassword,
  verifyPhoneOtp,
  type ConfirmationResult,
} from '@/lib/firebaseService';
import { ArrowLeft, Check, ChevronRight, KeyRound, Loader2, RefreshCw, ShieldCheck, X } from 'lucide-react';

type Phase = 'identify' | 'otp' | 'reset' | 'done';

const maskPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return phone;
  const lastTwo = digits.slice(-2);
  const cc = phone.startsWith('+') ? phone.match(/^\+\d{1,3}/)?.[0] ?? '' : '';
  return `${cc} ${'X'.repeat(Math.min(digits.length - 4 - cc.replace(/\D/g, '').length, 8))}...${lastTwo}`;
};

export function ForgotPasswordModal({ onClose, onDone }: { onClose: () => void; onDone?: () => void }) {
  const [phase, setPhase] = useState<Phase>('identify');
  const [identifier, setIdentifier] = useState('');
  const [phone, setPhone] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState('');
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => { if (timerRef.current) window.clearInterval(timerRef.current); }, []);

  const startCountdown = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setSecondsLeft(60);
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { if (timerRef.current) window.clearInterval(timerRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const handleIdentify = async () => {
    setError('');
    setBusy(true);
    try {
      const profile = await findProfileForRecovery(identifier);
      setPhone(profile.phone);
      setMaskedPhone(maskPhone(profile.phone));
      const result = await startPhoneVerification(profile.phone);
      setConfirmation(result);
      setOtp('');
      setPhase('otp');
      startCountdown();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to find your account.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || !phone) return;
    setError('');
    setBusy(true);
    try {
      const result = await startPhoneVerification(phone);
      setConfirmation(result);
      setOtp('');
      startCountdown();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend OTP.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    if (!confirmation) { setError('Please request an OTP first.'); return; }
    if (otp.trim().length !== 4) { setError('Enter the 4-digit code sent to your phone.'); return; }
    setBusy(true);
    try {
      await verifyPhoneOtp(confirmation, otp.trim());
      if (timerRef.current) window.clearInterval(timerRef.current);
      setPhase('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await updateCurrentUserPassword(newPassword);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update your password.');
    } finally {
      setBusy(false);
    }
  };

  const headingFor = (p: Phase): { eyebrow: string; title: string; sub: string } => {
    if (p === 'identify') return { eyebrow: 'RECOVER ACCOUNT', title: 'Forgot password', sub: 'Enter your username or registered mobile number. We will send a verification code to your number.' };
    if (p === 'otp') return { eyebrow: 'VERIFY IT IS YOU', title: 'Enter the code', sub: `A 4-digit code was sent to ${maskedPhone}.` };
    if (p === 'reset') return { eyebrow: 'SET A NEW PASSWORD', title: 'Create new password', sub: 'Choose a new password of at least 8 characters.' };
    return { eyebrow: 'ALL DONE', title: 'Password updated', sub: 'Your password has been changed. You can now log in with your new password.' };
  };
  const h = headingFor(phase);

  return (
    <div className="photo-modal edit-profile-modal" onClick={onClose}>
      <div className="forgot-panel" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="forgot-brand"><KeyRound size={26} /></div>
        <span className="eyebrow">{h.eyebrow}</span>
        <h2>{h.title}</h2>
        <p>{h.sub}</p>

        {phase === 'identify' && (
          <div className="auth-form">
            <label>Username or mobile number
              <input autoFocus value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="@username or +91 90000 00000" />
            </label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" type="button" onClick={() => void handleIdentify()} disabled={busy || !identifier.trim()}>
              {busy ? <><Loader2 size={16} className="spin" /> Looking up...</> : <>Next <ChevronRight size={18} /></>}
            </button>
          </div>
        )}

        {phase === 'otp' && (
          <div className="auth-form">
            <label>4-digit code
              <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" pattern="\d{4}" placeholder="0000" autoFocus />
            </label>
            <div className="otp-meta">
              {secondsLeft > 0
                ? <span className="otp-countdown">Resend code in 0:{secondsLeft < 10 ? `0${secondsLeft}` : secondsLeft}</span>
                : <button type="button" className="otp-resend" onClick={() => void handleResend()} disabled={busy}><RefreshCw size={14} /> Resend OTP</button>}
            </div>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" type="button" onClick={() => void handleVerifyOtp()} disabled={busy || otp.trim().length !== 4}>
              {busy ? <><Loader2 size={16} className="spin" /> Verifying...</> : <>Verify <ChevronRight size={18} /></>}
            </button>
          </div>
        )}

        {phase === 'reset' && (
          <form className="auth-form" onSubmit={(e) => { e.preventDefault(); void handleResetPassword(); }}>
            <label>New password
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" autoFocus minLength={8} />
            </label>
            <label>Confirm password
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" minLength={8} />
            </label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" type="submit" disabled={busy || !newPassword || !confirmPassword}>
              {busy ? <><Loader2 size={16} className="spin" /> Updating...</> : <>Update password <ChevronRight size={18} /></>}
            </button>
          </form>
        )}

        {phase === 'done' && (
          <div className="forgot-done">
            <div className="forgot-done-icon"><Check size={28} /></div>
            <button className="primary-button" type="button" onClick={() => { onDone?.(); onClose(); }}>Back to login <ChevronRight size={18} /></button>
          </div>
        )}

        <div className="secure-note"><ShieldCheck size={15} /> Recovery is verified by SMS</div>
      </div>
    </div>
  );
}
