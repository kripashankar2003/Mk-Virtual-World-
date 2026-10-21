import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, authReady } from '@/lib/firebase';
import {
  createAccount,
  deleteUserMedia,
  deleteUserNote,
  getCurrentProfile,
  logOut,
  saveUserNote,
  signInWithUsername,
  startPhoneVerification,
  subscribeToFeed,
  updateMediaCaption,
  updateUserProfile,
  uploadUserMedia,
  verifyPhoneOtp,
  type ConfirmationResult,
  type FeedPost,
  type UserProfile,
  type UserMedia,
} from '@/lib/firebaseService';
import { ArrowLeft, Bell, Camera, Check, ChevronRight, Clock, FileText, Heart, Image as ImageIcon, Loader2, LockKeyhole, LogOut, MessageCircle, Pencil, Plus, RefreshCw, Send, Settings, ShieldCheck, Sparkles, UserRound, Video, X, Zap } from 'lucide-react';
import { CommentsModal, PostCard } from '@/components/PostCard';
import { ShareModal } from '@/components/ShareModal';
import { ChatView, type SharedChat } from '@/components/ChatView';
import { UploadPreviewModal } from '@/components/UploadPreviewModal';
import { EditProfileModal } from '@/components/EditProfileModal';
import { ForgotPasswordModal } from '@/components/ForgotPasswordModal';
import { LockScreen } from '@/components/LockScreen';
import { AppLockModal } from '@/components/AppLockModal';
import { getLockTiming, isAppLockEnabled, recordBackgrounded, shouldLockOnForeground, consumeReopenFlag, type LockTiming } from '@/lib/appLock';

type Tab = 'home' | 'photos' | 'videos' | 'chat' | 'profile';
type Screen = 'splash' | 'login' | 'signup' | 'app';
type ForgotContext = 'login' | 'settings' | null;
type LockState = 'unlocked' | 'locked';

const logo = '/Screenshot_2026-06-11-20-43-00-14_99c04817c0de5652397fc8b56c3b3817.jpg';

