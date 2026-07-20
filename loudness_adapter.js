import { spawn } from "node:child_process";
import { existsSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PRESETS = {
  youtube: {
    label: "YouTube",
    targetI: -14,
    truePeak: -1.0,
    lra: 11,
    notes: "Video platform delivery target.",
  },
  spotify: {
    label: "Spotify",
    targetI: -14,
    truePeak: -1.0,
    lra: 11,
    notes: "Music streaming delivery target.",
  },
  apple: {
    label: "Apple Music",
    targetI: -16,
    truePeak: -1.0,
    lra: 11,
    notes: "Apple Sound Check oriented delivery target.",
  },
  tidal: {
    label: "TIDAL",
    targetI: -14,
    truePeak: -1.0,
    lra: 11,
    notes: "Music streaming delivery target.",
  },
  amazon: {
    label: "Amazon Music",
    targetI: -14,
    truePeak: -1.0,
    lra: 11,
    notes: "Music streaming delivery target.",
  },
  deezer: {
    label: "Deezer",
    targetI: -15,
    truePeak: -1.0,
    lra: 11,
    notes: "Music streaming delivery target.",
  },
  yandex_music: {
    label: "Yandex Music",
    targetI: -14,
    truePeak: -1.0,
    lra: 11,
    notes: "Recommended safe streaming delivery target.",
  },
  vk_music: {
    label: "VK Music",
    targetI: -14,
    truePeak: -1.0,
    lra: 11,
    notes: "Recommended safe streaming delivery target.",
  },
  soundcloud: {
    label: "SoundCloud",
    targetI: -14,
    truePeak: -1.0,
    lra: 11,
    notes: "Web playback delivery target.",
  },
  podcast: {
    label: "Podcast / Speech",
    targetI: -16,
    truePeak: -1.0,
    lra: 11,
    notes: "Speech and podcast delivery target.",
  },
  custom_safe: {
    label: "Safe Delivery",
    targetI: -14,
    truePeak: -2.0,
    lra: 11,
    notes: "Extra true-peak headroom for lossy encoding.",
  },
};

function printUsage() {
  console.log(`
Usage:
  node loudness_adapter.js --check
  node loudness_adapter.js input.wav --analyze-only
  node loudness_adapter.js input.wav --preset spotify
  node loudness_adapter.js input.aiff --preset youtube --out output.wav

Presets:
  youtube  -14 LUFS, -1.0 dBTP
  spotify  -14 LUFS, -1.0 dBTP
  apple    -16 LUFS, -1.0 dBTP
  tidal    -14 LUFS, -1.0 dBTP
  amazon   -14 LUFS, -1.0 dBTP
  deezer   -15 LUFS, -1.0 dBTP
  yandex_music -14 LUFS, -1.0 dBTP
  vk_music -14 LUFS, -1.0 dBTP
  soundcloud -14 LUFS, -1.0 dBTP
  podcast  -16 LUFS, -1.0 dBTP
`);
}

function parseArgs(argv) {
  const args = { input: null, preset: "spotify", out: null, check: false, analyzeOnly: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--check") args.check = true;
    else if (arg === "--analyze-only") args.analyzeOnly = true;
    else if (arg === "--preset") args.preset = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (!arg.startsWith("--") && !args.input) args.input = arg;
  }

  return args;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || stdout || `${command} exited with code ${code}`));
    });
  });
}

