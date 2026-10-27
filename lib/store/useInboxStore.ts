import { create } from "zustand";

import type { ChannelConnection, ChannelKind, Conversation, NgrokStatus } from "@/lib/inbox";

type InboxResult = {
  connections: ChannelConnection[];
  conversations: Conversation[];
  syncWarnings?: string[];
};

export type InboxFilter = "all" | string;

type InboxState = {
  connections: ChannelConnection[];
  conversations: Conversation[];
  selectedId: number | null;
  activeFilter: InboxFilter;
  search: string;
  reply: string;
  loading: boolean;
  busy: boolean;
  error: string;
  modalKind: ChannelKind | null;
  telegramPendingId: string;
  telegramNeedsPassword: boolean;
  deleteAccountOpen: boolean;
  deletePassword: string;
  deleteError: string;
  ngrokStatus: NgrokStatus | null;
  ngrokLoading: boolean;
  ngrokModalOpen: boolean;

  setConnections: (connections: ChannelConnection[]) => void;
  setConversations: (conversations: Conversation[]) => void;
  setSelectedId: (selectedId: number | null | ((current: number | null) => number | null)) => void;
  setActiveFilter: (activeFilter: InboxFilter | ((current: InboxFilter) => InboxFilter)) => void;
  setSearch: (search: string) => void;
  setReply: (reply: string) => void;
  setLoading: (loading: boolean) => void;
  setBusy: (busy: boolean) => void;
  setError: (error: string) => void;
  setModalKind: (modalKind: ChannelKind | null) => void;
  setTelegramPendingId: (telegramPendingId: string) => void;
  setTelegramNeedsPassword: (telegramNeedsPassword: boolean) => void;
  setDeleteAccountOpen: (deleteAccountOpen: boolean) => void;
  setDeletePassword: (deletePassword: string) => void;
  setDeleteError: (deleteError: string) => void;
  setNgrokStatus: (status: NgrokStatus | null) => void;
  setNgrokLoading: (loading: boolean) => void;
  setNgrokModalOpen: (open: boolean) => void;
  resetTelegramFlow: () => void;
  refresh: () => Promise<void>;
  refreshNgrokStatus: () => Promise<NgrokStatus | null>;
  startNgrok: (port?: number, domain?: string) => Promise<NgrokStatus | null>;
  stopNgrok: () => Promise<NgrokStatus | null>;
  syncTelegramWebhooks: () => Promise<NgrokStatus | null>;
  saveWebhookSettings: (updates: {
    whatsappVerifyToken?: string;
    whatsappAppSecret?: string;
    telegramSecret?: string;
  }) => Promise<NgrokStatus | null>;
  testWhatsAppWebhook: () => Promise<{ ok: boolean; message: string }>;
  selectConversation: (conversation: Conversation) => void;
};

let refreshPromise: Promise<void> | null = null;

const initialState = {
  connections: [] as ChannelConnection[],
  conversations: [] as Conversation[],
  selectedId: null as number | null,
  activeFilter: "all" as InboxFilter,
  search: "",
  reply: "",
  loading: true,
  busy: false,
  error: "",
  modalKind: null as ChannelKind | null,
  telegramPendingId: "",
  telegramNeedsPassword: false,
  deleteAccountOpen: false,
  deletePassword: "",
  deleteError: "",
  ngrokStatus: null as NgrokStatus | null,
  ngrokLoading: false,
  ngrokModalOpen: false,
};

