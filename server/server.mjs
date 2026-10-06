import http from "http";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(fs.readFileSync(new URL("./viewer.html", import.meta.url)));
});

const wss = new WebSocketServer({ noServer: true });
let client = null;
const viewers = new Set();

server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    if (req.url === "/client") {
      client = ws;
      console.log("client connected");
      ws.on("message", (data, isBinary) => {
        for (const v of viewers) {
          if (v.readyState === WebSocket.OPEN) v.send(data, { binary: isBinary });
        }
      });
      ws.on("close", () => {
        if (client === ws) client = null;
        console.log("client disconnected");
      });
    } else if (req.url === "/viewer") {
      viewers.add(ws);
      console.log("viewer connected, total:", viewers.size);
      ws.on("close", () => viewers.delete(ws));
    } else {
      ws.close();
    }
  });
});

server.listen(8080, () => console.log("listening on :8080"));