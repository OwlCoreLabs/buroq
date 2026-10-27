import type { FormEvent } from "react";

import type { AuthMode } from "@/lib/store/useAuthStore";

type AuthFormProps = {
  mode: AuthMode;
  username: string;
  password: string;
  recoveryCode: string;
  notice: string;
  error: string;
  busy: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRecoveryCodeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChangeMode: (nextMode: AuthMode) => void;
};

export function AuthForm({
  mode,
  username,
  password,
  recoveryCode,
  notice,
  error,
  busy,
  onUsernameChange,
  onPasswordChange,
  onRecoveryCodeChange,
  onSubmit,
  onChangeMode,
}: AuthFormProps) {
  return (
    <>
      <p className="auth-eyebrow">
        {mode === "setup"
          ? "LOCAL SETUP"
          : mode === "recover"
            ? "PASSWORD RECOVERY"
            : "LOCAL SIGN IN"}
      </p>
      <h1>
        {mode === "setup"
          ? "Set up your inbox"
          : mode === "recover"
            ? "Reset your password"
            : "Welcome back"}
      </h1>
      <p className="auth-description">
        {mode === "setup"
          ? "Create the local account that protects this inbox on this device."
          : mode === "recover"
            ? "Enter your saved recovery code to choose a new password."
            : "Sign in to your local Buroq inbox."}
      </p>
      <form className="auth-form" onSubmit={onSubmit}>
        <label>
          Username
          <input
            autoComplete="username"
            required
            minLength={3}
            maxLength={64}
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
          />
        </label>
        {mode === "recover" && (
          <label>
            Recovery code
            <input
              autoComplete="off"
              required
              value={recoveryCode}
              onChange={(event) => onRecoveryCodeChange(event.target.value)}
            />
          </label>
        )}
        <label>
          {mode === "recover" ? "New password" : "Password"}
          <input
            autoComplete={
              mode === "setup" || mode === "recover" ? "new-password" : "current-password"
            }
            type="password"
            required
            minLength={mode === "setup" || mode === "recover" ? 1 : undefined}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
          />
          {mode === "setup" && <small>Password must be at least 1 character.</small>}
        </label>
        {notice && (
          <p className="form-success" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button auth-submit" type="submit" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "setup"
              ? "Create local account"
              : mode === "recover"
                ? "Reset password"
                : "Sign in"}
        </button>
      </form>
      {mode === "login" && (
        <button
          className="text-button auth-link"
          type="button"
          onClick={() => onChangeMode("recover")}
        >
          Forgot password?
        </button>
      )}
      {mode === "recover" && (
        <button
          className="text-button auth-link"
          type="button"
          onClick={() => onChangeMode("login")}
        >
          Back to sign in
        </button>
      )}
      <p className="local-data-note">
        This account and connected channel credentials are stored locally on this device.
      </p>
    </>
  );
}
