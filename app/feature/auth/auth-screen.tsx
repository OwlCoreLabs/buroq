"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { useAuthStore } from "@/lib/store/useAuthStore";

import { AuthForm } from "./components/AuthForm";
import { RecoveryCodeCard } from "./components/RecoveryCodeCard";

export default function AuthScreen({ firstRun }: { firstRun: boolean }) {
  const router = useRouter();
  const {
    mode,
    username,
    password,
    recoveryCode,
    pendingLogin,
    error,
    notice,
    busy,
    setMode,
    setUsername,
    setPassword,
    setRecoveryCode,
    setPendingLogin,
    setError,
    setNotice,
    setBusy,
    changeMode,
  } = useAuthStore();

  useEffect(() => {
    setMode(firstRun ? "setup" : "login");
  }, [firstRun, setMode]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const endpoint =
        mode === "setup"
          ? "/api/auth/setup"
          : mode === "recover"
            ? "/api/auth/recover"
            : "/api/auth/login";
      const body =
        mode === "recover" ? { username, recoveryCode, password } : { username, password };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { error?: string; recoveryCode?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to continue.");

      if (mode === "setup" || (mode === "login" && result.recoveryCode)) {
        setRecoveryCode(result.recoveryCode ?? "");
        setPendingLogin(mode === "login");
        setPassword("");
        setMode("recovery-code");
        setNotice("");
      } else if (mode === "recover") {
        setPassword("");
        setRecoveryCode("");
        setMode("login");
        setNotice("Password reset. Sign in with your new password.");
      } else {
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand auth-brand" href="/" aria-label="Buroq">
          <span className="brand-mark">b</span>
          <span>buroq</span>
        </Link>

        {mode === "recovery-code" ? (
          <RecoveryCodeCard
            recoveryCode={recoveryCode}
            pendingLogin={pendingLogin}
            onContinue={() => {
              setMode("login");
              if (pendingLogin) router.refresh();
            }}
          />
        ) : (
          <AuthForm
            mode={mode}
            username={username}
            password={password}
            recoveryCode={recoveryCode}
            notice={notice}
            error={error}
            busy={busy}
            onUsernameChange={setUsername}
            onPasswordChange={setPassword}
            onRecoveryCodeChange={setRecoveryCode}
            onSubmit={submit}
            onChangeMode={changeMode}
          />
        )}
      </section>
    </main>
  );
}
