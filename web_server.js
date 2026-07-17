import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { URL } from "node:url";
import { PRESETS, analyze, formatReport, hasFfmpeg, processAudio, reportPathFor } from "./loudness_adapter.js";

const port = Number(process.env.PORT || 3000);
const workDir = path.join(process.cwd(), "web_work");
const publicDir = path.join(process.cwd(), "public");
const jobs = new Map();
const pendingJobTtlMs = 30 * 60 * 1000;
const resultTtlMs = 20 * 60 * 1000;
const maxUploadBytes = 100 * 1024 * 1024;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function safeName(name) {
  return (name || "track.wav").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 140);
}

function makeId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function makeSecret() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1024 * 1024) reject(new Error("Request body is too large."));
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function publicPresetList() {
  return Object.entries(PRESETS).map(([id, preset]) => ({
    id,
    label: preset.label || id,
    targetI: preset.targetI,
    truePeak: preset.truePeak,
    notes: preset.notes || "Loudness normalization only.",
  }));
}

function serveStatic(request, response, url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(publicDir, pathname));
  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    response.writeHead(404).end("Not found");
    return true;
  }
  response.writeHead(200, { "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(response);
  return true;
}

function createJob() {
  const id = makeId();
  const secret = makeSecret();
  const jobDir = path.join(workDir, id);
  mkdirSync(jobDir, { recursive: true });
  const job = { id, secret, jobDir, createdAt: Date.now(), lastTouchedAt: Date.now(), activeDownloads: 0 };
  jobs.set(id, job);
  return job;
}

function getJob(id, secret) {
  const job = jobs.get(id);
  if (!job || job.secret !== secret) return null;
  job.lastTouchedAt = Date.now();
  return job;
}

function writeUpload(request, targetPath) {
  return new Promise((resolve, reject) => {
    let receivedBytes = 0;
    const stream = createWriteStream(targetPath);
    request.on("data", (chunk) => {
      receivedBytes += chunk.length;
      if (receivedBytes > maxUploadBytes) request.destroy(new Error("Audio file must be 100 MB or smaller."));
    });
    request.pipe(stream);
    stream.on("finish", resolve);
    stream.on("error", reject);
    request.on("error", reject);
  });
}

function download(response, job, filePath) {
  const fileName = path.basename(filePath).replaceAll('"', "");
  let released = false;
  job.activeDownloads += 1;
  const release = () => {
    if (released) return;
    released = true;
    job.activeDownloads = Math.max(0, job.activeDownloads - 1);
  };

  response.writeHead(200, {
    "content-type": "application/octet-stream",
    "content-disposition": `attachment; filename="${fileName}"`,
  });
  const stream = createReadStream(filePath);
  stream.on("error", release);
  response.on("close", release);
  stream.pipe(response);
}

function removeJob(job) {
  if (job.activeDownloads > 0 || job.processing) return;
  rmSync(job.jobDir, { recursive: true, force: true });
  jobs.delete(job.id);
}

function cleanExpiredJobs() {
  const now = Date.now();
  for (const job of jobs.values()) {
    const ttl = job.outputPath ? resultTtlMs : pendingJobTtlMs;
    if (now - job.lastTouchedAt >= ttl) removeJob(job);
  }
}

async function handleApi(request, response, url) {
  const parts = url.pathname.split("/").filter(Boolean);

  if (request.method === "GET" && url.pathname === "/api/presets") {
    sendJson(response, 200, { presets: publicPresetList() });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/jobs") {
    const job = createJob();
    sendJson(response, 200, { id: job.id, secret: job.secret, uploadUrl: `/api/jobs/${job.id}/upload?secret=${job.secret}` });
    return true;
  }

  if (request.method === "PUT" && parts[0] === "api" && parts[1] === "jobs" && parts[3] === "upload") {
    const job = getJob(parts[2], url.searchParams.get("secret"));
    if (!job) return sendJson(response, 404, { error: "Upload job not found." });

    const contentLength = Number(request.headers["content-length"] || 0);
    if (contentLength > maxUploadBytes) return sendJson(response, 413, { error: "Audio file must be 100 MB or smaller." });

    const fileName = safeName(url.searchParams.get("filename") || "track.wav");
    const inputPath = path.join(job.jobDir, fileName);
    await writeUpload(request, inputPath);

    const analysis = await analyze(inputPath, PRESETS.spotify);
    Object.assign(job, { fileName, inputPath, analysis });
    sendJson(response, 200, { fileName, analysis });
    return true;
  }

  if (request.method === "POST" && parts[0] === "api" && parts[1] === "jobs" && parts[3] === "process") {
    const body = await readJson(request);
    const job = getJob(parts[2], body.secret);
    if (!job || !job.inputPath) return sendJson(response, 404, { error: "Uploaded file not found." });

    const presetName = body.preset || "spotify";
    const preset = PRESETS[presetName];
    if (!preset) return sendJson(response, 400, { error: "Unknown preset." });

    job.processing = true;
    const parsed = path.parse(job.inputPath);
    const outputPath = path.join(parsed.dir, `${parsed.name}_${presetName}.wav`);
    const presetAnalysis = await analyze(job.inputPath, preset);
    await processAudio(job.inputPath, outputPath, preset, presetAnalysis);
    const outputAnalysis = await analyze(outputPath, { ...preset, chain: [] });
    const reportPath = reportPathFor(outputPath);
    writeFileSync(reportPath, formatReport(job.inputPath, outputPath, presetName, preset, presetAnalysis, outputAnalysis), "utf8");

    rmSync(job.inputPath, { force: true });
    Object.assign(job, { outputPath, reportPath, outputAnalysis, presetName, processing: false, lastTouchedAt: Date.now() });
    sendJson(response, 200, {
      preset: publicPresetList().find((item) => item.id === presetName),
      inputAnalysis: presetAnalysis,
      outputAnalysis,
      outputSize: statSync(outputPath).size,
      outputUrl: `/download/${job.id}/${job.secret}/output`,
      reportUrl: `/download/${job.id}/${job.secret}/report`,
    });
    return true;
  }

  if (request.method === "GET" && parts[0] === "download" && parts.length === 4) {
    const job = getJob(parts[1], parts[2]);
    if (!job) {
      response.writeHead(404).end("Download not found.");
      return true;
    }
    if (parts[3] === "output" && job.outputPath) return download(response, job, job.outputPath);
    if (parts[3] === "report" && job.reportPath) return download(response, job, job.reportPath);
    response.writeHead(404).end("File is not ready.");
    return true;
  }

  return false;
}

async function start() {
  mkdirSync(workDir, { recursive: true });
  if (!(await hasFfmpeg())) {
    console.error("ffmpeg is not installed or is not available in PATH.");
    process.exit(1);
  }

  createServer(async (request, response) => {
    const url = new URL(request.url, `http://localhost:${port}`);
    try {
      if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/download/")) {
        const handled = await handleApi(request, response, url);
        if (handled) return;
      }
      serveStatic(request, response, url);
    } catch (error) {
      console.error(error);
      sendJson(response, 500, { error: error.message });
    }
  }).listen(port, () => {
    console.log(`Loudness Adapter web service is running: http://localhost:${port}`);
  });

  setInterval(cleanExpiredJobs, 5 * 60 * 1000).unref();
}

process.on("SIGINT", () => {
  if (process.env.KEEP_WEB_WORK !== "1") rmSync(workDir, { recursive: true, force: true });
  process.exit(0);
});

start();
