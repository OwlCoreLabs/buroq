import { useEffect, useMemo, useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";

import type { ChannelConnection, ChannelKind } from "@/lib/inbox";
import { useInboxStore } from "@/lib/store/useInboxStore";

export function useInboxDashboard() {
  const router = useRouter();
  const [deletingConversationId, setDeletingConversationId] = useState<number | null>(null);
  const {
    connections,
    conversations,
    selectedId,
    activeFilter,
    search,
    reply,
    loading,
    busy,
    error,
    modalKind,
    telegramPendingId,
    telegramNeedsPassword,
    deleteAccountOpen,
    deletePassword,
    deleteError,
    ngrokStatus,
    ngrokLoading,
    ngrokModalOpen,
    setActiveFilter,
    setBusy,
    setDeleteAccountOpen,
    setDeleteError,
    setDeletePassword,
    setError,
    setModalKind,
    setReply,
    setSearch,
    setTelegramNeedsPassword,
    setTelegramPendingId,
    setNgrokModalOpen,
    resetTelegramFlow,
    refresh,
    refreshNgrokStatus,
    startNgrok,
    stopNgrok,
    syncTelegramWebhooks,
    saveWebhookSettings,
    testWhatsAppWebhook,
    selectConversation: selectInboxConversation,
  } = useInboxStore();

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    const handleInboxUpdate = () => {
      void refresh();
    };

    socket.on("connect", handleInboxUpdate);
    socket.on("inbox:updated", handleInboxUpdate);

    const refreshTimer = window.setInterval(handleInboxUpdate, 5_000);

    return () => {
      window.clearInterval(refreshTimer);
      socket.off("connect", handleInboxUpdate);
      socket.off("inbox:updated", handleInboxUpdate);
      socket.disconnect();
    };
  }, [refresh]);

  const visibleConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const matchesConnection =
        activeFilter === "all" || conversation.connectionId === activeFilter;
      const matchesSearch =
        !term ||
        conversation.title.toLowerCase().includes(term) ||
        conversation.handle.toLowerCase().includes(term) ||
        conversation.preview.toLowerCase().includes(term);
      return matchesConnection && matchesSearch;
    });
  }, [activeFilter, conversations, search]);

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedId) ?? null;

  function openConnectionModal(kind: ChannelKind) {
    setModalKind(kind);
  }

  function resetConnectionFlow() {
    setError("");
    setTelegramPendingId("");
    setTelegramNeedsPassword(false);
  }

  async function submitConnection(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modalKind) return;

    setBusy(true);
    setError("");
    const formData = new FormData(event.currentTarget);

    try {
      if (modalKind === "telegram-personal" && telegramPendingId) {
        const response = await fetch("/api/connections/telegram-personal/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connectionId: telegramPendingId,
            code: formData.get("code"),
            password: formData.get("password"),
          }),
        });

        const result = (await response.json()) as { error?: string; requiresPassword?: boolean };
        if (!response.ok) throw new Error(result.error ?? "Telegram login could not be verified.");

        if (result.requiresPassword) {
          setTelegramNeedsPassword(true);
          setError("Telegram two-step verification is enabled. Enter your Telegram password.");
          return;
        }
      } else {
        const payload =
          modalKind === "whatsapp-business"
            ? {
                kind: modalKind,
                phoneNumberId: formData.get("phoneNumberId"),
                accessToken: formData.get("accessToken"),
              }
            : modalKind === "telegram-bot"
              ? { kind: modalKind, token: formData.get("token") }
              : { kind: modalKind, phoneNumber: formData.get("phoneNumber") };

        const response = await fetch("/api/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = (await response.json()) as { error?: string; id?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not connect the account.");

        if (modalKind === "telegram-personal" && result.id) {
          setTelegramPendingId(result.id);
          setError("Telegram sent a login code. Enter it here to finish connecting.");
          return;
        }
      }

      resetTelegramFlow();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect the account.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(event: SubmitEvent<HTMLFormElement>, image?: File) {
    event.preventDefault();
    if (!selectedConversation || (!reply.trim() && !image)) return false;

    setBusy(true);
    setError("");

    try {
      const formData = new FormData();
      formData.set("conversationId", String(selectedConversation.id));
      formData.set("body", reply.trim());
      if (image) formData.set("image", image);

      const response = await fetch("/api/messages", {
        method: "POST",
        body: formData,
      });

      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Message could not be sent.");

      setReply("");
      await refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Message could not be sent.");
    } finally {
      setBusy(false);
    }
    return false;
  }

  async function deleteMessage(messageId: number) {
    if (!window.confirm("Delete this sent message?")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/messages/${messageId}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Message could not be deleted.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Message could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteConversation(conversation: { id: number; title: string }) {
    if (deletingConversationId !== null) return;
    if (
      !window.confirm(
        `Delete chat with ${conversation.title}? All stored messages will be deleted.`,
      )
    )
      return;
    setDeletingConversationId(conversation.id);
    setError("");
    try {
      const response = await fetch(`/api/conversations/${conversation.id}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Chat could not be deleted.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chat could not be deleted.");
    } finally {
      setDeletingConversationId(null);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  async function deleteAccount(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setDeleteError("");

    try {
      const response = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });

      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not delete the local account.");

      setDeletePassword("");
      router.refresh();
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : "Could not delete the local account.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(connection: ChannelConnection) {
    if (
      !window.confirm(
        `Disconnect ${connection.label}? Its locally stored messages will be deleted. Revoke WhatsApp or bot credentials with the provider if you no longer trust them.`,
      )
    ) {
      return;
    }

    const response = await fetch(`/api/connections/${connection.id}`, { method: "DELETE" });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Could not disconnect this account.");
      return;
    }

    await refresh();
  }

  return {
    connections,
    conversations: visibleConversations,
    selectedId,
    activeFilter,
    search,
    reply,
    loading,
    busy,
    error,
    modalKind,
    telegramPendingId,
    telegramNeedsPassword,
    deleteAccountOpen,
    deletePassword,
    deleteError,
    selectedConversation,
    openConnectionModal,
    resetConnectionFlow,
    setActiveFilter,
    setDeleteAccountOpen,
    setDeleteError,
    setDeletePassword,
    setError,
    setModalKind,
    setReply,
    setSearch,
    setTelegramNeedsPassword,
    setTelegramPendingId,
    resetTelegramFlow,
    refresh,
    submitConnection,
    sendReply,
    deleteMessage,
    deleteConversation,
    deletingConversationId,
    signOut,
    deleteAccount,
    disconnect,
    selectConversation: selectInboxConversation,
    ngrokStatus,
    ngrokLoading,
    ngrokModalOpen,
    setNgrokModalOpen,
    refreshNgrokStatus,
    startNgrok,
    stopNgrok,
    syncTelegramWebhooks,
    saveWebhookSettings,
    testWhatsAppWebhook,
  };
}
