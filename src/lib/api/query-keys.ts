export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    currentUser: ['auth', 'currentUser'] as const,
  },
  chats: {
    all: ['chats'] as const,
    mine: ['chats', 'mine'] as const,
    byId: (chatId: string) => ['chats', 'id', chatId] as const,
  },
  messages: {
    all: ['messages'] as const,
    byChatId: (chatId: string) => ['messages', chatId] as const,
  },
  users: {
    all: ['users'] as const,
    search: (query: string) => ['users', 'search', query] as const,
  },
} as const;
