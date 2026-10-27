"use client";

import { useState, type SubmitEvent } from "react";

import { useInboxDashboard } from "@/lib/hooks/useInboxDashboard";
import type { ChannelConnection } from "@/lib/inbox";

import { ConnectionModal } from "./components/ConnectionModal";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { ConversationDetail } from "./components/ConversationDetail";
import { ConversationList } from "./components/ConversationList";
import { DeleteAccountModal } from "./components/DeleteAccountModal";
import { NgrokModal } from "./components/NgrokModal";
import { NgrokTunnelCard } from "./components/NgrokTunnelCard";
import { Sidebar } from "./components/Sidebar";
import { TelegramMessageModal } from "./components/TelegramMessageModal";
import { TopBar } from "./components/TopBar";

export default function InboxDashboard({ username }: { username: string }) {
  const [telegramMessageConnection, setTelegramMessageConnection] =
    useState<ChannelConnection | null>(null);
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
    setActiveFilter,
    setDeleteAccountOpen,
    setDeleteError,
    setDeletePassword,
    setModalKind,
    setReply,
    setSearch,
    refresh,
    submitConnection,
    sendReply,
    deleteMessage,
    signOut,
    deleteAccount,
    disconnect,
    deleteConversation,
    deletingConversationId,
    selectConversation,
    selectedConversation,
    openConnectionModal,
    resetConnectionFlow,
    setError,
    ngrokStatus,
    ngrokLoading,
    ngrokModalOpen,
    setNgrokModalOpen,
    startNgrok,
    stopNgrok,
    syncTelegramWebhooks,
    saveWebhookSettings,
    testWhatsAppWebhook,
  } = useInboxDashboard();

  function startTelegramMessage(connection: ChannelConnection) {
    setError("");
    setTelegramMessageConnection(connection);
  }

  async function submitTelegramMessage(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!telegramMessageConnection) return;
    const formData = new FormData(event.currentTarget);
    setError("");
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionId: telegramMessageConnection.id,
        providerChatId: formData.get("providerChatId"),
        recipientTitle: formData.get("recipientTitle"),
        body: formData.get("body"),
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Message could not be sent.");
      return;
    }
    setTelegramMessageConnection(null);
    await refresh();
  }

  return (
    <main className="app-shell">
      <Sidebar
        username={username}
        connections={connections}
        activeFilter={activeFilter}
        onOpenConnect={openConnectionModal}
        onSelectFilter={(nextFilter) => setActiveFilter(nextFilter)}
        onDisconnect={disconnect}
        onSignOut={signOut}
        onDeleteAccount={() => {
          setDeleteError("");
          setDeletePassword("");
          setDeleteAccountOpen(true);
        }}
      />

      <section className="content">
        <TopBar
          onRefresh={refresh}
          onOpenConnect={openConnectionModal}
          ngrokStatus={ngrokStatus}
          onOpenNgrokModal={() => setNgrokModalOpen(true)}
        />

        <div className="page-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">WHATSAPP & TELEGRAM</p>
              <h1>Inbox</h1>
              <p className="page-subtitle">Messages from your connected accounts, in one place.</p>
            </div>
          </div>

          <NgrokTunnelCard
            status={ngrokStatus}
            loading={ngrokLoading}
            onStart={async () => {
              await startNgrok();
            }}
            onStop={async () => {
              await stopNgrok();
            }}
            onOpenModal={() => setNgrokModalOpen(true)}
          />

          <ConnectionPanel
            connections={connections}
            onOpenConnectionModal={openConnectionModal}
            onResetConnectionFlow={resetConnectionFlow}
            onStartTelegramMessage={startTelegramMessage}
          />

          <section className="inbox-panel" aria-label="Messages">
            <ConversationList
              connections={connections}
              conversations={conversations}
              loading={loading}
              selectedId={selectedId}
              activeFilter={activeFilter}
              search={search}
              onSearchChange={setSearch}
              onSetActiveFilter={setActiveFilter}
              onSelectConversation={selectConversation}
              onDeleteConversation={deleteConversation}
              deletingConversationId={deletingConversationId}
            />
            <ConversationDetail
              conversation={selectedConversation}
              reply={reply}
              busy={busy}
              onReplyChange={setReply}
              onSendReply={sendReply}
              onDeleteMessage={deleteMessage}
            />
          </section>

          {error && (
            <p className="page-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>

      {telegramMessageConnection && (
        <TelegramMessageModal
          connection={telegramMessageConnection}
          busy={busy}
          error={error}
          onClose={() => setTelegramMessageConnection(null)}
          onSubmit={submitTelegramMessage}
        />
      )}

      {modalKind && (
        <ConnectionModal
          modalKind={modalKind}
          busy={busy}
          error={error}
          telegramPendingId={telegramPendingId}
          telegramNeedsPassword={telegramNeedsPassword}
          onClose={() => setModalKind(null)}
          onSubmitConnection={submitConnection}
        />
      )}

      {deleteAccountOpen && (
        <DeleteAccountModal
          busy={busy}
          deletePassword={deletePassword}
          deleteError={deleteError}
          onClose={() => setDeleteAccountOpen(false)}
          onDeletePasswordChange={setDeletePassword}
          onSubmit={deleteAccount}
        />
      )}

      {ngrokModalOpen && (
        <NgrokModal
          status={ngrokStatus}
          loading={ngrokLoading}
          onClose={() => setNgrokModalOpen(false)}
          onStart={startNgrok}
          onStop={stopNgrok}
          onSyncBots={syncTelegramWebhooks}
          onSaveSettings={saveWebhookSettings}
          onTestWhatsApp={testWhatsAppWebhook}
        />
      )}
    </main>
  );
}
