import { useEffect, useState } from 'react';
import { ArrowLeft, Search, Send, ChevronRight } from 'lucide-react';
import {
  asDate,
  fetchProfile,
  subscribeToMessages,
  subscribeToMyChats,
  sendMessage,
  type ChatMessage,
  type ChatSummary,
  type UserProfile,
} from '@/lib/firebaseService';
import { getLastReadAt, markChatRead } from '@/lib/chatReadState';

const placeholder = '/Screenshot_2026-06-11-20-43-00-14_99c04817c0de5652397fc8b56c3b3817.jpg';

export type SharedChat = { chatId: string; otherUserId: string } | null;

export function ChatView({
  currentUid,
  initialChat,
  search,
  setSearch,
}: {
  currentUid: string;
  initialChat?: SharedChat;
  search: string;
  setSearch: (value: string) => void;
}) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChat, setActiveChat] = useState<SharedChat>(initialChat ?? null);
  const [otherProfile, setOtherProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsub = subscribeToMyChats(setChats, () => {});
    return unsub;
  }, []);

  useEffect(() => {
    if (initialChat) setActiveChat(initialChat);
  }, [initialChat]);

  useEffect(() => {
    if (!activeChat) { setOtherProfile(null); return; }
    let active = true;
    fetchProfile(activeChat.otherUserId).then((p) => { if (active) setOtherProfile(p); });
    return () => { active = false; };
  }, [activeChat]);

  useEffect(() => {
    if (!activeChat) return;
    markChatRead(activeChat.chatId);
  }, [activeChat, chats]);

  if (activeChat) {
    return (
      <ChatThread
        chatId={activeChat.chatId}
        otherProfile={otherProfile}
        currentUid={currentUid}
        onBack={() => setActiveChat(null)}
      />
    );
  }

  const filtered = chats.filter(() => true);
  return (
    <div className="view chat-view">
      <div className="page-heading">
        <div>
          <span className="eyebrow">STAY CONNECTED</span>
          <h2>Messages</h2>
          <p>Private conversations with your people.</p>
        </div>
      </div>
      <div className="search-box">
        <Search size={18} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people by username" />
      </div>
      <div className="chat-section-title"><span>RECENT CHATS</span></div>
      <div className="conversation-list">
        {filtered.length === 0 && (
          <div className="empty-media">
            <strong>No conversations yet</strong>
            <span>Share a post or search for a friend to start chatting.</span>
          </div>
        )}
        {filtered.map((chat) => (
          <ChatRow key={chat.id} chat={chat} currentUid={currentUid} onOpen={() => setActiveChat({ chatId: chat.id, otherUserId: chat.otherUserId })} />
        ))}
      </div>
    </div>
  );
}

function useUnreadCount(chatId: string, currentUid: string): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const lastReadAt = getLastReadAt(chatId);
    const unsub = subscribeToMessages(chatId, (messages: ChatMessage[]) => {
      const unread = messages.filter(
        (m) => m.senderId !== currentUid && asDate(m.createdAt).getTime() > lastReadAt,
      ).length;
      setCount(unread);
    }, () => {});
    return unsub;
  }, [chatId, currentUid]);
  return count;
}

function ChatRow({ chat, currentUid, onOpen }: { chat: ChatSummary; currentUid: string; onOpen: () => void }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const unread = useUnreadCount(chat.id, currentUid);
  useEffect(() => {
    let active = true;
    fetchProfile(chat.otherUserId).then((p) => { if (active) setProfile(p); });
    return () => { active = false; };
  }, [chat.otherUserId]);
  return (
    <button className="conversation" onClick={onOpen}>
      <div className={unread > 0 ? 'chat-avatar unread' : 'chat-avatar'}>
        <img src={profile?.profilePicUrl || placeholder} alt={profile?.username ?? ''} />
        {unread > 0 && <span className="unread-badge">{unread > 9 ? '9+' : unread}</span>}
      </div>
      <div className="conversation-copy">
        <strong>{profile?.nickname || `@${profile?.username ?? 'someone'}`}</strong>
        <span>{chat.lastMessage || 'Start the conversation'}</span>
      </div>
      <div className="conversation-time">
        {chat.lastAt ? asDate(chat.lastAt).toLocaleDateString() : ''}
        <ChevronRight size={16} />
      </div>
    </button>
  );
}

function ChatThread({ chatId, otherProfile, currentUid, onBack }: { chatId: string; otherProfile: UserProfile | null; currentUid: string; onBack: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsub = subscribeToMessages(chatId, setMessages, () => {});
    return unsub;
  }, [chatId]);

  useEffect(() => {
    const el = document.getElementById('chat-scroll');
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(chatId, draft.trim());
      setDraft('');
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  };

  return (
    <div className="view chat-thread-view">
      <header className="chat-thread-header">
        <button onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button>
        <img src={otherProfile?.profilePicUrl || placeholder} alt="" />
        <strong>{otherProfile?.nickname || `@${otherProfile?.username ?? 'someone'}`}</strong>
      </header>
      <div className="chat-messages" id="chat-scroll">
        {messages.length === 0 && <div className="chat-empty">Say hello to start the conversation.</div>}
        {messages.map((m) => (
          <div className={m.senderId === currentUid ? 'chat-bubble mine' : 'chat-bubble theirs'} key={m.id}>
            <span>{m.text}</span>
            <small>{asDate(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>
          </div>
        ))}
      </div>
      <div className="chat-input-bar">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
          placeholder="Type a message..."
        />
        <button onClick={() => void submit()} disabled={sending || !draft.trim()} aria-label="Send"><Send size={18} /></button>
      </div>
    </div>
  );
}
