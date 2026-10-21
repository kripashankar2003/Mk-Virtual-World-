import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Save, X } from 'lucide-react';
import { uploadToCloudinary } from '@/lib/cloudinary';
import type { UserProfile } from '@/lib/firebaseService';

const MAX_BIO_WORDS = 30;

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

type Props = {
  profile: UserProfile;
  onClose: () => void;
  onSave: (updates: Partial<Pick<UserProfile, 'username' | 'nickname' | 'profilePicUrl' | 'bio' | 'dateOfBirth'>>) => Promise<void>;
};

export function EditProfileModal({ profile, onClose, onSave }: Props) {
  const [username, setUsername] = useState(profile.username);
  const [nickname, setNickname] = useState(profile.nickname || '');
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [profilePicUrl, setProfilePicUrl] = useState(profile.profilePicUrl || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pickedPreview, setPickedPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { if (pickedPreview) URL.revokeObjectURL(pickedPreview); };
  }, [pickedPreview]);

  const bioWords = countWords(bio);
  const overLimit = bioWords > MAX_BIO_WORDS;
  const normalizedUsername = username.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
  const canSave = normalizedUsername.length > 0 && !overLimit && !uploading && !saving;

  const handlePickImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setPickedPreview(preview);
    setUploading(true);
    setError('');
    try {
      const { url } = await uploadToCloudinary(file, 'image');
      setProfilePicUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed');
      setPickedPreview(null);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await onSave({
        username: normalizedUsername,
        nickname: nickname.trim(),
        dateOfBirth,
        bio: bio.trim(),
        profilePicUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save changes.');
      setSaving(false);
    }
  };

  const avatarSrc = pickedPreview || profilePicUrl || '/Screenshot_2026-06-11-20-43-00-14_99c04817c0de5652397fc8b56c3b3817.jpg';

  return (
    <div className="photo-modal edit-profile-modal" onClick={onClose}>
      <div className="edit-profile-panel" onClick={(e) => e.stopPropagation()}>
        <header className="edit-caption-header">
          <strong>Edit profile</strong>
          <button onClick={onClose} aria-label="Close" disabled={saving}><X size={20} /></button>
        </header>

        <div className="edit-profile-body">
          <div className="edit-profile-avatar-wrap">
            <div className="edit-profile-avatar">
              <img src={avatarSrc} alt="Profile" />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || saving} aria-label="Change photo">
                {uploading ? <Loader2 size={16} className="spin" /> : <Camera size={16} />}
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => void handlePickImage(e)} />
            <span className="edit-profile-avatar-hint">{uploading ? 'Uploading...' : 'Tap to change photo'}</span>
          </div>

          <label className="edit-field">
            <span className="edit-field-label">Username</span>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@yourusername" disabled={saving} />
          </label>

          <label className="edit-field">
            <span className="edit-field-label">Nickname</span>
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Your display name" disabled={saving} />
          </label>

          <label className="edit-field">
            <span className="edit-field-label">Date of birth</span>
            <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} disabled={saving} />
          </label>

          <label className="edit-field">
            <span className="edit-field-label">Bio</span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A few words about you (up to 30 words)" rows={3} maxLength={300} disabled={saving} />
            <span className={overLimit ? 'edit-field-count over' : 'edit-field-count'}>{bioWords}/{MAX_BIO_WORDS} words</span>
          </label>

          {error && <div className="upload-error edit-profile-error">{error}</div>}
        </div>

        <footer className="edit-caption-footer">
          <button className="upload-cancel-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="upload-post-btn" onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? <><Loader2 size={16} className="spin" /> Saving...</> : <><Save size={16} /> Save changes</>}
          </button>
        </footer>
      </div>
    </div>
  );
}