function App() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [tab, setTab] = useState<Tab>('home');
  const [signupStep, setSignupStep] = useState(1);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [commentsTarget, setCommentsTarget] = useState<string | null>(null);
  const [sharePost, setSharePost] = useState<FeedPost | null>(null);
  const [pendingChat, setPendingChat] = useState<SharedChat>(null);
  const [pendingUpload, setPendingUpload] = useState<{ file: File; kind: 'photos' | 'videos'; previewUrl: string } | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [forgotContext, setForgotContext] = useState<ForgotContext>(null);
  const [appLockEnabled, setAppLockEnabled] = useState<boolean>(() => isAppLockEnabled());
  const [appLockTiming, setAppLockTiming] = useState<LockTiming>(() => getLockTiming());
  const [lockState, setLockState] = useState<LockState>(() => isAppLockEnabled() ? 'locked' : 'unlocked');
  const [appLockModalOpen, setAppLockModalOpen] = useState(false);
  const [obscured, setObscured] = useState(false);

  useEffect(() => {
    let unsubscribe: () => void = () => {};
    authReady.then(() => {
      unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
        if (nextUser) {
          const existing = await getCurrentProfile(nextUser.uid).catch(() => null);
          if (existing) { setUser(nextUser); setScreen('app'); }
        } else {
          setUser(null);
        }
      });
    });
    const timer = window.setTimeout(() => setScreen((current) => current === 'splash' ? 'login' : current), 2000);
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    let active = true;
    getCurrentProfile(user.uid).then((p) => { if (active) setProfile(p); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user) { setFeedPosts([]); return; }
    return subscribeToFeed(setFeedPosts, (error) => setToast(error.message));
  }, [user]);

  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2600); return () => window.clearTimeout(timer); }, [toast]);

  useEffect(() => {
    const onVisibilityHidden = () => { if (document.visibilityState === 'hidden') { recordBackgrounded(); if (isAppLockEnabled()) setObscured(true); } };
    const onVisibilityShown = () => {
      if (document.visibilityState === 'visible') {
        setObscured(false);
        if (isAppLockEnabled() && shouldLockOnForeground()) {
          consumeReopenFlag();
          setLockState('locked');
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityHidden);
    document.addEventListener('visibilitychange', onVisibilityShown);
    window.addEventListener('pagehide', onVisibilityHidden);
    window.addEventListener('blur', onVisibilityHidden);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityHidden);
      document.removeEventListener('visibilitychange', onVisibilityShown);
      window.removeEventListener('pagehide', onVisibilityHidden);
      window.removeEventListener('blur', onVisibilityHidden);
    };
  }, []);
  const addNote = async () => { if (!draft.trim() || !user) return; try { await saveUserNote(user.uid, draft.trim()); setDraft(''); setToast('Your note was posted'); } catch (error) { setAuthError(error instanceof Error ? error.message : 'Unable to save your note.'); } };
  const handleLogout = async () => { await logOut(); setScreen('login'); setToast('You are logged out'); };
  const handleLockForgot = () => {
    setAppLockEnabled(false);
    setAppLockTiming('immediate');
    setLockState('unlocked');
    setUser(null);
    setProfile(null);
    setScreen('login');
    setToast('App lock removed. Please log in again.');
  };

  const deleteMedia = async (ownerId: string, post: Extract<FeedPost, { kind: 'media' }>) => {
    if (!user) return;
    const item: UserMedia = { id: post.id, ownerId: post.ownerId, url: post.url, name: post.name, caption: post.caption, type: post.type, cloudinaryPublicId: post.cloudinaryPublicId, published: true };
    try { await deleteUserMedia(user.uid, item); setToast('Post deleted'); } catch (error) { setToast(error instanceof Error ? error.message : 'Delete failed'); }
  };
  const deleteNote = async (ownerId: string, post: Extract<FeedPost, { kind: 'note' }>) => {
    if (!user) return;
    try { await deleteUserNote(user.uid, post.id); setToast('Note deleted'); } catch (error) { setToast(error instanceof Error ? error.message : 'Delete failed'); }
  };
  const editMedia = async (ownerId: string, post: Extract<FeedPost, { kind: 'media' }>, newCaption: string) => {
    if (!user) return;
    try { await updateMediaCaption(user.uid, ownerId, post.id, newCaption); setToast('Post updated'); } catch (error) { setToast(error instanceof Error ? error.message : 'Update failed'); throw error; }
  };
  const saveProfile = async (updates: Partial<Pick<UserProfile, 'username' | 'nickname' | 'profilePicUrl' | 'bio' | 'dateOfBirth'>>) => {
    if (!user) return;
    try { const updated = await updateUserProfile(user.uid, updates); setProfile(updated); setToast('Profile updated'); } catch (error) { setToast(error instanceof Error ? error.message : 'Update failed'); throw error; }
  };

  const shareSummary = (post: FeedPost) => post.kind === 'note' ? `Note from @${profile?.username ?? 'me'}: ${post.text.slice(0, 80)}` : `Check out this ${post.type === 'videos' ? 'video' : 'photo'} from @${profile?.username ?? 'me'}: ${post.url}`;

  if (screen === 'splash') return <Splash />;
  if (appLockEnabled && lockState === 'locked') {
    return <LockScreen onUnlocked={() => setLockState('unlocked')} onForgot={handleLockForgot} />;
  }
  if (screen === 'login') return <AuthScreen error={authError} onSignup={() => { setAuthError(''); setSignupStep(1); setScreen('signup'); }} onLogin={async (username, password) => { try { await signInWithUsername(username, password); setAuthError(''); } catch (error) { setAuthError(error instanceof Error ? error.message : 'Unable to log in.'); } }} onForgotPassword={() => { setAuthError(''); setForgotContext('login'); }} />;
  if (screen === 'signup') return <SignupScreen step={signupStep} setStep={setSignupStep} error={authError} onComplete={async (phone, password, username, nickname) => { try { await createAccount(phone, password, username, nickname); setAuthError(''); } catch (error) { setAuthError(error instanceof Error ? error.message : 'Unable to create your account.'); } }} onBack={() => setScreen('login')} />;

  const homeFeed = feedPosts.filter((p) => p.kind === 'note');
  const photosFeed = feedPosts.filter((p) => p.kind === 'media' && (p as Extract<FeedPost, { kind: 'media' }>).type === 'photos') as FeedPost[];
  const videosFeed = feedPosts.filter((p) => p.kind === 'media' && (p as Extract<FeedPost, { kind: 'media' }>).type === 'videos') as FeedPost[];

  return <div className={obscured ? 'app-shell app-obscured' : (darkMode ? 'app-shell dark-shell' : 'app-shell')}>
    <header className="topbar"><div className="brand-mini" onClick={() => setTab('home')}><img src={logo} alt="MK Virtual World" /><span>MK Virtual World</span></div><div className="top-actions"><button className="icon-button" aria-label="Notifications"><Bell size={20} /></button><button className="avatar-button" onClick={() => setTab('profile')}><img src={profile?.profilePicUrl || logo} alt="Profile" /></button></div></header>
    <main className="content-area">
      {tab === 'home' && <HomeView uid={user?.uid} profile={profile} feedPosts={homeFeed} draft={draft} setDraft={setDraft} addNote={addNote} onDeleteNote={deleteNote} onDeleteMedia={deleteMedia} onEditMedia={editMedia} onOpenComments={setCommentsTarget} onShare={setSharePost} />}
      {tab === 'photos' && <PhotosView uid={user?.uid} feedPosts={photosFeed} onOpenComments={setCommentsTarget} onShare={setSharePost} onDeleteMedia={deleteMedia} onEditMedia={editMedia} onPickFile={(file, previewUrl) => setPendingUpload({ file, kind: 'photos', previewUrl })} />}
      {tab === 'videos' && <VideosView uid={user?.uid} feedPosts={videosFeed} onOpenComments={setCommentsTarget} onShare={setSharePost} onDeleteMedia={deleteMedia} onEditMedia={editMedia} onPickFile={(file, previewUrl) => setPendingUpload({ file, kind: 'videos', previewUrl })} />}
      {tab === 'chat' && <ChatView currentUid={user?.uid ?? ''} initialChat={pendingChat} search={search} setSearch={setSearch} />}
      {tab === 'profile' && <ProfileView profile={profile} darkMode={darkMode} setDarkMode={setDarkMode} onLogout={handleLogout} onEditProfile={() => setEditProfileOpen(true)} onForgotPassword={() => setForgotContext('settings')} appLockEnabled={appLockEnabled} appLockTiming={appLockTiming} onOpenAppLock={() => setAppLockModalOpen(true)} />}
    </main>
    <nav className="bottom-nav"><NavItem icon={<FileText size={21} />} label="Home" active={tab === 'home'} onClick={() => setTab('home')} /><NavItem icon={<ImageIcon size={21} />} label="Photos" active={tab === 'photos'} onClick={() => setTab('photos')} /><NavItem icon={<Video size={21} />} label="Videos" active={tab === 'videos'} onClick={() => setTab('videos')} /><NavItem icon={<MessageCircle size={21} />} label="Chat" active={tab === 'chat'} onClick={() => setTab('chat')} /><NavItem icon={<UserRound size={21} />} label="Profile" active={tab === 'profile'} onClick={() => setTab('profile')} /></nav>
    {selectedPhoto && <PhotoModal src={selectedPhoto} onClose={() => setSelectedPhoto(null)} />}
    {commentsTarget && <CommentsModal parentPath={commentsTarget} currentProfile={profile} onClose={() => setCommentsTarget(null)} />}
    {sharePost && <ShareModal postSummary={shareSummary(sharePost)} onClose={() => setSharePost(null)} onChatStarted={(chatId, otherUserId) => { setSharePost(null); setPendingChat({ chatId, otherUserId }); setTab('chat'); setToast('Post sent to chat'); }} />}
    {pendingUpload && <UploadPreviewModal file={pendingUpload.file} kind={pendingUpload.kind} previewUrl={pendingUpload.previewUrl} onCancel={() => setPendingUpload(null)} onPost={async (caption, onProgress) => { if (!user) return; await uploadUserMedia(user.uid, pendingUpload.file, pendingUpload.kind, caption, onProgress); setPendingUpload(null); setToast(`${pendingUpload.kind === 'photos' ? 'Photo' : 'Video'} posted to the feed`); }} />}
    {editProfileOpen && profile && <EditProfileModal profile={profile} onClose={() => setEditProfileOpen(false)} onSave={async (updates) => { await saveProfile(updates); setEditProfileOpen(false); }} />}
    {forgotContext && <ForgotPasswordModal onClose={() => setForgotContext(null)} onDone={forgotContext === 'login' ? undefined : () => setToast('Your password was updated')} />}
    {appLockModalOpen && <AppLockModal enabled={appLockEnabled} currentTiming={appLockTiming} onClose={() => setAppLockModalOpen(false)} onEnabledChange={setAppLockEnabled} onTimingChange={setAppLockTiming} />}
    {toast && <div className="toast"><Check size={16} /> {toast}</div>}
    {obscured && <div className="obscure-overlay" />}
  </div>;
}

