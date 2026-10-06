"use strict";

import express from "express";
import { WebSocketServer, WebSocket } from "ws";

const app = express();

app.get("/", (req, res) => {
  res.sendFile(new URL("./viewer.html", import.meta.url).pathname);
});

const server = app.listen(8080, () => console.log("listening on :8080"));
const wss = new WebSocketServer({ noServer: true });

let client = null;
const viewers = new Set();

const handlers = {
  "/client": (ws) => {
    client = ws;

    ws.on("message", (data, isBinary) => {
      for (const view of viewers) {
        if (view.readyState === WebSocket.OPEN) {
          view.send(data, {binary: true});
        }
      }
    });
    ws.on("close", () => {
      if (client === ws) client = null;
    });
  },
  "/viewer": (ws) => {
    viewers.add(ws);
    ws.on("close", () => viewers.delete(ws));
  }
};

server.on("upgrade", (req, socket, head) => {
  const pathName = new URL(req.url, `http://${req.headers.host}`).pathname;
  console.log("Upgrade requested for path:", pathName);
  const handle = handlers[pathName];
  if (!handle) return socket.destroy();

  wss.handleUpgrade(req, socket, head, (ws) => {
    handle(ws);
  });
});