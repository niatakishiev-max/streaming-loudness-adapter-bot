const state = {
  job: null,
  presets: [],
  selectedPreset: null,
  uploaded: false,
};

const russianPresetNotes = {
  youtube: "\u0426\u0435\u043b\u044c \u0434\u043b\u044f \u0432\u0438\u0434\u0435\u043e-\u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b.",
  spotify: "\u0426\u0435\u043b\u044c \u0434\u043b\u044f \u043c\u0443\u0437\u044b\u043a\u0430\u043b\u044c\u043d\u043e\u0433\u043e \u0441\u0442\u0440\u0438\u043c\u0438\u043d\u0433\u0430.",
  apple: "\u0426\u0435\u043b\u044c \u0441 \u0443\u0447\u0435\u0442\u043e\u043c Apple Sound Check.",
  tidal: "\u0426\u0435\u043b\u044c \u0434\u043b\u044f \u043c\u0443\u0437\u044b\u043a\u0430\u043b\u044c\u043d\u043e\u0433\u043e \u0441\u0442\u0440\u0438\u043c\u0438\u043d\u0433\u0430.",
  amazon: "\u0426\u0435\u043b\u044c \u0434\u043b\u044f \u043c\u0443\u0437\u044b\u043a\u0430\u043b\u044c\u043d\u043e\u0433\u043e \u0441\u0442\u0440\u0438\u043c\u0438\u043d\u0433\u0430.",
  deezer: "\u0426\u0435\u043b\u044c \u0434\u043b\u044f \u043c\u0443\u0437\u044b\u043a\u0430\u043b\u044c\u043d\u043e\u0433\u043e \u0441\u0442\u0440\u0438\u043c\u0438\u043d\u0433\u0430.",
  soundcloud: "\u0426\u0435\u043b\u044c \u0434\u043b\u044f \u0432\u0435\u0431-\u0432\u043e\u0441\u043f\u0440\u043e\u0438\u0437\u0432\u0435\u0434\u0435\u043d\u0438\u044f.",
  podcast: "\u0426\u0435\u043b\u044c \u0434\u043b\u044f \u0440\u0435\u0447\u0438 \u0438 \u043f\u043e\u0434\u043a\u0430\u0441\u0442\u043e\u0432.",
  safe: "\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u0437\u0430\u043f\u0430\u0441 True Peak \u0434\u043b\u044f \u0441\u0436\u0430\u0442\u044b\u0445 \u0444\u043e\u0440\u043c\u0430\u0442\u043e\u0432.",
};

const fileInput = document.querySelector("#fileInput");
const dropZone = document.querySelector("#dropZone");
const statusText = document.querySelector("#statusText");
const progress = document.querySelector("#progress");
const presetGrid = document.querySelector("#presetGrid");
const analysisGrid = document.querySelector("#analysisGrid");
const resultPanel = document.querySelector("#resultPanel");
const meterCanvas = document.querySelector("#meterCanvas");
function setWorkflowStep(step) {
  const steps = ["upload", "platform", "download"];
  const activeIndex = steps.indexOf(step);
  document.querySelectorAll(".workflow-step").forEach((element, index) => {
    element.classList.toggle("active", index === activeIndex);
    element.classList.toggle("complete", index < activeIndex);
  });
}

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

  const drawNeedle = (lufs, color) => {
    if (!Number.isFinite(Number(lufs))) return;
    const min = -24;
    const max = -8;
    const x = Math.min(width - 40, Math.max(40, ((Number(lufs) - min) / (max - min)) * width));
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, height - 42);
    ctx.lineTo(x, height - 16);
    ctx.stroke();
  };

  drawNeedle(input?.input_i, "#f4f1ec");
  drawNeedle(output?.input_i, "#4ea1ff");
}

