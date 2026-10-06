"use strict";
import { execSync, spawn } from "child_process";

const FFMPEG = "ffmpeg";

const encodingFlags = {
    "h264_nvenc": ["-preset", "p1", "-tune", "ll", "-rc", "cbr", "-zerolatency", "1", "-delay", "0"],
    "h264_amf": ["-quality", "speed", "-rc", "cbr"],
    "h264_qsv": ["-preset", "veryfast"],
    "libx264": ["-preset", "ultrafast", "-tune", "zerolatency"]
};

export class Converter {
    constructor(cfg) {
        if (!this.ValidFfmpeg()) {
            throw new Error("FFmpeg not found, install with: winget install Gyan.FFmpeg");
        }

        const codec = cfg.codec || this.GetEncoder();
        const flags = encodingFlags[codec] || encodingFlags["libx264"];
        const gpuFrames = codec === "h264_nvenc";

        const input = [
            "-hide_banner",
            "-f", "lavfi",
            "-i",
            `ddagrab=framerate=${cfg.fps}` +
            `:output_idx=0` +
            `:offset_x=${cfg.window_x}` +
            `:offset_y=${cfg.window_y}` +
            `:video_size=${cfg.window_res}`
        ];

        let video;
        if (gpuFrames) {
            if (cfg.filter) {
                console.warn("cfg.filter is ignored with h264_nvenc zero-copy capture");
            }
            video = [];
        } else {
            const chain = ["hwdownload", "format=bgra"];
            if (cfg.filter) chain.push(cfg.filter);
            video = ["-vf", chain.join(","), "-pix_fmt", cfg.format];
        }

        this.exec = [
            ...input,
            ...video,
            "-c:v", codec,
            ...flags,
            "-b:v", cfg.bitrate,
            "-maxrate", cfg.bitrate,
            "-bufsize", cfg.bitrate,
            "-g", String(cfg.fps),
            "-bf", "0",
            "-muxdelay", "0",
            "-muxpreload", "0",
            "-flush_packets", "1",
            "-f", "mpegts",
            cfg.stdout || "-"
        ];
    }

    ValidFfmpeg() {
        try {
            execSync(`${FFMPEG} -version`, { stdio: "pipe" });
            return true;
        } catch {
            return false;
        }
    }

    GetEncoder() {
        const encoders = ["h264_nvenc", "h264_amf", "h264_qsv"];
        try {
            const output = execSync(`${FFMPEG} -hide_banner -encoders`, {
                encoding: "utf8",
                stdio: "pipe"
            });

            for (const enc of encoders) {
                if (output.includes(enc)) return enc;
            }
        } catch {
            console.warn("Could not list FFmpeg encoders, falling back to libx264");
        }
        return "libx264";
    }

    GetParams() {
        return this.exec || null;
    }

    GetProcess() {
        try {
            return spawn(FFMPEG, this.exec);
        } catch (error) {
            console.log("Could not start process, reason:", error);
            return null;
        }
    }
}

export default Converter;