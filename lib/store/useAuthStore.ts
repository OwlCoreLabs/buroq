import { create } from "zustand";

export type AuthMode = "setup" | "login" | "recover" | "recovery-code";

type AuthState = {
  mode: AuthMode;
  username: string;
  password: string;
  recoveryCode: string;
  pendingLogin: boolean;
  error: string;
  notice: string;
  busy: boolean;

  setMode: (mode: AuthMode) => void;
  setUsername: (username: string) => void;
  setPassword: (password: string) => void;
  setRecoveryCode: (recoveryCode: string) => void;
  setPendingLogin: (pendingLogin: boolean) => void;
  setError: (error: string) => void;
  setNotice: (notice: string) => void;
  setBusy: (busy: boolean) => void;
  reset: () => void;
  changeMode: (nextMode: AuthMode) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  mode: "login",
  username: "",
  password: "",
  recoveryCode: "",
  pendingLogin: false,
  error: "",
  notice: "",
  busy: false,

  setMode: (mode) => set({ mode }),
  setUsername: (username) => set({ username }),
  setPassword: (password) => set({ password }),
  setRecoveryCode: (recoveryCode) => set({ recoveryCode }),
  setPendingLogin: (pendingLogin) => set({ pendingLogin }),
  setError: (error) => set({ error }),
  setNotice: (notice) => set({ notice }),
  setBusy: (busy) => set({ busy }),

  reset: () =>
    set({
      username: "",
      password: "",
      recoveryCode: "",
      pendingLogin: false,
      error: "",
      notice: "",
      busy: false,
    }),

  changeMode: (nextMode) =>
    set({
      mode: nextMode,
      error: "",
      notice: "",
    }),
}));
