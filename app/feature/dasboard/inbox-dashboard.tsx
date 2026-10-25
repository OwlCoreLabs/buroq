"use client";

import { useInboxDashboard } from "@/lib/hooks/useInboxDashboard";

import { ConnectionModal } from "./components/ConnectionModal";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { ConversationDetail } from "./components/ConversationDetail";
import { ConversationList } from "./components/ConversationList";
import { DeleteAccountModal } from "./components/DeleteAccountModal";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";

export default function InboxDashboard({ username }: { username: string }) {
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
    selectConversation,
    selectedConversation,
    openConnectionModal,
    resetConnectionFlow,
  } = useInboxDashboard();

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
        <TopBar onRefresh={refresh} onOpenConnect={openConnectionModal} />

        <div className="page-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">WHATSAPP & TELEGRAM</p>
              <h1>Inbox</h1>
              <p className="page-subtitle">Messages from your connected accounts, in one place.</p>
            </div>
          </div>

          <ConnectionPanel
            connections={connections}
            onOpenConnectionModal={openConnectionModal}
            onResetConnectionFlow={resetConnectionFlow}
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
    </main>
  );
}
