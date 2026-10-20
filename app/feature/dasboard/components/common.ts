import type { ChannelKind } from "@/lib/inbox";

export const channelKinds: ChannelKind[] = [
  "whatsapp-business",
  "telegram-bot",
  "telegram-personal",
];

export function formatTime(timestamp: number) {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}
