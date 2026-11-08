import { state, replaceChart, STEPS_PER_MEASURE } from "./state.js";
import { validateChart } from "./validator.js";

function globalStepToMilliseconds(globalStep, bpm) {
  const sixteenthNoteMs = 60000 / bpm / 4;
  return Math.round(globalStep * sixteenthNoteMs);
}

function durationToMilliseconds(durationSteps, bpm) {
  const sixteenthNoteMs = 60000 / bpm / 4;
  return Math.round(durationSteps * sixteenthNoteMs);
}

export function createTxtContent() {
  const chart = { bpm: state.bpm, notes: state.notes, audioOffsetMs: state.audioOffsetMs ?? 0 };
  const errors = validateChart(chart);
  if (errors.length) throw new Error(errors.join("\n"));

  const maxMeasure = state.notes.reduce((max, note) => Math.max(max, note.measure ?? 1), 1);
  const lines = [
    "# RHYTHM_MAKER",
    `# BPM:${state.bpm}`,
    "# LANES:4",
    `# MEASURES:${maxMeasure}`,
    `# AUDIO_OFFSET_MS:${state.audioOffsetMs ?? 0}`,
    "# time_ms|lane|type|duration_ms",
    "# time_ms is measured from the beginning of the whole song"
  ];

  const sortedNotes = [...state.notes].sort((a, b) =>
    (a.measure ?? 1) - (b.measure ?? 1) || a.step - b.step || a.lane - b.lane
  );
  for (const note of sortedNotes) {
    const measure = note.measure ?? 1;
    const globalStep = (measure - 1) * STEPS_PER_MEASURE + note.step;
    const timeMs = globalStepToMilliseconds(globalStep, state.bpm);
    const durationMs = note.type === "hold"
      ? durationToMilliseconds(note.durationSteps, state.bpm)
      : 0;
    lines.push(`${timeMs}|${note.lane}|${note.type}|${durationMs}`);
  }
  return lines.join("\n") + "\n";
}

export function downloadTxt() {
  const text = createTxtContent();
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "rhythm-chart.txt";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function loadTxtFile(file) {
  if (!file) return;
  const text = await file.text();
  const bpmMatch = text.match(/^#\s*BPM\s*:\s*(\d+)/mi);
  const offsetMatch = text.match(/^#\s*AUDIO_OFFSET_MS\s*:\s*(-?\d+)/mi);
  const bpm = bpmMatch ? Number(bpmMatch[1]) : 120;
  const audioOffsetMs = offsetMatch ? Number(offsetMatch[1]) : 0;
  if (!Number.isInteger(audioOffsetMs) || audioOffsetMs < -5000 || audioOffsetMs > 5000) {
    throw new Error("音源オフセットは -5000〜5000 ms の整数にしてください。");
  }
  const notes = [];

  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const parts = line.split("|").map(part => part.trim());
    if (parts.length !== 4) {
      throw new Error(`${index + 1}行目の形式が正しくありません。`);
    }
    const [timeText, laneText, type, durationText] = parts;
    const timeMs = Number(timeText);
    const lane = Number(laneText);
    const durationMs = Number(durationText);

    if (![timeMs, lane, durationMs].every(Number.isFinite) || timeMs < 0 || durationMs < 0) {
      throw new Error(`${index + 1}行目に正しくない数値があります。`);
    }
    if (!Number.isInteger(bpm) || bpm < 30 || bpm > 300) {
      throw new Error("読み込んだBPMは30〜300の整数にしてください。");
    }
    if (type === "tap" && durationMs !== 0) {
      throw new Error(`${index + 1}行目のタップノーツの長さは0にしてください。`);
    }
    if (type === "hold" && durationMs <= 0) {
      throw new Error(`${index + 1}行目の長押しノーツには0より大きい長さが必要です。`);
    }

    const sixteenthNoteMs = 60000 / bpm / 4;
    const globalStep = Math.round(timeMs / sixteenthNoteMs);
    const measure = Math.floor(globalStep / STEPS_PER_MEASURE) + 1;
    const step = globalStep % STEPS_PER_MEASURE;
    const durationSteps = type === "hold"
      ? Math.max(1, Math.round(durationMs / sixteenthNoteMs))
      : 0;

    notes.push({ measure, lane, step, type, durationSteps });
  }

  const errors = validateChart({ bpm, notes });
  if (errors.length) throw new Error(errors.join("\n"));
  replaceChart({ bpm, notes, audioOffsetMs });
}
