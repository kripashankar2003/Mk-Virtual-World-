import { useEffect, useRef, useState } from 'react';
import { Download, Edit3, Heart, MessageCircle, MoreHorizontal, Pencil, Share2, Trash2, X } from 'lucide-react';
import {
  addComment,
  asDate,
  fetchProfile,
  subscribeToComments,
  subscribeToLikes,
  toggleLike,
  type Comment,
  type FeedPost,
  type UserProfile,
} from '@/lib/firebaseService';

type Props = {
  post: FeedPost;
  currentUid: string;
  onOpenComments: (parentPath: string) => void;
  onShare: (post: FeedPost) => void;
  onDeleteMedia: (ownerId: string, post: Extract<FeedPost, { kind: 'media' }>) => void;
  onDeleteNote: (ownerId: string, post: Extract<FeedPost, { kind: 'note' }>) => void;
  onEditMedia: (ownerId: string, post: Extract<FeedPost, { kind: 'media' }>, newCaption: string) => Promise<void>;
};

const placeholder = '/Screenshot_2026-06-11-20-43-00-14_99c04817c0de5652397fc8b56c3b3817.jpg';

const MAX_CAPTION_WORDS = 100;

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function timeLabel(date?: { toDate?: () => Date }) {
  return asDate(date).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function downloadFile(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function PostCard({ post, currentUid, onOpenComments, onShare, onDeleteMedia, onDeleteNote, onEditMedia }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [localComments, setLocalComments] = useState<Comment[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const ownerId = post.ownerId;
  const parentPath = post.kind === 'note' ? `users/${ownerId}/notes/${post.id}` : `users/${ownerId}/media/${post.id}`;

  useEffect(() => {
    let active = true;
    fetchProfile(ownerId).then((p) => { if (active) setProfile(p); });
    return () => { active = false; };
  }, [ownerId]);

  useEffect(() => {
    const unsub = subscribeToLikes(parentPath, (count, byMe) => {
      setLikeCount(count);
      setLiked(byMe);
    }, () => {});
    return unsub;
  }, [parentPath]);

  useEffect(() => {
    const unsub = subscribeToComments(parentPath, (comments) => setLocalComments(comments), () => {});
    return unsub;
  }, [parentPath]);

  useEffect(() => { setCommentCount(localComments.length); }, [localComments]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleLike = async () => {
    try { await toggleLike(parentPath); } catch { /* ignore */ }
  };

  const avatar = profile?.profilePicUrl || placeholder;
  const displayName = profile?.nickname || (profile?.username ? `@${profile.username}` : 'someone');
  const handle = profile?.username ? `@${profile.username}` : '';
  const isMine = post.ownerId === currentUid;
  const isMedia = post.kind === 'media';

  const lastComment = localComments[localComments.length - 1];

  const handleDelete = () => {
    setMenuOpen(false);
    if (!window.confirm('Delete this post?')) return;
    if (post.kind === 'media') onDeleteMedia(ownerId, post);
    else onDeleteNote(ownerId, post);
  };

  const handleDownload = () => {
    setMenuOpen(false);
    if (post.kind === 'media') downloadFile(post.url, post.name);
  };

  const handleEdit = () => {
    setMenuOpen(false);
    setEditing(true);
  };

  return (
    <article className="feed-post">
      <header className="feed-post-header">
        <img className="feed-avatar" src={avatar} alt={displayName} />
        <div className="feed-post-meta">
          <strong>{displayName}</strong>
          <span>{handle}{handle ? ' · ' : ''}{timeLabel(post.createdAt)}</span>
        </div>
        {isMine && (
          <div className="feed-menu-wrap" ref={menuRef}>
            <button className="feed-menu-trigger" aria-label="Post options" onClick={() => setMenuOpen((v) => !v)}>
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="feed-menu">
                {isMedia && (
                  <button className="feed-menu-item" onClick={handleEdit}>
                    <Edit3 size={16} /> Edit title
                  </button>
                )}
                <button className="feed-menu-item danger" onClick={handleDelete}>
                  <Trash2 size={16} /> Delete
                </button>
                {isMedia && (
                  <button className="feed-menu-item" onClick={handleDownload}>
                    <Download size={16} /> Download
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {post.kind === 'note' ? (
        <div className="feed-note-body">{post.text}</div>
      ) : post.type === 'videos' ? (
        <>
          <div className="feed-video-wrap">
            <video src={post.url} controls playsInline preload="metadata" />
          </div>
          {post.caption && <div className="feed-caption">{post.caption}</div>}
        </>
      ) : (
        <>
          <div className="feed-photo-wrap">
            <img src={post.url} alt={post.name} />
          </div>
          {post.caption && <div className="feed-caption">{post.caption}</div>}
        </>
      )}

      <footer className="feed-post-actions">
        <button className={liked ? 'feed-action liked' : 'feed-action'} onClick={() => void handleLike()} aria-label="Like">
          <Heart size={20} fill={liked ? 'currentColor' : 'none'} />
          <span>{likeCount}</span>
        </button>
        <button className="feed-action" onClick={() => onOpenComments(parentPath)} aria-label="Comment">
          <MessageCircle size={20} />
          <span>{commentCount}</span>
        </button>
        <button className="feed-action" onClick={() => onShare(post)} aria-label="Share">
          <Share2 size={20} />
          <span>Share</span>
        </button>
      </footer>

      {lastComment && (
        <div className="feed-last-comment">
          <strong>{lastComment.nickname || `@${lastComment.username}`}</strong> <span>{lastComment.text}</span>
        </div>
      )}

      {editing && post.kind === 'media' && (
        <EditCaptionModal
          initialCaption={post.caption}
          onClose={() => setEditing(false)}
          onSave={async (newCaption) => {
            await onEditMedia(ownerId, post, newCaption);
            setEditing(false);
          }}
        />
      )}
    </article>
  );
}

function EditCaptionModal({ initialCaption, onClose, onSave }: { initialCaption: string; onClose: () => void; onSave: (caption: string) => Promise<void> }) {
  const [caption, setCaption] = useState(initialCaption);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const words = countWords(caption);
  const overLimit = words > MAX_CAPTION_WORDS;
  const canSave = caption.trim().length > 0 && !overLimit && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await onSave(caption.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save changes.');
      setSaving(false);
    }
  };

  return (
    <div className="photo-modal edit-caption-modal" onClick={onClose}>
      <div className="edit-caption-panel" onClick={(e) => e.stopPropagation()}>
        <header className="edit-caption-header">
          <strong>Edit title</strong>
          <button onClick={onClose} aria-label="Close" disabled={saving}><X size={20} /></button>
        </header>
        <div className="edit-caption-body">
          <label className="upload-caption-label">Title / caption</label>
          <textarea
            className="upload-caption-input"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a title for your post (up to 100 words)..."
            rows={4}
            maxLength={800}
            disabled={saving}
          />
          <div className="upload-caption-meta">
            {error ? <span className="upload-error">{error}</span> : <span className={overLimit ? 'upload-count over' : 'upload-count'}>{words}/{MAX_CAPTION_WORDS} words</span>}
          </div>
        </div>
        <footer className="edit-caption-footer">
          <button className="upload-cancel-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="upload-post-btn" onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? 'Saving...' : <><Pencil size={16} /> Save changes</>}
          </button>
        </footer>
      </div>
    </div>
  );
}

export function CommentsModal({ parentPath, currentProfile, onClose }: { parentPath: string; currentProfile: UserProfile | null; onClose: () => void }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsub = subscribeToComments(parentPath, setComments, () => {});
    return unsub;
  }, [parentPath]);

  const submit = async () => {
    if (!draft.trim() || !currentProfile) return;
    setSending(true);
    try {
      await addComment(parentPath, draft.trim(), currentProfile);
      setDraft('');
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  };

  return (
    <div className="photo-modal comments-modal" onClick={onClose}>
      <div className="comments-panel" onClick={(e) => e.stopPropagation()}>
        <header className="comments-header">
          <strong>Comments</strong>
          <button onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        <div className="comments-list">
          {comments.length === 0 ? (
            <div className="comments-empty">No comments yet. Start the conversation.</div>
          ) : comments.map((c) => (
            <div className="comment-row" key={c.id}>
              <img src={c.profilePicUrl || placeholder} alt={c.username} />
              <div>
                <strong>{c.nickname || `@${c.username}`}</strong>
                <span>{c.text}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="comments-input">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment..."
            onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
          />
          <button onClick={() => void submit()} disabled={sending || !draft.trim()}>Post</button>
        </div>
      </div>
    </div>
  );
}
