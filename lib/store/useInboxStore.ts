import { create } from "zustand";

import type { ChannelConnection, ChannelKind, Conversation } from "@/lib/inbox";

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
  resetTelegramFlow: () => void;
  refresh: () => Promise<void>;
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

  resetTelegramFlow: () =>
    set({
      modalKind: null,
      telegramPendingId: "",
      telegramNeedsPassword: false,
    }),

  refresh: () => {
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
            state.selectedId && result.conversations.some((conversation) => conversation.id === state.selectedId)
              ? state.selectedId
              : result.conversations[0]?.id ?? null,
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
