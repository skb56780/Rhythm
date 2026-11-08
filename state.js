export const MAX_NOTES_PER_MEASURE = 36;
export const STEPS_PER_MEASURE = 16;
export const MAX_MEASURE_NUMBER = 9999;

export const state = {
  bpm: 120,
  tool: "tap",
  snap: 1,
  currentMeasure: 1,
  cursorStep: 0,
  audioOffsetMs: 0,
  notes: []
};

const undoStack = [];
const redoStack = [];
const HISTORY_LIMIT = 100;

function createNoteId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function snapshot() {
  return {
    bpm: state.bpm,
    audioOffsetMs: state.audioOffsetMs,
    notes: state.notes.map(note => ({ ...note }))
  };
}

function rememberBeforeChange() {
  undoStack.push(snapshot());
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0;
}

function notify() {
  document.dispatchEvent(new CustomEvent("rhythm:statechange"));
}

function notesInMeasure(measure) {
  return state.notes.filter(note => (note.measure ?? 1) === measure);
}

export function setBpm(value) {
  const bpm = Number(value);
  if (!Number.isInteger(bpm) || bpm < 30 || bpm > 300) {
    throw new Error("BPMは30〜300の整数で入力してください。");
  }
  if (bpm === state.bpm) return;
  rememberBeforeChange();
  state.bpm = bpm;
  notify();
}

export function setTool(tool) {
  if (!["tap", "hold", "erase"].includes(tool)) return;
  state.tool = tool;
  notify();
}

export function setSnap(stepSize) {
  const size = Number(stepSize);
  if (![1, 2, 4].includes(size)) return;
  state.snap = size;
  state.cursorStep = Math.min(STEPS_PER_MEASURE - size, Math.round(state.cursorStep / size) * size);
  notify();
}

export function setCursorStep(step) {
  if (!Number.isInteger(step)) return;
  const snappedStep = Math.round(step / state.snap) * state.snap;
  state.cursorStep = Math.max(0, Math.min(STEPS_PER_MEASURE - state.snap, snappedStep));
  notify();
}

export function moveCursor(direction) {
  if (direction !== -1 && direction !== 1) return;
  setCursorStep(state.cursorStep + direction * state.snap);
}

export function setCurrentMeasure(measure) {
  const nextMeasure = Number(measure);
  if (!Number.isInteger(nextMeasure) || nextMeasure < 1 || nextMeasure > MAX_MEASURE_NUMBER) return;
  if (nextMeasure === state.currentMeasure) return;
  state.currentMeasure = nextMeasure;
  notify();
}

export function moveMeasure(direction) {
  if (direction !== -1 && direction !== 1) return;
  setCurrentMeasure(Math.max(1, Math.min(MAX_MEASURE_NUMBER, state.currentMeasure + direction)));
}

export function addNote(lane, step, type) {
  if (!Number.isInteger(lane) || lane < 1 || lane > 4) {
    throw new Error("レーン番号が正しくありません。");
  }
  if (!Number.isInteger(step) || step < 0 || step >= STEPS_PER_MEASURE) {
    throw new Error("配置位置が正しくありません。");
  }
  if (!["tap", "hold"].includes(type)) return false;

  const existingIndex = state.notes.findIndex(note =>
    (note.measure ?? 1) === state.currentMeasure && note.lane === lane && note.step === step
  );
  let result = "added";
  if (existingIndex !== -1) {
    rememberBeforeChange();
    state.notes.splice(existingIndex, 1);
    result = "removed";
  } else {
    const countInMeasure = notesInMeasure(state.currentMeasure).length;
    if (countInMeasure >= MAX_NOTES_PER_MEASURE) {
      throw new Error(`1小節に置けるノーツは最大${MAX_NOTES_PER_MEASURE}個です。`);
    }
    rememberBeforeChange();
    const durationSteps = type === "hold" ? Math.min(4, STEPS_PER_MEASURE - step) : 0;
    state.notes.push({
      id: createNoteId(),
      measure: state.currentMeasure,
      lane,
      step,
      type,
      durationSteps
    });
  }
  state.notes.sort((a, b) =>
    (a.measure ?? 1) - (b.measure ?? 1) || a.step - b.step || a.lane - b.lane
  );
  notify();
  return result;
}

export function removeNote(lane, step) {
  const index = state.notes.findIndex(note =>
    (note.measure ?? 1) === state.currentMeasure && note.lane === lane && note.step === step
  );
  if (index === -1) return false;
  rememberBeforeChange();
  state.notes.splice(index, 1);
  notify();
  return true;
}

export function clearNotes() {
  const remaining = state.notes.filter(note => (note.measure ?? 1) !== state.currentMeasure);
  if (remaining.length === state.notes.length) return false;
  rememberBeforeChange();
  state.notes = remaining;
  notify();
  return true;
}

export function replaceChart({ bpm, notes, audioOffsetMs = 0 }) {
  const nextBpm = Number(bpm);
  if (!Number.isInteger(nextBpm) || nextBpm < 30 || nextBpm > 300) {
    throw new Error("読み込んだBPMが正しくありません。");
  }
  if (!Array.isArray(notes)) throw new Error("ノーツデータが正しくありません。");
  rememberBeforeChange();
  state.bpm = nextBpm;
  state.audioOffsetMs = Number.isInteger(audioOffsetMs) && audioOffsetMs >= -5000 && audioOffsetMs <= 5000 ? audioOffsetMs : 0;
  state.notes = notes.map(note => ({
    ...note,
    measure: Number.isInteger(note.measure) && note.measure >= 1 ? note.measure : 1,
    id: createNoteId()
  }));
  state.currentMeasure = 1;
  state.cursorStep = 0;
  notify();
}

export function undo() {
  if (undoStack.length === 0) return false;
  redoStack.push(snapshot());
  const previous = undoStack.pop();
  state.bpm = previous.bpm;
  state.audioOffsetMs = previous.audioOffsetMs ?? 0;
  state.notes = previous.notes.map(note => ({ ...note }));
  notify();
  return true;
}

export function redo() {
  if (redoStack.length === 0) return false;
  undoStack.push(snapshot());
  const next = redoStack.pop();
  state.bpm = next.bpm;
  state.audioOffsetMs = next.audioOffsetMs ?? 0;
  state.notes = next.notes.map(note => ({ ...note }));
  notify();
  return true;
}

export function canUndo() { return undoStack.length > 0; }
export function canRedo() { return redoStack.length > 0; }
