/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require("node:http");
const { parse } = require("node:url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT || 3000);
globalThis.__buroqPort = port;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    path: "/socket.io",
    serveClient: false,
  });

  globalThis.__buroqSocketIo = io;

  io.on("connection", (socket) => {
    socket.on("ping", () => {
      socket.emit("pong");
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
