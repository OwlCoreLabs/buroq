export type ChannelKind = "whatsapp-business" | "telegram-bot" | "telegram-personal";

export type Message = {
  id: number;
  providerMessageId: string;
  body: string;
  direction: "inbound" | "outbound";
  createdAt: number;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaName?: string;
};

export type Conversation = {
  id: number;
  connectionId: string;
  providerChatId: string;
  title: string;
  handle: string;
  preview: string;
  lastMessageAt: number;
  unreadCount: number;
  channel: ChannelKind;
  messages: Message[];
};

export type ChannelConnection = {
  id: string;
  kind: ChannelKind;
  label: string;
  status: "connected" | "pending";
};

export const channelLabels: Record<ChannelKind, string> = {
  "whatsapp-business": "WhatsApp Business",
  "telegram-bot": "Telegram bot",
  "telegram-personal": "Telegram personal",
};
