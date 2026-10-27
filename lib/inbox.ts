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

export type TelegramBotWebhookInfo = {
  id: string;
  label: string;
  webhookUrl: string | null;
  synced: boolean;
  pendingUpdateCount?: number;
  lastError?: string;
};

export type NgrokStatus = {
  active: boolean;
  status: "inactive" | "starting" | "active" | "error";
  publicUrl: string | null;
  port: number;
  startedAt: string | null;
  error?: string | null;
  isExternal?: boolean;
  whatsapp: {
    url: string | null;
    verifyToken: string;
    appSecretConfigured: boolean;
    verifyTokenConfigured: boolean;
  };
  telegram: {
    urlTemplate: string | null;
    secretConfigured: boolean;
    secret?: string;
    botsCount: number;
    bots: TelegramBotWebhookInfo[];
  };
};