export async function hasFfmpeg() {
  try {
    await run("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

function buildFilterChain(preset, loudnormFilter) {
  return [...(preset.chain || []), `loudnorm=${loudnormFilter}`].join(",");
}

function extractLoudnormJson(stderr) {
  const match = stderr.match(/\{\s*"input_i"[\s\S]*?\n\}/);
  if (!match) {
    throw new Error("Could not parse ffmpeg loudnorm analysis output.");
  }
  return JSON.parse(match[0]);
}

export async function analyze(input, preset = PRESETS.spotify) {
  const loudnormFilter = [
    `I=${preset.targetI}`,
    `TP=${preset.truePeak}`,
    `LRA=${preset.lra}`,
    "print_format=json",
  ].join(":");

  const { stderr } = await run("ffmpeg", [
    "-hide_banner",
    "-nostats",
    "-i",
    input,
    "-af",
    buildFilterChain(preset, loudnormFilter),
    "-f",
    "null",
    "-",
  ]);

  return extractLoudnormJson(stderr);
}

export async function processAudio(input, output, preset, analysis) {
  const tempOutput = `${output}.tmp.wav`;
  if (existsSync(tempOutput)) {
    rmSync(tempOutput, { force: true });
  }

  const loudnormFilter = [
    `I=${preset.targetI}`,
    `TP=${preset.truePeak}`,
    `LRA=${preset.lra}`,
    `measured_I=${analysis.input_i}`,
    `measured_TP=${analysis.input_tp}`,
    `measured_LRA=${analysis.input_lra}`,
    `measured_thresh=${analysis.input_thresh}`,
    `offset=${analysis.target_offset}`,
    "linear=true",
    "print_format=summary",
  ].join(":");

  await run("ffmpeg", [
    "-hide_banner",
    "-y",
    "-i",
    input,
    "-af",
    buildFilterChain(preset, loudnormFilter),
    "-ar",
    "48000",
    "-c:a",
    "pcm_s24le",
    tempOutput,
  ]);

  const size = statSync(tempOutput).size;
  if (size === 0) {
    rmSync(tempOutput, { force: true });
    throw new Error("ffmpeg created an empty output file. Processing failed.");
  }

  if (existsSync(output)) {
    rmSync(output, { force: true });
  }
  renameSync(tempOutput, output);
}

export async function exportMp3(input, output) {
  const tempOutput = output + '.tmp.mp3';
  if (existsSync(tempOutput)) rmSync(tempOutput, { force: true });

  await run('ffmpeg', [
    '-hide_banner',
    '-y',
    '-i',
    input,
    '-c:a',
    'libmp3lame',
    '-b:a',
    '320k',
    tempOutput,
  ]);

  if (statSync(tempOutput).size === 0) {
    rmSync(tempOutput, { force: true });
    throw new Error('ffmpeg created an empty MP3 output.');
  }

  rmSync(output, { force: true });
  renameSync(tempOutput, output);
}

export function defaultOutputPath(input, presetName) {
  const parsed = path.parse(input);
  return path.join(parsed.dir, `${parsed.name}_${presetName}.wav`);
}

function printReport(input, output, presetName, preset, analysis, outputAnalysis) {
  console.log(formatReport(input, output, presetName, preset, analysis, outputAnalysis));
}

export function reportPathFor(output) {
  const parsed = path.parse(output);
  return path.join(parsed.dir, `${parsed.name}_report.txt`);
}

export function formatReport(input, output, presetName, preset, analysis, outputAnalysis = null) {
  const outputBlock = outputAnalysis
    ? `
Output analysis:
  Integrated LUFS:  ${outputAnalysis.input_i}
  True Peak dBTP:   ${outputAnalysis.input_tp}
  LRA:              ${outputAnalysis.input_lra}
`
    : "";

  return `
Streaming Loudness Adapter Report

Input analysis:
  Input file:       ${input}
  Integrated LUFS:  ${analysis.input_i}
  True Peak dBTP:   ${analysis.input_tp}
  LRA:              ${analysis.input_lra}
  Threshold:        ${analysis.input_thresh}
  Target offset:    ${analysis.target_offset}
  Processing notes: ${preset.notes || "Loudness normalization only."}

Target:
  Preset:           ${preset.label || presetName}
  Target LUFS:      ${preset.targetI}
  True Peak limit:  ${preset.truePeak} dBTP
  Output file:      ${output}
${outputBlock}
`.trimStart();
}

function printAnalysis(input, analysis) {
  console.log("\nAnalysis:");
  console.log(`  Input file:       ${input}`);
  console.log(`  Integrated LUFS:  ${analysis.input_i}`);
  console.log(`  True Peak dBTP:   ${analysis.input_tp}`);
  console.log(`  LRA:              ${analysis.input_lra}`);
  console.log(`  Threshold:        ${analysis.input_thresh}`);
  console.log(`  Target offset:    ${analysis.target_offset}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.check) {
    const ok = await hasFfmpeg();
    console.log(ok ? "ffmpeg: OK" : "ffmpeg: not found");
    if (!ok) {
      console.log("Install ffmpeg first, then run: npm run check");
    }
    return;
  }

  if (!args.input) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const preset = PRESETS[args.preset];
  if (!preset) {
    console.error(`Unknown preset: ${args.preset}`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!existsSync(args.input)) {
    console.error(`Input file not found: ${args.input}`);
    process.exitCode = 1;
    return;
  }

  if (!(await hasFfmpeg())) {
    console.error("ffmpeg is not installed or is not available in PATH.");
    console.error("Install ffmpeg first, then run this command again.");
    process.exitCode = 1;
    return;
  }

  const output = args.out || defaultOutputPath(args.input, args.preset);
  const analysis = await analyze(args.input, preset);
  if (args.analyzeOnly) {
    printAnalysis(args.input, analysis);
    return;
  }

  await processAudio(args.input, output, preset, analysis);
  const outputAnalysis = await analyze(output, { ...preset, chain: [] });
  printReport(args.input, output, args.preset, preset, analysis, outputAnalysis);
  const reportPath = reportPathFor(output);
  writeFileSync(
    reportPath,
    formatReport(args.input, output, args.preset, preset, analysis, outputAnalysis),
    "utf8",
  );
  console.log(`  Report file:      ${reportPath}`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
