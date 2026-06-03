import { createServer } from "node:http";
import {
  createReadStream,
  createWriteStream,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import {
  PRESETS,
  analyze,
  formatReport,
  hasFfmpeg,
  processAudio,
  reportPathFor,
} from "./loudness_adapter.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
const apiBase = token ? `https://api.telegram.org/bot${token}` : null;
const fileBase = token ? `https://api.telegram.org/file/bot${token}` : null;
const workDir = path.join(process.cwd(), "bot_work");
const jobs = new Map();
const maxTelegramDownloadBytes = 20 * 1024 * 1024;
const maxTelegramSendBytes = 49 * 1024 * 1024;
const uploadPort = Number(process.env.UPLOAD_PORT || 8787);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${uploadPort}`;

let offset = 0;

function requireToken() {
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is not set.");
    console.error("PowerShell example:");
    console.error('$env:TELEGRAM_BOT_TOKEN="123456:ABCDEF"; node telegram_bot.js');
    process.exit(1);
  }
}

function safeName(name) {
  return (name || "track.wav").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 120);
}

function makeJobId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeSecret() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

async function tg(method, payload = {}) {
  const response = await fetch(`${apiBase}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await response.json();
  if (!json.ok) {
    throw new Error(`${method}: ${json.description || "Telegram API error"}`);
  }
  return json.result;
}

async function sendDocument(chatId, filePath, caption = "") {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (caption) form.append("caption", caption);
  form.append("document", new Blob([readFileSync(filePath)]), path.basename(filePath));

  const response = await fetch(`${apiBase}/sendDocument`, {
    method: "POST",
    body: form,
  });
  const json = await response.json();
  if (!json.ok) {
    throw new Error(`sendDocument: ${json.description || "Telegram API error"}`);
  }
}

async function sendOutputOrLink(job, outputPath, reportPath, caption) {
  const outputSize = statSync(outputPath).size;
  const downloadUrl = `${publicBaseUrl}/download/${job.jobId}/${job.secret}/output`;

  if (outputSize <= maxTelegramSendBytes) {
    await sendDocument(job.chatId, outputPath, caption);
  } else {
    await tg("sendMessage", {
      chat_id: job.chatId,
      text: [
        `${caption}`,
        "",
        `Output is ${(outputSize / 1024 / 1024).toFixed(1)} MB, too large to send through this Telegram MVP.`,
        `Download it here: ${downloadUrl}`,
      ].join("\n"),
    });
  }

  await sendDocument(job.chatId, reportPath, "Loudness report");
}

