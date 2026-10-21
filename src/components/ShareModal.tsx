import { useEffect, useState } from 'react';
import { Search, Send, X, ChevronRight } from 'lucide-react';
import { findOrCreateChat, searchUsersByUsername, sendMessage, type UserProfile } from '@/lib/firebaseService';

const placeholder = '/Screenshot_2026-06-11-20-43-00-14_99c04817c0de5652397fc8b56c3b3817.jpg';

type Props = {
  postSummary: string;
  onClose: () => void;
  onChatStarted: (chatId: string, otherUserId: string) => void;
};

export function ShareModal({ postSummary, onClose, onChatStarted }: Props) {
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  useEffect(() => {
    const term = queryText.trim();
    if (!term) { setResults([]); return; }
    let active = true;
    setSearching(true);
    const handle = window.setTimeout(() => {
      searchUsersByUsername(term)
        .then((users) => { if (active) setResults(users); })
        .catch(() => { if (active) setResults([]); })
        .finally(() => { if (active) setSearching(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(handle); };
  }, [queryText]);

  const shareWith = async (user: UserProfile) => {
    setSendingTo(user.uid);
    try {
      const chatId = await findOrCreateChat(user.uid);
      await sendMessage(chatId, postSummary);
      onChatStarted(chatId, user.uid);
    } catch { /* ignore */ } finally {
      setSendingTo(null);
    }
  };

  return (
    <div className="photo-modal share-modal" onClick={onClose}>
      <div className="share-panel" onClick={(e) => e.stopPropagation()}>
        <header className="share-header">
          <strong>Share to chat</strong>
          <button onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        <div className="share-search">
          <Search size={18} />
          <input value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="Search by username..." autoFocus />
        </div>
        <div className="share-results">
          {searching && <div className="share-empty">Searching...</div>}
          {!searching && queryText && results.length === 0 && <div className="share-empty">No people found.</div>}
          {!searching && results.map((user) => (
            <button className="share-result" key={user.uid} onClick={() => shareWith(user)} disabled={sendingTo !== null}>
              <img src={user.profilePicUrl || placeholder} alt={user.username} />
              <div>
                <strong>{user.nickname || `@${user.username}`}</strong>
                {user.bio && <span>{user.bio}</span>}
              </div>
              {sendingTo === user.uid ? <span className="share-sending">Sending</span> : <ChevronRight size={18} />}
            </button>
          ))}
          {!searching && !queryText && (
            <div className="share-empty">Search for a friend by their username to send this post privately.</div>
          )}
        </div>
        <div className="share-preview">
          <Send size={14} /> <span>Sharing: {postSummary}</span>
        </div>
      </div>
    </div>
  );
}
