const STORAGE_KEY = 'mk_app_lock_v1';
const SALT_LENGTH = 16;

export type LockTiming = 'immediate' | '1m' | '5m' | 'onReopen';
export const TIMING_LABELS: Record<LockTiming, string> = {
  immediate: 'Immediately',
  '1m': 'After 1 minute',
  '5m': 'After 5 minutes',
  onReopen: 'Only when app is closed and reopened',
};
export const TIMING_OPTIONS: LockTiming[] = ['immediate', '1m', '5m', 'onReopen'];

type StoredLock = {
  salt: string;
  hash: string;
  timing: LockTiming;
  lastBackgroundedAt: number | null;
};

const TIMING_MS: Record<LockTiming, number> = { immediate: 0, '1m': 60_000, '5m': 300_000, onReopen: Infinity };

const read = (): StoredLock | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredLock;
  } catch {
    return null;
  }
};

const write = (data: StoredLock) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
const remove = () => localStorage.removeItem(STORAGE_KEY);

const bytesToHex = (bytes: Uint8Array): string => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
const hexToBytes = (hex: string): Uint8Array => new Uint8Array(hex.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []);

const randomSalt = (): string => {
  const arr = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
};

const deriveHash = async (password: string, saltHex: string): Promise<string> => {
  const enc = new TextEncoder();
  const salt = hexToBytes(saltHex);
  const material = enc.encode(password);
  const baseKey = await crypto.subtle.importKey('raw', material, { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 120_000, hash: 'SHA-256' },
    baseKey,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
};

export const isAppLockEnabled = (): boolean => read() !== null;

export const getLockTiming = (): LockTiming => read()?.timing ?? 'immediate';

export const setAppLockPassword = async (password: string, timing: LockTiming = 'immediate'): Promise<void> => {
  const salt = randomSalt();
  const hash = await deriveHash(password, salt);
  write({ salt, hash, timing, lastBackgroundedAt: null });
};

export const clearAppLock = (): void => remove();

export const verifyAppLockPassword = async (password: string): Promise<boolean> => {
  const stored = read();
  if (!stored) return false;
  const candidate = await deriveHash(password, stored.salt);
  return candidate === stored.hash;
};

export const changeAppLockPassword = async (current: string, next: string, timing?: LockTiming): Promise<boolean> => {
  const stored = read();
  if (!stored) return false;
  const candidate = await deriveHash(current, stored.salt);
  if (candidate !== stored.hash) return false;
  const salt = randomSalt();
  const hash = await deriveHash(next, salt);
  write({ salt, hash, timing: timing ?? stored.timing, lastBackgroundedAt: null });
  return true;
};

export const setLockTiming = async (current: string, timing: LockTiming): Promise<boolean> => {
  const stored = read();
  if (!stored) return false;
  const candidate = await deriveHash(current, stored.salt);
  if (candidate !== stored.hash) return false;
  write({ ...stored, timing, lastBackgroundedAt: null });
  return true;
};

export const isPasswordValid = (password: string): boolean => /^[a-zA-Z0-9]{4,}$/.test(password);

export const recordBackgrounded = (): void => {
  const stored = read();
  if (!stored) return;
  write({ ...stored, lastBackgroundedAt: Date.now() });
};

export const shouldLockOnForeground = (): boolean => {
  const stored = read();
  if (!stored) return false;
  if (stored.timing === 'onReopen') {
    return stored.lastBackgroundedAt !== null;
  }
  if (stored.lastBackgroundedAt === null) return false;
  const elapsed = Date.now() - stored.lastBackgroundedAt;
  return elapsed >= TIMING_MS[stored.timing];
};

export const consumeReopenFlag = (): void => {
  const stored = read();
  if (!stored) return;
  if (stored.timing === 'onReopen' && stored.lastBackgroundedAt !== null) {
    write({ ...stored, lastBackgroundedAt: null });
  }
};