function Splash() { return <div className="splash"><div className="splash-logo"><img src={logo} alt="MK Virtual World" /><span>MK</span></div><p>MK Virtual World</p><small>A little world made for us</small></div>; }

function AuthScreen({ error, onSignup, onLogin, onForgotPassword }: { error: string; onSignup: () => void; onLogin: (username: string, password: string) => Promise<void>; onForgotPassword: () => void }) {
  const [showPassword, setShowPassword] = useState(false); const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  return <div className="auth-page"><div className="auth-card"><div className="auth-brand"><img src={logo} alt="MK Virtual World" /><h1>MK Virtual World</h1><p>Your private space for beautiful memories.</p></div><form onSubmit={(event) => { event.preventDefault(); void onLogin(username, password); }} className="auth-form"><label>Username<input required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Enter your username" autoComplete="username" /></label><label>Password<div className="password-wrap"><input required value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Enter your password" autoComplete="current-password" /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></div></label>{error && <div className="form-error">{error}</div>}<button className="primary-button" type="submit">Log In <ChevronRight size={18} /></button></form><button className="forgot-link" type="button" onClick={onForgotPassword}>Forgot password?</button><div className="auth-divider"><span>or</span></div><p className="switch-auth">Don't have an account? <button onClick={onSignup}>Sign Up</button></p><div className="secure-note"><ShieldCheck size={15} /> Your memories are private and secure</div></div></div>;
}

