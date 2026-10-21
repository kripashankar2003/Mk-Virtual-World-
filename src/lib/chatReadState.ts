const KEY = 'mk_chat_read_at_v1';

const read = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
};

const write = (data: Record<string, number>) => {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
};

export const getLastReadAt = (chatId: string): number => read()[chatId] ?? 0;

export const markChatRead = (chatId: string): void => {
  const all = read();
  all[chatId] = Date.now();
  write(all);
};