async function downloadTelegramFile(fileId, targetPath) {
  const file = await tg("getFile", { file_id: fileId });
  const response = await fetch(`${fileBase}/${file.file_path}`);
  if (!response.ok) {
    throw new Error(`Could not download Telegram file: HTTP ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(targetPath, bytes);
}

function pickFile(message) {
  if (message.document) {
    return {
      fileId: message.document.file_id,
      fileName: message.document.file_name || "track.wav",
      size: message.document.file_size || 0,
    };
  }

  if (message.audio) {
    return {
      fileId: message.audio.file_id,
      fileName: message.audio.file_name || `${message.audio.title || "track"}.mp3`,
      size: message.audio.file_size || 0,
    };
  }

  return null;
}

function presetKeyboard(jobId) {
  return {
    inline_keyboard: [
      [
        { text: "Spotify", callback_data: `preset:${jobId}:spotify` },
        { text: "YouTube", callback_data: `preset:${jobId}:youtube` },
      ],
      [
        { text: "Apple Music", callback_data: `preset:${jobId}:apple` },
        { text: "Hip-Hop Master", callback_data: `preset:${jobId}:hiphop` },
      ],
    ],
  };
}

function formatAnalysisMessage(fileName, analysis) {
  return [
    `File: ${fileName}`,
    "",
    "Analysis:",
    `LUFS: ${analysis.input_i}`,
    `True Peak: ${analysis.input_tp} dBTP`,
    `LRA: ${analysis.input_lra}`,
    "",
    "Choose export preset:",
  ].join("\n");
}

function uploadPage(jobId, secret) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Loudness Upload</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; }
    button { padding: 12px 18px; cursor: pointer; }
    input { display: block; margin: 20px 0; }
    progress { width: 100%; height: 24px; }
    #status { white-space: pre-wrap; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>Upload audio</h1>
  <p>Choose WAV, AIFF, FLAC, or MP3. Keep this page open until upload finishes.</p>
  <input id="file" type="file" accept="audio/*,.wav,.aiff,.aif,.flac,.mp3">
  <button id="upload">Upload</button>
  <progress id="progress" value="0" max="100"></progress>
  <div id="status"></div>
  <script>
    const fileInput = document.getElementById("file");
    const button = document.getElementById("upload");
    const progress = document.getElementById("progress");
    const status = document.getElementById("status");

    button.onclick = async () => {
      const file = fileInput.files[0];
      if (!file) {
        status.textContent = "Choose a file first.";
        return;
      }

      status.textContent = "Uploading...";
      progress.value = 0;

      const xhr = new XMLHttpRequest();
      xhr.open("PUT", "/upload/${jobId}/${secret}?filename=" + encodeURIComponent(file.name));
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) progress.value = Math.round((event.loaded / event.total) * 100);
      };
      xhr.onload = () => {
        status.textContent = xhr.status >= 200 && xhr.status < 300
          ? "Upload complete. Return to Telegram."
          : "Upload failed: " + xhr.responseText;
      };
      xhr.onerror = () => {
        status.textContent = "Upload failed. Check connection and try again.";
      };
      xhr.send(file);
    };
  </script>
</body>
</html>`;
}

function createUploadJob(chatId) {
  const jobId = makeJobId();
  const secret = makeSecret();
  const jobDir = path.join(workDir, jobId);
  mkdirSync(jobDir, { recursive: true });
  jobs.set(jobId, { jobId, secret, chatId, jobDir, createdAt: Date.now() });
  return { jobId, secret, url: `${publicBaseUrl}/upload/${jobId}/${secret}` };
}

async function sendUploadLink(chatId) {
  const upload = createUploadJob(chatId);
  await tg("sendMessage", {
    chat_id: chatId,
    text: [
      "Large file upload mode:",
      upload.url,
      "",
      "Open the link, upload your WAV/AIFF/FLAC/MP3, then return here.",
      "After upload, I will send the analysis and preset buttons in this chat.",
    ].join("\n"),
  });
}

async function handleMessage(message) {
  const chatId = message.chat.id;

  if (message.text === "/start") {
    await tg("sendMessage", {
      chat_id: chatId,
      text: "Send WAV, AIFF, or MP3. For files over 20 MB, send /upload and use the browser upload link.",
    });
    return;
  }

  if (message.text === "/upload") {
    await sendUploadLink(chatId);
    return;
  }

  const file = pickFile(message);
  if (!file) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: "Send an audio file as a document or audio file: WAV, AIFF, MP3.",
    });
    return;
  }

  if (file.size > maxTelegramDownloadBytes) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: [
        "This file is too large for the current Telegram MVP.",
        `File size: ${(file.size / 1024 / 1024).toFixed(1)} MB`,
        "Send /upload and use the browser upload link for larger files.",
      ].join("\n"),
    });
    return;
  }

  const jobId = makeJobId();
  const jobDir = path.join(workDir, jobId);
  mkdirSync(jobDir, { recursive: true });

  const fileName = safeName(file.fileName);
  const inputPath = path.join(jobDir, fileName);

  await tg("sendMessage", { chat_id: chatId, text: "Downloading file and measuring loudness..." });
  await tg("sendChatAction", { chat_id: chatId, action: "typing" });
  try {
    await downloadTelegramFile(file.fileId, inputPath);
  } catch (error) {
    throw new Error(
      [
        "Could not download the file from Telegram.",
        "For this MVP, files must be under 20 MB.",
        `Original error: ${error.message}`,
      ].join(" "),
    );
  }

  const analysis = await analyze(inputPath, PRESETS.spotify);
  jobs.set(jobId, { jobId, secret: makeSecret(), chatId, inputPath, fileName, createdAt: Date.now() });

  await tg("sendMessage", {
    chat_id: chatId,
    text: formatAnalysisMessage(fileName, analysis),
    reply_markup: presetKeyboard(jobId),
  });
}

async function handleCallback(callbackQuery) {
  const data = callbackQuery.data || "";
  const [, jobId, presetName] = data.split(":");
  const job = jobs.get(jobId);
  const preset = PRESETS[presetName];

  await tg("answerCallbackQuery", { callback_query_id: callbackQuery.id });

  if (!job || !preset) {
    await tg("sendMessage", {
      chat_id: callbackQuery.message.chat.id,
      text: "I cannot find this job. Send the file again.",
    });
    return;
  }

  const parsed = path.parse(job.inputPath);
  const outputPath = path.join(parsed.dir, `${parsed.name}_${presetName}.wav`);
  const reportPath = reportPathFor(outputPath);

  await tg("sendMessage", {
    chat_id: job.chatId,
    text: `Rendering ${preset.label || presetName}: ${preset.targetI} LUFS, ${preset.truePeak} dBTP.`,
  });
  await tg("sendChatAction", { chat_id: job.chatId, action: "upload_document" });

  const presetAnalysis = await analyze(job.inputPath, preset);
  await processAudio(job.inputPath, outputPath, preset, presetAnalysis);
  const outputAnalysis = await analyze(outputPath, { ...preset, chain: [] });
  writeFileSync(
    reportPath,
    formatReport(job.inputPath, outputPath, presetName, preset, presetAnalysis, outputAnalysis),
    "utf8",
  );

  jobs.set(job.jobId, { ...job, outputPath, reportPath });
  await sendOutputOrLink(job, outputPath, reportPath, `${preset.label || presetName}: WAV ready`);
}

