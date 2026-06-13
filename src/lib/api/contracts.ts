export type ApiMessageResponse = {
  message: string;
};

export type AuthRegisterRequest = {
  name: string;
  email: string;
  password: string;
};

export type AuthRegisterResponse = ApiMessageResponse & {
  id: string;
};

export type AuthLoginRequest = {
  email: string;
  password: string;
};

export type AuthLoginResponse = {
  access_token: string;
  token_type: 'bearer';
};

export type VerifyEmailRequest = {
  code: string;
  email?: string;
};

export type ForgotPasswordRequest = {
  email: string;
};

export type ResetPasswordRequest = {
  token: string;
  password: string;
};

export type GoogleExchangeRequest = {
  code: string;
  redirect_uri: string;
};

export type LeafUser = {
  _id: string;
  name: string;
  username?: string;
  email: string;
  verified?: boolean;
  display_name?: string;
  bio?: string;
  avatar?: string;
  phone?: string;
  phone_verified?: boolean;
  searchable?: boolean;
  show_read_receipts?: boolean;
  online?: boolean;
  last_seen?: string;
  created_at?: string;
};

export type UpdateProfileRequest = {
  display_name?: string;
  bio?: string;
  avatar?: string;
  phone?: string;
  searchable?: boolean;
  show_read_receipts?: boolean;
};

export type BlockUserRequest = {
  user_id: string;
};

export type CreateChatRequest = {
  user_id: string;
};

export type CreateChatResponse = {
  chat_id: string;
  existing: boolean;
};

export type ChatActionRequest = {
  chat_id: string;
  /** silenciar por N minutos; null/ausente = para sempre (ao silenciar) */
  mute_minutes?: number | null;
  /** reativar notificações */
  unmute?: boolean;
};

export type ChatLastMessage = {
  content: string;
  type?: string;
  created_at: string;
  status?: MessageStatus;
};

export type LeafChat = {
  _id: string;
  participants?: string[];
  members?: string[];
  created_at?: string;
  updated_at?: string;
  last_message?: ChatLastMessage | null;
};

export type LeafChatSummary = LeafChat & {
  /** discrimina conversa 1:1 ("chat") de grupo ("group") na lista unificada */
  kind?: 'chat' | 'group';
  /** dados básicos do outro participante embutidos pelo backend (evita N+1) */
  other_user?: LeafUser | null;
  /** grupos: nome, foto e contagem de membros */
  name?: string;
  photo?: string | null;
  member_count?: number;
  pinned?: boolean;
  archived?: boolean;
  muted?: boolean;
  unread_count?: number;
};

export type MessageStatus = 'sent' | 'delivered' | 'read';

export type SendMessageRequest = {
  chat_id: string;
  receiver_id: string;
  content?: string;
  type?: 'text' | 'file' | string;
  file_url?: string | null;
  reply_to?: string | null;
};

export type SendMessageResponse = {
  message: 'sent' | string;
  status: MessageStatus;
  // campos extras retornados pelo backend para atualização otimista
  _id?: string;
  chat_id?: string;
  sender_id?: string;
  receiver_id?: string;
  content?: string;
  type?: string;
  file_url?: string | null;
  reply_to?: string | null;
  reply_preview?: ReplyPreview | null;
  created_at?: string;
  read?: boolean;
  edited?: boolean;
  deleted?: boolean;
};

export type EditMessageRequest = {
  content: string;
};

export type MessageType = 'text' | 'image' | 'audio' | 'file';

export type LeafMessage = {
  _id: string;
  chat_id: string;
  sender_id: string;
  receiver_id?: string;
  receiver_name?: string;
  content: string;
  type?: MessageType;
  file_url?: string | null;
  status?: MessageStatus;
  read?: boolean;
  read_by?: string[];
  read_at?: string;
  edited?: boolean;
  deleted?: boolean;
  created_at?: string;
  /** id da mensagem citada (resposta) */
  reply_to?: string | null;
  /** prévia denormalizada da mensagem citada (montada pelo backend no envio) */
  reply_preview?: ReplyPreview | null;
  /** favoritada pelo usuário atual */
  favorited?: boolean;
};

export type ReplyPreview = {
  _id: string;
  sender_id: string;
  content: string;
  type?: MessageType;
};

export type CreateGroupRequest = {
  name: string;
  members: string[];
};

export type CreateGroupResponse = {
  group_id: string;
};

export type AddMemberRequest = {
  group_id: string;
  user_id: string;
};

export type RemoveMemberRequest = {
  group_id: string;
  user_id: string;
};

export type SendGroupMessageRequest = {
  group_id: string;
  content: string;
  type?: MessageType;
  file_url?: string | null;
};

export type GroupLastMessage = {
  content: string;
  sender_id: string;
  created_at?: string | null;
};

export type LeafGroup = {
  _id: string;
  name: string;
  description?: string;
  photo?: string | null;
  members: string[];
  admins: string[];
  only_admins_can_send?: boolean;
  invite_code?: string;
  created_by?: string;
  member_count?: number;
  last_message?: GroupLastMessage | null;
  created_at?: string;
  updated_at?: string;
};

export type UpdateGroupRequest = {
  group_id: string;
  name?: string;
  description?: string;
  only_admins_can_send?: boolean;
};

export type SetAdminRequest = {
  group_id: string;
  user_id: string;
  make_admin: boolean;
};

export type GroupMessage = {
  _id: string;
  group_id: string;
  sender_id: string;
  content: string;
  type?: MessageType;
  file_url?: string | null;
  created_at?: string | null;
};

export type AiChatRequest = {
  message: string;
  attachment_url?: string | null;
  attachment_mime?: string | null;
  timezone?: string;
  tz_offset?: number;
};

export type AiActionCard = {
  task_id: string;
  type: 'send' | 'schedule';
  title?: string;
  recipient?: string;
  scheduledFor?: string | null;
  body?: string;
};

export type AiChatResponse =
  | { reply: string; action?: AiActionCard }
  | ApiMessageResponse
  | { error: string };

export type AiHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
  created_at?: string | null;
};

export type UploadFileResponse = {
  url: string;
};