function renderPresets() {
  presetGrid.innerHTML = "";
  for (const preset of state.presets) {
    const button = document.createElement("button");
    button.className = `preset-card${preset.id === state.selectedPreset ? " active" : ""}`;
    button.type = "button";
    button.disabled = !state.uploaded;
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
  setWorkflowStep("download");
  resultPanel.hidden = false;
  document.querySelector("#resultTitle").textContent = `${data.preset.label}: \u044d\u043a\u0441\u043f\u043e\u0440\u0442 \u0433\u043e\u0442\u043e\u0432`;
  document.querySelector("#outputLufs").textContent = formatNumber(data.outputAnalysis.input_i);
  document.querySelector("#outputPeak").textContent = formatNumber(data.outputAnalysis.input_tp, " dBTP");
  document.querySelector("#outputLra").textContent = formatNumber(data.outputAnalysis.input_lra);
  document.querySelector("#downloadWav").href = data.outputUrl;
  document.querySelector("#downloadReport").href = data.reportUrl;
  drawMeter(state.job?.analysis, data.outputAnalysis);
}

async function downloadReport(event) {
  event.preventDefault();
  const link = event.currentTarget;
  if (!link.href || link.getAttribute("href") === "#") return;

  try {
    const response = await fetch(link.href);
    if (!response.ok) throw new Error("\u041e\u0442\u0447\u0451\u0442 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d.");

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const download = document.createElement("a");
    download.href = objectUrl;
    download.download = "loudness-adapter-otchet.txt";
    download.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
  } catch (error) {
    setStatus(`\u041e\u0448\u0438\u0431\u043a\u0430: ${error.message}`, 0);
  }
}

async function loadPresets() {
  const response = await fetch("/api/presets");
  const data = await response.json();
  state.presets = data.presets;
  renderPresets();
}

async function uploadFile(file) {
  resultPanel.hidden = true;
  setStatus("\u0421\u043e\u0437\u0434\u0430\u0451\u043c \u0441\u0435\u0441\u0441\u0438\u044e \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438...", 5);
  const jobResponse = await fetch("/api/jobs", { method: "POST" });
  state.job = await jobResponse.json();

  setStatus(`\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c ${file.name}...`, 15);
  const uploadUrl = `${state.job.uploadUrl}&filename=${encodeURIComponent(file.name)}`;
  const response = await fetch(uploadUrl, { method: "PUT", body: file });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u043d\u0435 \u0443\u0434\u0430\u043b\u0430\u0441\u044c.");

  state.job.fileName = data.fileName;
  state.job.analysis = data.analysis;
  state.uploaded = true;
  setWorkflowStep("platform");
  renderPresets();
  setStatus(`\u0410\u043d\u0430\u043b\u0438\u0437 \u0433\u043e\u0442\u043e\u0432: ${data.fileName}. \u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u043b\u043e\u0449\u0430\u0434\u043a\u0443 \u043d\u0438\u0436\u0435, \u0447\u0442\u043e\u0431\u044b \u0441\u043e\u0437\u0434\u0430\u0442\u044c WAV.`, 100);
  showInputAnalysis(data.analysis);
}

async function processPreset(presetId) {
  try {
    state.selectedPreset = presetId;
    renderPresets();
    if (!state.job || !state.uploaded) {
      setStatus("\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0430\u0443\u0434\u0438\u043e\u0444\u0430\u0439\u043b.", 0);
      return;
    }

    setStatus("\u0421\u043e\u0437\u0434\u0430\u0451\u043c WAV \u0434\u043b\u044f \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0439 \u043f\u043b\u043e\u0449\u0430\u0434\u043a\u0438...", 35);
    const response = await fetch(`/api/jobs/${state.job.id}/process`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: state.job.secret, preset: presetId }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "\u041e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0430 \u043d\u0435 \u0443\u0434\u0430\u043b\u0430\u0441\u044c.");

    setStatus("\u042d\u043a\u0441\u043f\u043e\u0440\u0442 \u0433\u043e\u0442\u043e\u0432.", 100);
    showResult(data);
  } catch (error) {
    console.error(error);
    setStatus(`\u041e\u0448\u0438\u0431\u043a\u0430: ${error.message}`, 0);
  }
}
async function handleFile(file) {
  try {
    if (!file) return;
    await uploadFile(file);
  } catch (error) {
    console.error(error);
    setStatus(`\u041e\u0448\u0438\u0431\u043a\u0430: ${error.message}`, 0);
  }
}

fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));
document.querySelector("#downloadReport").addEventListener("click", downloadReport);

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

loadPresets().catch((error) => setStatus(`\u041e\u0448\u0438\u0431\u043a\u0430: ${error.message}`, 0));
drawMeter();
