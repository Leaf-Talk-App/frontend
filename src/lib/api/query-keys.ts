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
  groups: {
    all: ['groups'] as const,
    mine: ['groups', 'mine'] as const,
    byId: (groupId: string) => ['groups', 'id', groupId] as const,
    messages: (groupId: string) => ['groups', 'messages', groupId] as const,
  },
  users: {
    all: ['users'] as const,
    search: (query: string) => ['users', 'search', query] as const,
  },
} as const;
