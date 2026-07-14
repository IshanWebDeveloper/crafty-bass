import { apiFetch } from '../api';

export type ConversationType = 'JOB_DIRECT' | 'DIRECT' | 'SUPPORT';
export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';

export type ConversationParticipant = {
  userId: string;
  joinedAt: string;
  lastReadAt: string | null;
  user: { id: string; name: string; image: string | null };
};

export type ConversationListItem = {
  id: string;
  type: ConversationType;
  jobId: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  participants: ConversationParticipant[];
  job: { id: string; title: string; status: string } | null;
  messages: Array<{
    id: string;
    body: string;
    messageType: MessageType;
    senderId: string;
    createdAt: string;
  }>;
};

export type Conversation = Omit<ConversationListItem, 'messages'>;

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string | null;
  body: string;
  messageType: MessageType;
  attachments: unknown | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export type Paginated<T> = {
  data: T[];
  meta: { total: number; page: number; limit: number; lastPage: number };
};

export function listMyConversations() {
  return apiFetch<Paginated<ConversationListItem>>('/conversations');
}

export function getConversation(id: string) {
  return apiFetch<Conversation>(`/conversations/${id}`);
}

export function listMessages(id: string) {
  return apiFetch<Paginated<Message>>(
    `/conversations/${id}/messages?limit=100`,
  );
}

export type StartConversationBody = {
  type: 'JOB_DIRECT' | 'DIRECT';
  jobId?: string;
  recipientId?: string;
  // Omit to just open (or reuse) the thread without sending an opening message.
  body?: string;
  messageType?: MessageType;
};

export function startConversation(body: StartConversationBody) {
  return apiFetch<{ conversation: Conversation; message: Message | null }>(
    `/conversations`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function sendMessage(conversationId: string, body: string) {
  return apiFetch<Message>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body, messageType: 'TEXT' }),
  });
}

export function markRead(conversationId: string) {
  return apiFetch<{ markedAt: string }>(
    `/conversations/${conversationId}/read`,
    { method: 'PATCH' },
  );
}