function SignupScreen({ step, setStep, error, onComplete, onBack }: { step: number; setStep: (step: number) => void; error: string; onComplete: (phone: string, password: string, username: string, nickname: string) => Promise<void>; onBack: () => void }) {
  const titles = ['Verify your number', 'Create a password', 'Choose your username', 'Pick your nickname'];
  const [phone, setPhone] = useState(''); const [password, setPassword] = useState(''); const [username, setUsername] = useState(''); const [nickname, setNickname] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [otpError, setOtpError] = useState('');
  const timerRef = useRef<number | null>(null);
  const value = step === 1 ? phone : step === 2 ? password : step === 3 ? username : nickname;
  const setValue = step === 1 ? setPhone : step === 2 ? setPassword : step === 3 ? setUsername : setNickname;
  const totalSteps = 4;

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

  const sendOtp = async () => {
    setOtpError('');
    const normalized = phone.trim();
    if (!/^\+\d{8,15}$/.test(normalized)) { setOtpError('Enter your number with country code, e.g. +91 90000 00000'); return; }
    setSending(true);
    try {
      const result = await startPhoneVerification(normalized);
      setConfirmation(result);
      setOtpSent(true);
      setOtp('');
      startCountdown();
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Unable to send OTP. Try again.');
    } finally {
      setSending(false);
    }
  };

  const resendOtp = async () => {
    if (secondsLeft > 0) return;
    setOtpError('');
    setSending(true);
    try {
      const result = await startPhoneVerification(phone.trim());
      setConfirmation(result);
      setOtp('');
      startCountdown();
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Unable to resend OTP.');
    } finally {
      setSending(false);
    }
  };

  const confirmOtp = async () => {
    setOtpError('');
    if (!confirmation) { setOtpError('Please request an OTP first.'); return; }
    if (otp.trim().length !== 4) { setOtpError('Enter the 4-digit code sent to your phone.'); return; }
    setVerifying(true);
    try {
      await verifyPhoneOtp(confirmation, otp.trim());
      if (timerRef.current) window.clearInterval(timerRef.current);
      setStep(2);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Incorrect code. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  const backHandler = step === 1
    ? onBack
    : () => { if (step === 2 && confirmation) { /* keep phone session, just go back to OTP entry */ } setStep(step - 1); };

  return <div className="auth-page"><div id="recaptcha-container" /><div className="auth-card signup-card"><button className="back-button" onClick={backHandler}><ArrowLeft size={18} /> Back</button><div className="stepper"><span className={step >= 1 ? 'step-active' : ''}>01</span><i /><span className={step >= 2 ? 'step-active' : ''}>02</span><i /><span className={step >= 3 ? 'step-active' : ''}>03</span><i /><span className={step >= 4 ? 'step-active' : ''}>04</span></div><div className="signup-heading"><span className="eyebrow">STEP 0{step} OF 0{totalSteps}</span><h1>{titles[step - 1]}</h1><p>{step === 1 ? 'Add your number so your account can be recovered securely.' : step === 2 ? 'Keep it private, memorable, and at least 8 characters.' : step === 3 ? 'This is how friends will find you by handle.' : 'The name everyone sees on your posts and profile.'}</p></div>
  {step === 1 ? (
    <div className="auth-form otp-step">
      {!otpSent ? (
        <>
          <label>Mobile number<input autoFocus required value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" placeholder="+91 90000 00000" /></label>
          {otpError && <div className="form-error">{otpError}</div>}
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button" type="button" onClick={() => void sendOtp()} disabled={sending || !phone.trim()}>{sending ? <><Loader2 size={16} className="spin" /> Sending OTP...</> : <>Send OTP <ChevronRight size={18} /></>}</button>
        </>
      ) : (
        <>
          <label>Enter the 4-digit code<input required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 4))} type="text" inputMode="numeric" pattern="\d{4}" placeholder="0000" autoFocus /></label>
          <div className="otp-meta">
            {secondsLeft > 0
              ? <span className="otp-countdown">Resend code in 0:{secondsLeft < 10 ? `0${secondsLeft}` : secondsLeft}</span>
              : <button type="button" className="otp-resend" onClick={() => void resendOtp()} disabled={sending}><RefreshCw size={14} /> Resend OTP</button>}
          </div>
          {otpError && <div className="form-error">{otpError}</div>}
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button" type="button" onClick={() => void confirmOtp()} disabled={verifying || otp.trim().length !== 4}>{verifying ? <><Loader2 size={16} className="spin" /> Verifying...</> : <>Verify & continue <ChevronRight size={18} /></>}</button>
        </>
      )}
    </div>
  ) : (
    <form className="auth-form" onSubmit={(event) => { event.preventDefault(); if (step < totalSteps) setStep(step + 1); else void onComplete(phone, password, username, nickname); }}><label>{step === 2 ? 'Password' : step === 3 ? 'Username' : 'Nickname'}<input autoFocus required minLength={step === 2 ? 8 : undefined} value={value} onChange={(event) => setValue(event.target.value)} type={step === 2 ? 'password' : 'text'} placeholder={step === 2 ? 'Create a password' : step === 3 ? '@yourusername' : 'Your display name'} /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button" type="submit">{step === totalSteps ? 'Create my account' : 'Continue'} <ChevronRight size={18} /></button></form>
  )}
  <div className="signup-benefit"><Sparkles size={17} /><span>Make your world personal, expressive, and yours.</span></div></div></div>;
}

