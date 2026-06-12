import { apiRequest } from './http';
import type {
  AddMemberRequest,
  AiChatRequest,
  AiChatResponse,
  AiHistoryMessage,
  ApiMessageResponse,
  AuthLoginRequest,
  AuthLoginResponse,
  AuthRegisterRequest,
  AuthRegisterResponse,
  BlockUserRequest,
  ChatActionRequest,
  CreateChatRequest,
  CreateChatResponse,
  CreateGroupRequest,
  CreateGroupResponse,
  EditMessageRequest,
  GroupMessage,
  LeafChat,
  LeafChatSummary,
  LeafGroup,
  LeafMessage,
  LeafUser,
  RemoveMemberRequest,
  SetAdminRequest,
  UpdateGroupRequest,
  SendGroupMessageRequest,
  SendMessageRequest,
  SendMessageResponse,
  UpdateProfileRequest,
  UploadFileResponse,
  VerifyEmailRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  GoogleExchangeRequest,
} from './contracts';

type AuthedRequest = {
  token: string;
};

export const authApi = {
  register(data: AuthRegisterRequest) {
    return apiRequest<AuthRegisterResponse>('/auth/register', {
      method: 'POST',
      body: data,
    });
  },

  login(data: AuthLoginRequest) {
    return apiRequest<AuthLoginResponse>('/auth/login', {
      method: 'POST',
      body: data,
    });
  },

  verifyEmail(data: VerifyEmailRequest) {
    return apiRequest<ApiMessageResponse>('/auth/verify-email', {
      method: 'POST',
      body: data,
    });
  },

  resendCode(email: string) {
    return apiRequest<ApiMessageResponse>('/auth/resend-code', {
      method: 'POST',
      body: { email },
    });
  },

  forgotPassword(data: ForgotPasswordRequest) {
    return apiRequest<ApiMessageResponse>('/auth/forgot-password', {
      method: 'POST',
      body: data,
    });
  },

  resetPassword(data: ResetPasswordRequest) {
    return apiRequest<ApiMessageResponse>('/auth/reset-password', {
      method: 'POST',
      body: data,
    });
  },

  googleUrl(redirectUri: string) {
    return apiRequest<{ url: string | null }>(
      `/auth/google/url?redirect_uri=${encodeURIComponent(redirectUri)}`,
    );
  },

  googleExchange(data: GoogleExchangeRequest) {
    return apiRequest<AuthLoginResponse>('/auth/google/exchange', {
      method: 'POST',
      body: data,
    });
  },
};

export const usersApi = {
  me({ token }: AuthedRequest) {
    return apiRequest<LeafUser>('/users/me', { token });
  },

  getById(userId: string, { token }: AuthedRequest) {
    return apiRequest<LeafUser>(`/users/${encodeURIComponent(userId)}`, { token });
  },

  updateProfile(data: UpdateProfileRequest, { token }: AuthedRequest) {
    return apiRequest<ApiMessageResponse>('/users/profile', {
      method: 'PATCH',
      body: data,
      token,
    });
  },

  search(query: string, { token }: AuthedRequest) {
    return apiRequest<LeafUser[]>(`/users/search?q=${encodeURIComponent(query)}`, {
      token,
    });
  },

  block(data: BlockUserRequest, { token }: AuthedRequest) {
    return apiRequest<ApiMessageResponse>('/users/block', {
      method: 'POST',
      body: data,
      token,
    });
  },

  unblock(userId: string, { token }: AuthedRequest) {
    return apiRequest<ApiMessageResponse>(`/users/block/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      token,
    });
  },

  blocked({ token }: AuthedRequest) {
    return apiRequest<LeafUser[]>('/users/blocked', { token });
  },
};

export const chatsApi = {
  create(data: CreateChatRequest, { token }: AuthedRequest) {
    return apiRequest<CreateChatResponse>('/chats/create', {
      method: 'POST',
      body: data,
      token,
    });
  },

  list({ token }: AuthedRequest) {
    return apiRequest<LeafChat[]>('/chats/', { token });
  },

  mine({ token }: AuthedRequest) {
    return apiRequest<LeafChatSummary[]>('/chats/my', { token });
  },

  getById(chatId: string, { token }: AuthedRequest) {
    return apiRequest<LeafChatSummary>(`/chats/${encodeURIComponent(chatId)}`, { token });
  },

  archive(data: ChatActionRequest, { token }: AuthedRequest) {
    return chatAction('/chats/archive', data, token);
  },

  pin(data: ChatActionRequest, { token }: AuthedRequest) {
    return apiRequest<{ message?: string; pinned?: boolean; error?: string }>('/chats/pin', {
      method: 'POST',
      body: data,
      token,
    });
  },

  mute(data: ChatActionRequest, { token }: AuthedRequest) {
    return chatAction('/chats/mute', data, token);
  },

  hide(data: ChatActionRequest, { token }: AuthedRequest) {
    return chatAction('/chats/hide', data, token);
  },

  delete(chatId: string, { token }: AuthedRequest) {
    return apiRequest<ApiMessageResponse>(`/chats/${encodeURIComponent(chatId)}`, {
      method: 'DELETE',
      token,
    });
  },
};

export const messagesApi = {
  send(data: SendMessageRequest, { token }: AuthedRequest) {
    return apiRequest<SendMessageResponse>('/messages/send', {
      method: 'POST',
      body: data,
      token,
    });
  },

  history(chatId: string, { token }: AuthedRequest, skip = 0, limit = 50) {
    return apiRequest<LeafMessage[]>(
      `/messages/${encodeURIComponent(chatId)}?skip=${skip}&limit=${limit}`,
      { token },
    );
  },

  markAsRead(chatId: string, { token }: AuthedRequest) {
    return apiRequest<ApiMessageResponse>(
      `/messages/read/${encodeURIComponent(chatId)}`,
      {
        method: 'PATCH',
        token,
      },
    );
  },

  clearChat(chatId: string, { token }: AuthedRequest) {
    return apiRequest<ApiMessageResponse>(
      `/messages/clear/${encodeURIComponent(chatId)}`,
      {
        method: 'POST',
        token,
      },
    );
  },

  edit(messageId: string, data: EditMessageRequest, { token }: AuthedRequest) {
    return apiRequest<ApiMessageResponse>(
      `/messages/edit/${encodeURIComponent(messageId)}`,
      {
        method: 'PATCH',
        body: data,
        token,
      },
    );
  },

  delete(messageId: string, { token }: AuthedRequest) {
    return apiRequest<ApiMessageResponse>(`/messages/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
      token,
    });
  },

  deleteForMe(messageId: string, { token }: AuthedRequest) {
    return apiRequest<ApiMessageResponse>(
      `/messages/${encodeURIComponent(messageId)}/delete-for-me`,
      {
        method: 'POST',
        token,
      },
    );
  },

  favorite(messageId: string, { token }: AuthedRequest) {
    return apiRequest<{ message: string; favorited: boolean }>(
      `/messages/${encodeURIComponent(messageId)}/favorite`,
      {
        method: 'POST',
        token,
      },
    );
  },
};

