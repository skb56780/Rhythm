import { MAX_NOTES_PER_MEASURE, STEPS_PER_MEASURE } from "./state.js";

export function validateChart({ bpm, notes, audioOffsetMs }) {
  const errors = [];
  const numericBpm = Number(bpm);

  if (!Number.isInteger(numericBpm) || numericBpm < 30 || numericBpm > 300) {
    errors.push("BPMは30〜300の整数にしてください。");
  }
  if (audioOffsetMs !== undefined && (!Number.isInteger(Number(audioOffsetMs)) || Number(audioOffsetMs) < -5000 || Number(audioOffsetMs) > 5000)) {
    errors.push("音源オフセットは -5000〜5000 ms の整数にしてください。");
  }
  if (!Array.isArray(notes)) {
    errors.push("ノーツデータが配列ではありません。");
    return errors;
  }

  const occupied = new Set();
  const countByMeasure = new Map();
  for (const [index, note] of notes.entries()) {
    if (!note || typeof note !== "object") {
      errors.push(`${index + 1}個目のノーツデータがオブジェクトではありません。`);
      continue;
    }
    const measure = note.measure ?? 1;
    if (!Number.isInteger(measure) || measure < 1 || measure > 9999) {
      errors.push(`${index + 1}個目の小節番号が不正です。`);
    }
    if (!Number.isInteger(note.lane) || note.lane < 1 || note.lane > 4) {
      errors.push(`${index + 1}個目のレーン番号が不正です。`);
    }
    if (!Number.isInteger(note.step) || note.step < 0 || note.step >= STEPS_PER_MEASURE) {
      errors.push(`${index + 1}個目の配置位置が不正です。`);
    }
    if (!["tap", "hold"].includes(note.type)) {
      errors.push(`${index + 1}個目のノーツ種類が不正です。`);
    }
    if (note.type === "tap" && note.durationSteps !== 0 && note.durationSteps !== undefined) {
      errors.push(`${index + 1}個目のタップノーツの長さは0にしてください。`);
    }
    if (note.type === "hold" &&
        (!Number.isInteger(note.durationSteps) || note.durationSteps < 1 ||
         note.step + note.durationSteps > STEPS_PER_MEASURE)) {
      errors.push(`${index + 1}個目の長押しの長さが不正です。`);
    }

    const key = `${measure}:${note.lane}:${note.step}`;
    if (occupied.has(key)) errors.push(`${index + 1}個目のノーツ位置が重複しています。`);
    occupied.add(key);
    countByMeasure.set(measure, (countByMeasure.get(measure) ?? 0) + 1);
  }

  for (const [measure, count] of countByMeasure) {
    if (count > MAX_NOTES_PER_MEASURE) {
      errors.push(`小節${measure}のノーツ数が上限の${MAX_NOTES_PER_MEASURE}個を超えています。`);
    }
  }
  return errors;
}