function Composer({ profile, draft, setDraft, addNote }: { uid?: string; profile: UserProfile | null; draft: string; setDraft: (v: string) => void; addNote: () => Promise<void> }) {
  const [expanded, setExpanded] = useState(false);
  return <section className="composer feed-composer"><div className="composer-top"><img src={profile?.profilePicUrl || logo} alt="You" /><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onFocus={() => setExpanded(true)} placeholder="Share a thought with everyone..." rows={expanded ? 3 : 1} /></div>{expanded && <div className="composer-footer"><span><Pencil size={15} /> Visible to everyone</span><button className="save-button" onClick={addNote}>Post <Send size={15} /></button></div>}</section>;
}

function HomeView({ uid, profile, feedPosts, draft, setDraft, addNote, onDeleteNote, onDeleteMedia, onEditMedia, onOpenComments, onShare }: { uid?: string; profile: UserProfile | null; feedPosts: FeedPost[]; draft: string; setDraft: (v: string) => void; addNote: () => Promise<void>; onDeleteNote: (ownerId: string, post: Extract<FeedPost, { kind: 'note' }>) => void; onDeleteMedia: (ownerId: string, post: Extract<FeedPost, { kind: 'media' }>) => void; onEditMedia: (ownerId: string, post: Extract<FeedPost, { kind: 'media' }>, newCaption: string) => Promise<void>; onOpenComments: (path: string) => void; onShare: (post: FeedPost) => void }) {
  const greeting = 'Welcome back';
  return <div className="view home-view">
    <div className="welcome-row"><div><span className="eyebrow">YOUR WORLD</span><h2>{greeting}, {profile?.nickname || profile?.username || 'friend'}</h2><p>Thoughts and notes from everyone.</p></div></div>
    {uid && <Composer profile={profile} draft={draft} setDraft={setDraft} addNote={addNote} />}
    <div className="section-heading"><div><span className="eyebrow">NOTES & MESSAGES</span><h3>Everyone's notes <span>{feedPosts.length}</span></h3></div></div>
    {feedPosts.length === 0 ? <div className="empty-media"><div className="empty-media-icon"><FileText size={24} /></div><strong>No notes yet</strong><span>Share a thought to start the conversation.</span></div>
      : <div className="feed-list">{feedPosts.map((post) => <PostCard key={`${post.kind}-${post.id}`} post={post} currentUid={uid ?? ''} onOpenComments={onOpenComments} onShare={onShare} onDeleteMedia={onDeleteMedia} onDeleteNote={onDeleteNote} onEditMedia={onEditMedia} />)}</div>}
  </div>;
}

