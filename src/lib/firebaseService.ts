import { deleteDoc, doc, addDoc, collection, collectionGroup, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, type DocumentData, type Unsubscribe } from 'firebase/firestore';
import { createUserWithEmailAndPassword, deleteUser, EmailAuthProvider, linkWithCredential, RecaptchaVerifier, signInWithEmailAndPassword, signInWithPhoneNumber, signOut, updatePassword, type ConfirmationResult, type User } from 'firebase/auth';
export type { ConfirmationResult };
import { auth, authReady, db } from './firebase';
import { uploadToCloudinary } from './cloudinary';

type FirestoreNote = { id: string; text: string; pinned?: boolean; createdAt?: { toDate?: () => Date } };
export type UserMedia = { id: string; ownerId: string; url: string; name: string; caption: string; type: 'photos' | 'videos'; cloudinaryPublicId: string; published: boolean; createdAt?: { toDate?: () => Date } };
export type UserProfile = { uid: string; username: string; nickname: string; phone: string; profilePicUrl: string; bio: string; dateOfBirth: string; authEmail: string };

export type FeedPost =
  | { kind: 'note'; id: string; ownerId: string; text: string; createdAt?: { toDate?: () => Date } }
  | { kind: 'media'; id: string; ownerId: string; url: string; name: string; caption: string; type: 'photos' | 'videos'; cloudinaryPublicId: string; createdAt?: { toDate?: () => Date } };

export type Comment = { id: string; userId: string; username: string; nickname?: string; profilePicUrl: string; text: string; createdAt?: { toDate?: () => Date } };

const authEmailForUsername = (username: string) => `${username.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@mkvirtualworld.app`;

const profileCache = new Map<string, UserProfile>();
export const fetchProfile = async (uid: string): Promise<UserProfile | null> => {
  const cached = profileCache.get(uid);
  if (cached) return cached;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const profile = snap.data() as UserProfile;
    profileCache.set(uid, profile);
    return profile;
  } catch {
    return null;
  }
};

export const getCurrentProfile = async (uid: string): Promise<UserProfile | null> => fetchProfile(uid);

export const searchUsersByUsername = async (queryText: string): Promise<UserProfile[]> => {
  const term = queryText.trim().toLowerCase();
  if (!term) return [];
  const snap = await getDocs(query(collection(db, 'users'), where('username', '>=', term), where('username', '<=', term + '\uf8ff'), limit(10)));
  return snap.docs.map((d) => d.data() as UserProfile).filter((p) => p.uid !== auth.currentUser?.uid);
};

export const signInWithUsername = async (username: string, password: string): Promise<User> => {
  await authReady;
  const profileQuery = query(collection(db, 'users'), where('username', '==', username.trim().toLowerCase()), limit(1));
  const profileSnapshot = await getDocs(profileQuery);
  if (profileSnapshot.empty) throw new Error('We could not find that username.');
  const profile = profileSnapshot.docs[0].data() as UserProfile;
  const result = await signInWithEmailAndPassword(auth, profile.authEmail, password);
  return result.user;
};

let recaptchaVerifier: RecaptchaVerifier | null = null;
export const getRecaptchaVerifier = (): RecaptchaVerifier => {
  if (recaptchaVerifier) return recaptchaVerifier;
  recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
  return recaptchaVerifier;
};

export const startPhoneVerification = async (phone: string): Promise<ConfirmationResult> => {
  await authReady;
  const verifier = getRecaptchaVerifier();
  return signInWithPhoneNumber(auth, phone.trim(), verifier);
};

export const verifyPhoneOtp = async (confirmation: ConfirmationResult, otp: string): Promise<User> => {
  const result = await confirmation.confirm(otp);
  return result.user;
};

export const findProfileForRecovery = async (identifier: string): Promise<UserProfile> => {
  await authReady;
  const term = identifier.trim();
  if (!term) throw new Error('Enter your username or mobile number.');
  let profile: UserProfile | undefined;
  if (/^\+\d{8,15}$/.test(term)) {
    const snap = await getDocs(query(collection(db, 'users'), where('phone', '==', term), limit(1)));
    if (!snap.empty) profile = snap.docs[0].data() as UserProfile;
  } else {
    const normalized = term.toLowerCase().replace(/^@/, '');
    const snap = await getDocs(query(collection(db, 'users'), where('username', '==', normalized), limit(1)));
    if (!snap.empty) profile = snap.docs[0].data() as UserProfile;
  }
  if (!profile) throw new Error('No account found with that username or number.');
  if (!profile.phone) throw new Error('This account does not have a recovery number.');
  return profile;
};

export const updateCurrentUserPassword = async (newPassword: string): Promise<void> => {
  await authReady;
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Your session expired. Please verify again.');
  await updatePassword(currentUser, newPassword);
};

