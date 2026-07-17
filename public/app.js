const state = {
  job: null,
  presets: [],
  selectedPreset: "spotify",
  uploaded: false,
};

const fileInput = document.querySelector("#fileInput");
const dropZone = document.querySelector("#dropZone");
const statusText = document.querySelector("#statusText");
const progress = document.querySelector("#progress");
const presetGrid = document.querySelector("#presetGrid");
const analysisGrid = document.querySelector("#analysisGrid");
const resultPanel = document.querySelector("#resultPanel");
const meterCanvas = document.querySelector("#meterCanvas");

function setStatus(text, value = 0) {
  statusText.textContent = text;
  progress.value = value;
}

function formatNumber(value, suffix = "") {
  if (value === undefined || value === null || value === "") return "-";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(2)}${suffix}` : `${value}${suffix}`;
}

function drawMeter(input = null, output = null) {
  const canvas = meterCanvas;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#202323";
  ctx.fillRect(0, 0, width, height);

  const bars = 56;
  const gap = 6;
  const barWidth = (width - gap * (bars - 1)) / bars;
  for (let i = 0; i < bars; i += 1) {
    const wave = Math.sin(i * 0.48) * 0.35 + Math.sin(i * 0.17) * 0.2 + 0.45;
    const h = Math.max(18, wave * height * 0.72);
    ctx.fillStyle = i % 7 === 0 ? "#d99b3d" : "#f4f1ec";
    ctx.globalAlpha = 0.22;
    ctx.fillRect(i * (barWidth + gap), (height - h) / 2, barWidth, h);
  }
  ctx.globalAlpha = 1;

  const drawNeedle = (lufs, color, label, y) => {
    if (!Number.isFinite(Number(lufs))) return;
    const min = -24;
    const max = -8;
    const x = Math.min(width - 40, Math.max(40, ((Number(lufs) - min) / (max - min)) * width));
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, 24);
    ctx.lineTo(x, height - 24);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = "700 22px system-ui";
    ctx.fillText(`${label} ${Number(lufs).toFixed(1)} LUFS`, 34, y);
  };

  drawNeedle(input?.input_i, "#f4f1ec", "In", 44);
  drawNeedle(output?.input_i, "#4ea1ff", "Out", 76);
}

function renderPresets() {
  presetGrid.innerHTML = "";
  for (const preset of state.presets) {
    const button = document.createElement("button");
    button.className = `preset-card${preset.id === state.selectedPreset ? " active" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <h3>${preset.label}</h3>
      <div class="target">${preset.targetI} LUFS / ${preset.truePeak} dBTP</div>
      <p>${preset.notes}</p>
    `;
    button.addEventListener("click", () => processPreset(preset.id));
    presetGrid.appendChild(button);
  }
}

function showInputAnalysis(analysis) {
  analysisGrid.hidden = false;
  document.querySelector("#metricLufs").textContent = formatNumber(analysis.input_i);
  document.querySelector("#metricPeak").textContent = formatNumber(analysis.input_tp, " dBTP");
  document.querySelector("#metricLra").textContent = formatNumber(analysis.input_lra);
  drawMeter(analysis, null);
}

function showResult(data) {
  resultPanel.hidden = false;
  document.querySelector("#resultTitle").textContent = `${data.preset.label} export ready`;
  document.querySelector("#outputLufs").textContent = formatNumber(data.outputAnalysis.input_i);
  document.querySelector("#outputPeak").textContent = formatNumber(data.outputAnalysis.input_tp, " dBTP");
  document.querySelector("#outputLra").textContent = formatNumber(data.outputAnalysis.input_lra);
  document.querySelector("#downloadWav").href = data.outputUrl;
  document.querySelector("#downloadReport").href = data.reportUrl;
  drawMeter(state.job?.analysis, data.outputAnalysis);
}

async function loadPresets() {
  const response = await fetch("/api/presets");
  const data = await response.json();
  state.presets = data.presets;
  renderPresets();
}

async function uploadFile(file) {
  resultPanel.hidden = true;
  setStatus("Creating upload session...", 5);
  const jobResponse = await fetch("/api/jobs", { method: "POST" });
  state.job = await jobResponse.json();

  setStatus(`Uploading ${file.name}...`, 15);
  const uploadUrl = `${state.job.uploadUrl}&filename=${encodeURIComponent(file.name)}`;
  const response = await fetch(uploadUrl, { method: "PUT", body: file });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Upload failed.");

  state.job.fileName = data.fileName;
  state.job.analysis = data.analysis;
  state.uploaded = true;
  setStatus(`Analysis complete: ${data.fileName}`, 100);
  showInputAnalysis(data.analysis);
}

async function processPreset(presetId) {
  state.selectedPreset = presetId;
  renderPresets();
  if (!state.job || !state.uploaded) {
    setStatus("Choose an audio file first.", 0);
    return;
  }

  setStatus("Rendering platform-ready WAV...", 35);
  const response = await fetch(`/api/jobs/${state.job.id}/process`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret: state.job.secret, preset: presetId }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Processing failed.");

  setStatus("Export complete.", 100);
  showResult(data);
}

async function handleFile(file) {
  try {
    if (!file) return;
    await uploadFile(file);
  } catch (error) {
    console.error(error);
    setStatus(`Error: ${error.message}`, 0);
  }
}

fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragging");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragging"));
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
  handleFile(event.dataTransfer.files[0]);
});

loadPresets().catch((error) => setStatus(`Error: ${error.message}`, 0));
drawMeter();