async function finalizeWebUpload(job, inputPath, fileName) {
  await tg("sendMessage", { chat_id: job.chatId, text: "Upload received. Measuring loudness..." });
  const analysis = await analyze(inputPath, PRESETS.spotify);
  jobs.set(job.jobId, { ...job, inputPath, fileName });
  await tg("sendMessage", {
    chat_id: job.chatId,
    text: formatAnalysisMessage(fileName, analysis),
    reply_markup: presetKeyboard(job.jobId),
  });
}

function serveDownload(response, filePath) {
  const fileName = path.basename(filePath);
  response.writeHead(200, {
    "content-type": "application/octet-stream",
    "content-disposition": `attachment; filename="${fileName.replaceAll('"', "")}"`,
  });
  createReadStream(filePath).pipe(response);
}

function startUploadServer() {
  const server = createServer((request, response) => {
    const url = new URL(request.url, `http://localhost:${uploadPort}`);
    const parts = url.pathname.split("/").filter(Boolean);

    if (request.method === "GET" && parts[0] === "upload" && parts.length === 3) {
      const [, jobId, secret] = parts;
      const job = jobs.get(jobId);
      if (!job || job.secret !== secret) {
        response.writeHead(404).end("Upload link not found.");
        return;
      }
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(uploadPage(jobId, secret));
      return;
    }

    if (request.method === "PUT" && parts[0] === "upload" && parts.length === 3) {
      const [, jobId, secret] = parts;
      const job = jobs.get(jobId);
      if (!job || job.secret !== secret) {
        response.writeHead(404).end("Upload link not found.");
        return;
      }

      const fileName = safeName(url.searchParams.get("filename") || "track.wav");
      const inputPath = path.join(job.jobDir, fileName);
      const stream = createWriteStream(inputPath);
      request.pipe(stream);
      stream.on("finish", () => {
        response.writeHead(200).end("OK");
        finalizeWebUpload(job, inputPath, fileName).catch(async (error) => {
          console.error(error);
          await tg("sendMessage", { chat_id: job.chatId, text: `Error: ${error.message}` }).catch(console.error);
        });
      });
      stream.on("error", (error) => {
        response.writeHead(500).end(error.message);
      });
      return;
    }

    if (request.method === "GET" && parts[0] === "download" && parts.length === 4) {
      const [, jobId, secret, kind] = parts;
      const job = jobs.get(jobId);
      if (!job || job.secret !== secret) {
        response.writeHead(404).end("Download link not found.");
        return;
      }
      if (kind === "output" && job.outputPath) {
        serveDownload(response, job.outputPath);
        return;
      }
      if (kind === "report" && job.reportPath) {
        serveDownload(response, job.reportPath);
        return;
      }
      response.writeHead(404).end("File is not ready.");
      return;
    }

    response.writeHead(404).end("Not found.");
  });

  server.listen(uploadPort, () => {
    console.log(`Upload server is running: ${publicBaseUrl}`);
  });
}

async function poll() {
  const updates = await tg("getUpdates", {
    offset,
    timeout: 30,
    allowed_updates: ["message", "callback_query"],
  });

  for (const update of updates) {
    offset = update.update_id + 1;
    try {
      if (update.message) await handleMessage(update.message);
      if (update.callback_query) await handleCallback(update.callback_query);
    } catch (error) {
      const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
      console.error(error);
      if (chatId) {
        await tg("sendMessage", {
          chat_id: chatId,
          text: `Error: ${error.message}`,
        }).catch(console.error);
      }
    }
  }
}

async function main() {
  requireToken();
  mkdirSync(workDir, { recursive: true });

  if (!(await hasFfmpeg())) {
    console.error("ffmpeg is not installed or is not available in PATH.");
    process.exit(1);
  }

  try {
    const bot = await tg("getMe");
    console.log(`Telegram API token is valid: @${bot.username}`);
  } catch (error) {
    console.error("Telegram API token is invalid or revoked.");
    console.error("Create a new token in @BotFather and restart the bot.");
    console.error(error.message);
    process.exit(1);
  }

  startUploadServer();
  console.log("Telegram bot is running. Press Ctrl+C to stop.");
  while (true) {
    await poll().catch((error) => {
      console.error(error.message);
    });
  }
}

process.on("SIGINT", () => {
  rmSync(workDir, { recursive: true, force: true });
  process.exit(0);
});

main();