function PhotosView({ uid, feedPosts, onOpenComments, onShare, onDeleteMedia, onEditMedia, onPickFile }: { uid?: string; feedPosts: FeedPost[]; onOpenComments: (p: string) => void; onShare: (post: FeedPost) => void; onDeleteMedia: (ownerId: string, post: Extract<FeedPost, { kind: 'media' }>) => void; onEditMedia: (ownerId: string, post: Extract<FeedPost, { kind: 'media' }>, newCaption: string) => Promise<void>; onPickFile: (file: File, previewUrl: string) => void }) {
  const handlePick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uid) return;
    const previewUrl = URL.createObjectURL(file);
    onPickFile(file, previewUrl);
    event.target.value = '';
  };
  return <div className="view media-view">
    <div className="page-heading"><div><span className="eyebrow">PUBLIC PHOTOS</span><h2>Photos</h2><p>Full-size moments from everyone.</p></div><label className="upload-button"><input type="file" accept="image/*" hidden onChange={(event) => void handlePick(event)} /><Plus size={19} /> Add</label></div>
    {feedPosts.length === 0 ? <div className="empty-media"><div className="empty-media-icon"><Camera size={24} /></div><strong>No photos yet</strong><span>Upload your first photo to share with everyone.</span></div>
      : <div className="feed-list">{feedPosts.map((post) => <PostCard key={`media-${post.id}`} post={post} currentUid={uid ?? ''} onOpenComments={onOpenComments} onShare={onShare} onDeleteMedia={onDeleteMedia} onDeleteNote={() => {}} onEditMedia={onEditMedia} />)}</div>}
  </div>;
}

function VideosView({ uid, feedPosts, onOpenComments, onShare, onDeleteMedia, onEditMedia, onPickFile }: { uid?: string; feedPosts: FeedPost[]; onOpenComments: (p: string) => void; onShare: (post: FeedPost) => void; onDeleteMedia: (ownerId: string, post: Extract<FeedPost, { kind: 'media' }>) => void; onEditMedia: (ownerId: string, post: Extract<FeedPost, { kind: 'media' }>, newCaption: string) => Promise<void>; onPickFile: (file: File, previewUrl: string) => void }) {
  const handlePick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uid) return;
    const previewUrl = URL.createObjectURL(file);
    onPickFile(file, previewUrl);
    event.target.value = '';
  };
  return <div className="view media-view">
    <div className="page-heading"><div><span className="eyebrow">PUBLIC REELS</span><h2>Videos</h2><p>Stories in motion from everyone.</p></div><label className="upload-button"><input type="file" accept="video/*" hidden onChange={(event) => void handlePick(event)} /><Plus size={19} /> Add</label></div>
    {feedPosts.length === 0 ? <div className="empty-media"><div className="empty-media-icon"><Video size={24} /></div><strong>No videos yet</strong><span>Upload your first video to share with everyone.</span></div>
      : <div className="feed-list">{feedPosts.map((post) => <PostCard key={`media-${post.id}`} post={post} currentUid={uid ?? ''} onOpenComments={onOpenComments} onShare={onShare} onDeleteMedia={onDeleteMedia} onDeleteNote={() => {}} onEditMedia={onEditMedia} />)}</div>}
  </div>;
}

