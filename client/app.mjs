import pkg from "systray2";
import os from 'os'
const SysTray = pkg.default ?? pkg;

import { spawn } from "child_process";
import WebSocket from "ws";
import ffmpegPath from "ffmpeg-static";

import { Converter } from "./src/Converter.mjs";

let ws = null;
let ff = null;


function start() {
  if (ws) return;
  ws = new WebSocket("ws://localhost:8080/client");

  ws.on("open", () => {
    const converter = new Converter({
      fps: 144,
      window_x: 0,
      window_y: 0,
      window_res: "1920x1080",

      filter: null,
      format: "yuv420p",
      codec: null,
      bitrate: "10000k",
      bFrames: 0,
      stdout: "-"
    });

    ff = converter.GetProcess();

    if (!ff) {
      throw new Error("Could not get process");
    }

    ff.stdout.on("data", (chunk) => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(chunk);
    });
    ff.stderr.on("data", (d) => console.log("ffmpeg:", d.toString()));
    ff.on("close", (code) => { /*console.log("ffmpeg exited:", code);*/ ff = null; });
  });

  ws.on("close", stop);
  ws.on("error", (e) => console.log("ws error:", e.code ?? e));
}

function stop() {
  if (ff) { ff.kill(); ff = null; }
  if (ws) { ws.close(); ws = null; }
}


const items = [
  {
    title: "Start",
    tooltip: "Start to share screen",
    on_click_identifier: "on_start",
    checked: false,
    enabled: true,

    click() {
      const self = items[0];
      self.checked = !self.checked;
      systray.sendAction({
        type: 'update-item',
        item: self
      });
    }
  },
  {
    title: "Stop",
    tooltip: "Stop the screen sharing",
    on_click_identifier: "on_stop",
    checked: false,
    enabled: true,

    click() {
      const self = items[1];
      self.checked = !self.checked;
      systray.sendAction({
        type: 'update-item',
        item: self
      });
    }
  },
  {
    title: "Exit",
    tooltip: "Exits the application",
    on_click_identifier: "on_exit",
    checked: false,
    enabled: true,

    click() {
      const self = items[2];
      self.checked = !self.checked;
      systray.sendAction({
        type: 'update-item',
        item: self
      });

      // systray.kill(false)
    }
  }
]

const systray = new SysTray({
  menu: {
    icon: os.platform() === 'win32' ? './logo_s.ico' : './logo_s.png',
    isTemplateIcon: os.platform() === 'darwin',
    title: 'ScreenShare Client',
    tooltip: 'ScreenShare Client',
    items: items,

  },

  debug: false,
  copyDir: false
})

systray.onClick(action => {
  if (action.item.click != null) {
    action.item.click()
  }

  switch (action.item.on_click_identifier) {
    case "on_start": start(); break;
    case "on_stop": stop(); break;
    case "on_exit": stop(); systray.kill(false); break;
  }
});

systray.ready()
  .then(() => console.log("systray started!"))
  .catch((err) => console.log("systray failed to start: " + err.message));