export const useInboxStore = create<InboxState>((set, get) => ({
  ...initialState,

  setConnections: (connections) => set({ connections }),
  setConversations: (conversations) => set({ conversations }),
  setSelectedId: (selectedId) =>
    set((state) => ({
      selectedId: typeof selectedId === "function" ? selectedId(state.selectedId) : selectedId,
    })),
  setActiveFilter: (activeFilter) =>
    set((state) => ({
      activeFilter:
        typeof activeFilter === "function" ? activeFilter(state.activeFilter) : activeFilter,
    })),
  setSearch: (search) => set({ search }),
  setReply: (reply) => set({ reply }),
  setLoading: (loading) => set({ loading }),
  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error }),
  setModalKind: (modalKind) => set({ modalKind }),
  setTelegramPendingId: (telegramPendingId) => set({ telegramPendingId }),
  setTelegramNeedsPassword: (telegramNeedsPassword) => set({ telegramNeedsPassword }),
  setDeleteAccountOpen: (deleteAccountOpen) => set({ deleteAccountOpen }),
  setDeletePassword: (deletePassword) => set({ deletePassword }),
  setDeleteError: (deleteError) => set({ deleteError }),
  setNgrokStatus: (ngrokStatus) => set({ ngrokStatus }),
  setNgrokLoading: (ngrokLoading) => set({ ngrokLoading }),
  setNgrokModalOpen: (ngrokModalOpen) => set({ ngrokModalOpen }),

  resetTelegramFlow: () =>
    set({
      modalKind: null,
      telegramPendingId: "",
      telegramNeedsPassword: false,
    }),

  refreshNgrokStatus: async () => {
    try {
      const response = await fetch("/api/ngrok", { cache: "no-store" });
      if (!response.ok) return null;
      const data = (await response.json()) as NgrokStatus;
      set({ ngrokStatus: data });
      return data;
    } catch {
      return null;
    }
  },

  startNgrok: async (port, domain) => {
    set({ ngrokLoading: true });
    try {
      const response = await fetch("/api/ngrok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", port, domain }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to start ngrok");
      }
      set({ ngrokStatus: data });
      return data as NgrokStatus;
    } finally {
      set({ ngrokLoading: false });
    }
  },

  stopNgrok: async () => {
    set({ ngrokLoading: true });
    try {
      const response = await fetch("/api/ngrok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to stop ngrok");
      }
      set({ ngrokStatus: data });
      return data as NgrokStatus;
    } finally {
      set({ ngrokLoading: false });
    }
  },

  syncTelegramWebhooks: async () => {
    set({ ngrokLoading: true });
    try {
      const response = await fetch("/api/ngrok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to sync Telegram webhooks");
      }
      set({ ngrokStatus: data });
      return data as NgrokStatus;
    } finally {
      set({ ngrokLoading: false });
    }
  },

  saveWebhookSettings: async (updates) => {
    set({ ngrokLoading: true });
    try {
      const response = await fetch("/api/ngrok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_settings", ...updates }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save webhook settings");
      }
      set({ ngrokStatus: data });
      return data as NgrokStatus;
    } finally {
      set({ ngrokLoading: false });
    }
  },

  testWhatsAppWebhook: async () => {
    const response = await fetch("/api/ngrok", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test_whatsapp" }),
    });
    return (await response.json()) as { ok: boolean; message: string };
  },

  refresh: () => {
    void get().refreshNgrokStatus();
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      set({ error: "" });

      try {
        const response = await fetch("/api/inbox", { cache: "no-store" });
        const result = (await response.json()) as InboxResult & { error?: string };

        if (!response.ok) throw new Error(result.error ?? "Could not load messages.");

        set((state) => ({
          connections: result.connections,
          conversations: result.conversations,
          error: result.syncWarnings?.join(" ") ?? "",
          selectedId:
            state.selectedId &&
            result.conversations.some((conversation) => conversation.id === state.selectedId)
              ? state.selectedId
              : (result.conversations[0]?.id ?? null),
        }));
      } catch (cause) {
        set({
          error: cause instanceof Error ? cause.message : "Could not load messages.",
        });
      } finally {
        set({ loading: false });
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  selectConversation: (conversation) => {
    set({ selectedId: conversation.id });
    if (conversation.unreadCount > 0) {
      void fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversation.id }),
      }).then(() => {
        void get().refresh();
      });
    }
  },
}));