function ProfileView({ profile, darkMode, setDarkMode, onLogout, onEditProfile, onForgotPassword, appLockEnabled, appLockTiming, onOpenAppLock }: { profile: UserProfile | null; darkMode: boolean; setDarkMode: (value: boolean) => void; onLogout: () => void; onEditProfile: () => void; onForgotPassword: () => void; appLockEnabled: boolean; appLockTiming: LockTiming; onOpenAppLock: () => void }) { const displayName = profile?.nickname || profile?.username || 'Your profile'; const handle = profile?.username ? `@${profile.username}` : ''; const dob = profile?.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : ''; const locationBit = dob || 'Mumbai, India'; const timingLabel = appLockEnabled ? { immediate: 'Immediately', '1m': 'After 1 minute', '5m': 'After 5 minutes', onReopen: 'Only when app is closed and reopened' }[appLockTiming] : ''; return <div className="view profile-view"><div className="profile-cover"><div className="profile-avatar"><img src={profile?.profilePicUrl || logo} alt={displayName} /><button onClick={onEditProfile}><Camera size={15} /></button></div></div><div className="profile-intro"><span className="eyebrow">YOUR PROFILE</span><h2>{displayName}</h2><p>{handle}{handle ? ' · ' : ''}{locationBit}</p>{profile?.bio && <p className="profile-bio">{profile.bio}</p>}<button className="edit-profile" onClick={onEditProfile}><Pencil size={15} /> Edit profile</button></div><div className="settings-list"><div className="settings-label">PREFERENCES</div><SettingRow icon={<LockKeyhole size={19} />} title="App Lock" detail={appLockEnabled ? 'On · Protect your private world' : 'Protect your private world'} control={<button className={appLockEnabled ? 'toggle on' : 'toggle'} onClick={onOpenAppLock}><i /></button>} onClick={onOpenAppLock} />{appLockEnabled && <SettingRow icon={<Clock size={19} />} title="Lock timing" detail={timingLabel} control={<ChevronRight size={18} />} onClick={onOpenAppLock} />}<SettingRow icon={<Sparkles size={19} />} title="Dark Mode" detail="A softer look for late nights" control={<button className={darkMode ? 'toggle on' : 'toggle'} onClick={() => setDarkMode(!darkMode)}><i /></button>} /><SettingRow icon={<Bell size={19} />} title="Notifications" detail="Stay close to what matters" control={<ChevronRight size={18} />} /><div className="settings-label second">ACCOUNT</div><SettingRow icon={<Settings size={19} />} title="Account settings" detail="Password, privacy and more" control={<ChevronRight size={18} />} onClick={onForgotPassword} /><SettingRow icon={<Zap size={19} />} title="Built with Bolt" detail="Made on bolt.new" control={<ChevronRight size={18} />} onClick={() => window.open('https://bolt.new', '_blank', 'noopener,noreferrer')} /><SettingRow icon={<Heart size={19} />} title="Rate this app" detail="Help MK Virtual World grow" control={<ChevronRight size={18} />} /></div><button className="logout-button" onClick={onLogout}><LogOut size={18} /> Log out</button><footer>MK Virtual World <span>v1.0.0</span><small>Created by Kripashankar</small></footer></div>; }

function SettingRow({ icon, title, detail, control, onClick }: { icon: React.ReactNode; title: string; detail: string; control: React.ReactNode; onClick?: () => void }) { return <div className={onClick ? 'setting-row clickable' : 'setting-row'} onClick={onClick}><div className="setting-icon">{icon}</div><div className="setting-copy"><strong>{title}</strong><span>{detail}</span></div>{control}</div>; }
function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) { return <button className={active ? 'nav-item active' : 'nav-item'} onClick={onClick}>{icon}<span>{label}</span></button>; }
function PhotoModal({ src, onClose }: { src: string; onClose: () => void }) { return <div className="photo-modal" onClick={onClose}><button onClick={onClose}><X size={21} /></button><img src={src} alt="Full screen memory" onClick={(event) => event.stopPropagation()} /></div>; }

export default App;
