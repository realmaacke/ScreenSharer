"use strict";

import express from "express";
import { WebSocketServer, WebSocket } from "ws";

const app = express();

app.get("/", (req, res) => {
  clients.forEach((val, key) => {
    console.log("entry: " + key + " val: " + val);
  })

  res.sendFile(new URL("./viewer.html", import.meta.url).pathname);
});

const server = app.listen(8080, () => console.log("listening on :8080"));
const wss = new WebSocketServer({ noServer: true });

const clients = new Map();
const viewers = new Map();

const handlers = {
  "/client": (ws, id) => {
    clients.set(id, ws);

    ws.on("message", (data) => {
      for (const view of viewers.get(id) ?? []) {
        if (view.readyState === WebSocket.OPEN) {
          view.send(data, { binary: true });
        }
      }
    });

    ws.on("close", () => {
      if (clients.get(id) === ws) clients.delete(id);
    });
  },

  "/viewer": (ws, id) => {
    if (!viewers.has(id)) viewers.set(id, new Set());
    viewers.get(id).add(ws);

    ws.on("close", () => {
      const set = viewers.get(id);
      set?.delete(ws);
      if (set?.size === 0) viewers.delete(id);
    });
  },
};

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const handle = handlers[url.pathname];
  const id = url.searchParams.get("id");

  console.log("Upgrade requested for path:", url.pathname);

  if (!handle || !/^\d{4}-\d{4}$/.test(id ?? "")) return socket.destroy();
  if (url.pathname === "/viewer" && !clients.has(id)) return socket.destroy();

  wss.handleUpgrade(req, socket, head, (ws) => handle(ws, id));
});