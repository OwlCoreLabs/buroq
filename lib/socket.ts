declare global {
  var __buroqSocketIo: {
    emit: (event: string, ...args: unknown[]) => void;
  } | undefined;
}

export function getSocketServer() {
  return globalThis.__buroqSocketIo;
}

export function emitInboxUpdate() {
  getSocketServer()?.emit("inbox:updated");
}
