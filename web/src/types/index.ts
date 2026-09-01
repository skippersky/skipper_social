/**
 * Client-side mirror of the Sprint 3 backend DTO contract (see API_CONTRACT.md).
 * Until the backend exposes these endpoints the client degrades to mock data.
 */
export interface Conversation {
  id: string;
  contactName: string;
  contactPhone: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
  avatarUrl?: string;
}

export type MessageType = 'text' | 'image' | 'location';
export type MessageSender = 'user' | 'contact';
export type MessageStatus = 'sending' | 'sent' | 'read';

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  type: MessageType;
  sender: MessageSender;
  timestamp: number;
  status: MessageStatus;
  /** Present for image/location messages (image URL or map link). */
  mediaUrl?: string;
}