export const groupsApi = {
  create(data: CreateGroupRequest, { token }: AuthedRequest) {
    return apiRequest<CreateGroupResponse | { error: string }>('/groups/create', {
      method: 'POST',
      body: data,
      token,
    });
  },

  mine({ token }: AuthedRequest) {
    return apiRequest<LeafGroup[]>('/groups/my', { token });
  },

  getById(groupId: string, { token }: AuthedRequest) {
    return apiRequest<LeafGroup | { error: string }>(
      `/groups/${encodeURIComponent(groupId)}`,
      { token },
    );
  },

  messages(groupId: string, { token }: AuthedRequest, skip = 0, limit = 50) {
    return apiRequest<GroupMessage[]>(
      `/groups/${encodeURIComponent(groupId)}/messages?skip=${skip}&limit=${limit}`,
      { token },
    );
  },

  sendMessage(data: SendGroupMessageRequest, { token }: AuthedRequest) {
    return apiRequest<GroupMessage | { error: string }>('/groups/send-message', {
      method: 'POST',
      body: data,
      token,
    });
  },

  addMember(data: AddMemberRequest, { token }: AuthedRequest) {
    return apiRequest<ApiMessageResponse | { error: string }>('/groups/add-member', {
      method: 'POST',
      body: data,
      token,
    });
  },

  removeMember(data: RemoveMemberRequest, { token }: AuthedRequest) {
    return apiRequest<ApiMessageResponse | { error: string }>('/groups/remove-member', {
      method: 'POST',
      body: data,
      token,
    });
  },

  update(data: UpdateGroupRequest, { token }: AuthedRequest) {
    return apiRequest<LeafGroup | { error: string }>('/groups/update', {
      method: 'POST',
      body: data,
      token,
    });
  },

  setAdmin(data: SetAdminRequest, { token }: AuthedRequest) {
    return apiRequest<{ message: string; group: LeafGroup } | { error: string }>('/groups/set-admin', {
      method: 'POST',
      body: data,
      token,
    });
  },

  leave(groupId: string, { token }: AuthedRequest) {
    return apiRequest<ApiMessageResponse | { error: string }>(
      `/groups/${encodeURIComponent(groupId)}/leave`,
      { method: 'POST', token },
    );
  },

  join(code: string, { token }: AuthedRequest) {
    return apiRequest<{ message: string; group_id?: string } | { error: string }>(
      `/groups/join/${encodeURIComponent(code)}`,
      { method: 'POST', token },
    );
  },
};

export const aiApi = {
  chat(data: AiChatRequest, { token }: AuthedRequest) {
    return apiRequest<AiChatResponse>('/ai/chat', {
      method: 'POST',
      body: data,
      token,
    });
  },

  confirm(taskId: string, { token }: AuthedRequest) {
    return apiRequest<ApiMessageResponse>(`/ai/confirm/${encodeURIComponent(taskId)}`, {
      method: 'POST',
      token,
    });
  },

  history({ token }: AuthedRequest) {
    return apiRequest<AiHistoryMessage[]>('/ai/history', { token });
  },

  clearHistory({ token }: AuthedRequest) {
    return apiRequest<ApiMessageResponse>('/ai/history/clear', {
      method: 'POST',
      token,
    });
  },
};

export const uploadsApi = {
  file(file: File, token?: string) {
    const body = new FormData();
    body.append('file', file);
    return apiRequest<UploadFileResponse>('/upload/file', { method: 'POST', body, token });
  },

  avatar(form: FormData, token: string) {
    return apiRequest<UploadFileResponse>('/upload/avatar', { method: 'POST', body: form, token });
  },

  image(form: FormData, token: string) {
    return apiRequest<UploadFileResponse>('/upload/image', { method: 'POST', body: form, token });
  },

  audio(form: FormData, token: string) {
    return apiRequest<UploadFileResponse>('/upload/audio', { method: 'POST', body: form, token });
  },
};

function chatAction(path: string, data: ChatActionRequest, token: string) {
  return apiRequest<ApiMessageResponse>(path, {
    method: 'POST',
    body: data,
    token,
  });
}