export const createAccount = async (phone: string, password: string, username: string, nickname: string): Promise<User> => {
  await authReady;
  const normalizedUsername = username.trim().toLowerCase().replace(/^@/, '');
  const usernameQuery = query(collection(db, 'users'), where('username', '==', normalizedUsername), limit(1));
  const usernameSnapshot = await getDocs(usernameQuery);
  if (!usernameSnapshot.empty) throw new Error('That username is already taken.');
  const authEmail = authEmailForUsername(normalizedUsername);
  const currentUser = auth.currentUser;
  let resultUser: User;
  if (currentUser) {
    const credential = EmailAuthProvider.credential(authEmail, password);
    const linked = await linkWithCredential(currentUser, credential);
    resultUser = linked.user;
  } else {
    resultUser = await createUserWithEmailAndPassword(auth, authEmail, password).then((r) => r.user);
  }
  await setDoc(doc(db, 'users', resultUser.uid), {
    uid: resultUser.uid,
    phone: phone.trim(),
    username: normalizedUsername,
    nickname: nickname.trim(),
    authEmail,
    profilePicUrl: '',
    bio: '',
    dateOfBirth: '',
    createdAt: serverTimestamp(),
  });
  return resultUser;
};

export const subscribeToNotes = (uid: string, onNotes: (notes: FirestoreNote[]) => void, onError: (error: Error) => void): Unsubscribe => {
  const notesQuery = query(collection(db, 'users', uid, 'notes'), orderBy('createdAt', 'desc'));
  return onSnapshot(notesQuery, (snapshot) => {
    onNotes(snapshot.docs.map((note) => ({ id: note.id, ...(note.data() as Omit<FirestoreNote, 'id'>) })));
  }, onError);
};

export const saveUserNote = async (uid: string, text: string) => addDoc(collection(db, 'users', uid, 'notes'), { text, pinned: false, createdAt: serverTimestamp() });
export const deleteUserNote = async (uid: string, noteId: string) => deleteDoc(doc(db, 'users', uid, 'notes', noteId));
export const logOut = () => signOut(auth);

export const subscribeToMedia = (_uid: string, type: 'photos' | 'videos', onMedia: (items: UserMedia[]) => void, onError: (error: Error) => void): Unsubscribe => {
  const mediaQuery = query(collectionGroup(db, 'media'));
  return onSnapshot(mediaQuery, (snapshot) => {
    const publishedItems = snapshot.docs
      .map((item) => ({ id: item.id, ...(item.data() as Omit<UserMedia, 'id'>) }))
      .filter((item) => item.published === true && item.type === type)
      .sort((a, b) => asDate(b.createdAt).getTime() - asDate(a.createdAt).getTime());
    onMedia(publishedItems);
  }, onError);
};

export const uploadUserMedia = async (uid: string, file: File, type: 'photos' | 'videos', caption: string, onProgress?: (percent: number) => void) => {
  const resourceType = type === 'photos' ? 'image' : 'video';
  const { url, publicId } = await uploadToCloudinary(file, resourceType, onProgress);
  await addDoc(collection(db, 'users', uid, 'media'), { ownerId: uid, url, name: file.name, caption, type, cloudinaryPublicId: publicId, published: true, createdAt: serverTimestamp() });
  return url;
};

export const deleteUserMedia = async (uid: string, item: UserMedia) => {
  if (item.ownerId !== uid) throw new Error('Only the creator can delete this post.');
  await deleteDoc(doc(db, 'users', item.ownerId, 'media', item.id));
};

export const updateMediaCaption = async (uid: string, ownerId: string, mediaId: string, caption: string) => {
  if (ownerId !== uid) throw new Error('Only the creator can edit this post.');
  await updateDoc(doc(db, 'users', ownerId, 'media', mediaId), { caption });
};

export const updateUserProfile = async (uid: string, updates: Partial<Pick<UserProfile, 'username' | 'nickname' | 'profilePicUrl' | 'bio' | 'dateOfBirth'>>) => {
  if (auth.currentUser?.uid !== uid) throw new Error('You can only edit your own profile.');
  const normalized = updates.username ? updates.username.trim().toLowerCase().replace(/^@/, '') : undefined;
  if (normalized !== undefined && normalized !== (await getDoc(doc(db, 'users', uid))).get('username')) {
    const usernameQuery = query(collection(db, 'users'), where('username', '==', normalized), limit(1));
    const usernameSnapshot = await getDocs(usernameQuery);
    if (!usernameSnapshot.empty) throw new Error('That username is already taken.');
    const authEmail = authEmailForUsername(normalized);
    await updateDoc(doc(db, 'users', uid), { ...updates, username: normalized, authEmail });
    const updated = { ...(await getDoc(doc(db, 'users', uid))).data() } as UserProfile;
    profileCache.set(uid, updated);
    return updated;
  }
  await updateDoc(doc(db, 'users', uid), updates);
  const snap = await getDoc(doc(db, 'users', uid));
  const updatedProfile = snap.data() as UserProfile;
  profileCache.set(uid, updatedProfile);
  return updatedProfile;
};

// Unified public feed: all notes + all published media across every user.
export const subscribeToFeed = (onPosts: (posts: FeedPost[]) => void, onError: (error: Error) => void): Unsubscribe => {
  const notesQ = query(collectionGroup(db, 'notes'));
  const mediaQ = query(collectionGroup(db, 'media'));
  let notesRaw: FeedPost[] = [];
  let mediaRaw: FeedPost[] = [];
  const emit = () => {
    const all = [...notesRaw, ...mediaRaw];
    all.sort((a, b) => asDate(b.createdAt).getTime() - asDate(a.createdAt).getTime());
    onPosts(all);
  };
  const unsubNotes = onSnapshot(notesQ, (snap) => {
    notesRaw = snap.docs.map((d) => ({ kind: 'note', id: d.id, ...(d.data() as Omit<FeedPost, 'kind' | 'id'>) }) as FeedPost);
    emit();
  }, onError);
  const unsubMedia = onSnapshot(mediaQ, (snap) => {
    mediaRaw = snap.docs
      .map((d) => ({ kind: 'media', id: d.id, ownerId: d.get('ownerId'), url: d.get('url'), name: d.get('name'), caption: d.get('caption') ?? '', type: d.get('type'), cloudinaryPublicId: d.get('cloudinaryPublicId'), published: d.get('published'), createdAt: d.get('createdAt') }) as Extract<FeedPost, { kind: 'media' }> & { published?: boolean })
      .filter((p) => p.published !== false) as FeedPost[];
    emit();
  }, onError);
  return () => { unsubNotes(); unsubMedia(); };
};

// Likes
export const subscribeToLikes = (parentPath: string, onLikes: (count: number, likedByMe: boolean) => void, onError: (error: Error) => void): Unsubscribe => {
  const likesQ = query(collection(db, parentPath, 'likes'));
  return onSnapshot(likesQ, (snap) => {
    const docs = snap.docs;
    const count = docs.length;
    const likedByMe = docs.some((d) => d.id === auth.currentUser?.uid);
    onLikes(count, likedByMe);
  }, onError);
};

export const toggleLike = async (parentPath: string) => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in to like posts.');
  const likeRef = doc(db, parentPath, 'likes', uid);
  const existing = await getDoc(likeRef);
  if (existing.exists()) {
    await deleteDoc(likeRef);
  } else {
    await setDoc(likeRef, { userId: uid, createdAt: serverTimestamp() });
  }
};

// Comments
export const subscribeToComments = (parentPath: string, onComments: (comments: Comment[]) => void, onError: (error: Error) => void): Unsubscribe => {
  const commentsQ = query(collection(db, parentPath, 'comments'), orderBy('createdAt', 'asc'));
  return onSnapshot(commentsQ, (snap) => {
    onComments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Comment, 'id'>) })));
  }, onError);
};

export const addComment = async (parentPath: string, text: string, profile: UserProfile) => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in to comment.');
  await addDoc(collection(db, parentPath, 'comments'), {
    userId: uid,
    username: profile.username,
    nickname: profile.nickname ?? '',
    profilePicUrl: profile.profilePicUrl ?? '',
    text,
    createdAt: serverTimestamp(),
  });
};

export const removeCurrentUser = async () => {
  if (auth.currentUser) await deleteUser(auth.currentUser);
};

export const asDate = (value: DocumentData['createdAt']): Date => value?.toDate?.() ?? new Date();

// Chats
export type ChatSummary = { id: string; otherUserId: string; lastMessage: string; lastAt?: { toDate?: () => Date } };
export type ChatMessage = { id: string; senderId: string; text: string; createdAt?: { toDate?: () => Date } };

const chatIdFor = (a: string, b: string) => (a < b ? `${a}_${b}` : `${b}_${a}`);

export const findOrCreateChat = async (otherUserId: string): Promise<string> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in to message people.');
  const id = chatIdFor(uid, otherUserId);
  const ref = doc(db, 'chats', id);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    await setDoc(ref, { participants: [uid, otherUserId], createdAt: serverTimestamp(), lastMessage: '', lastAt: serverTimestamp() });
  }
  return id;
};

export const subscribeToMyChats = (onChats: (chats: ChatSummary[]) => void, onError: (error: Error) => void): Unsubscribe => {
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};
  const q = query(collection(db, 'chats'), where('participants', 'array-contains', uid));
  return onSnapshot(q, async (snap) => {
    const chats = snap.docs.map((d) => {
      const data = d.data() as { participants: string[]; lastMessage: string; lastAt?: { toDate?: () => Date } };
      const otherUserId = data.participants.find((p) => p !== uid) ?? '';
      return { id: d.id, otherUserId, lastMessage: data.lastMessage, lastAt: data.lastAt } as ChatSummary;
    });
    onChats(chats);
  }, onError);
};

export const subscribeToMessages = (chatId: string, onMessages: (messages: ChatMessage[]) => void, onError: (error: Error) => void): Unsubscribe => {
  const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    onMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) })));
  }, onError);
};

export const sendMessage = async (chatId: string, text: string) => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in to message people.');
  await addDoc(collection(db, 'chats', chatId, 'messages'), { senderId: uid, text, createdAt: serverTimestamp() });
  await setDoc(doc(db, 'chats', chatId), { lastMessage: text, lastAt: serverTimestamp() }, { merge: true });
};
