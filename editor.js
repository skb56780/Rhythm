import {
  state,
  STEPS_PER_MEASURE,
  MAX_NOTES_PER_MEASURE,
  canUndo,
  canRedo,
  setCursorStep
} from "./state.js";

const gridElement = document.querySelector("#measure-grid");
const rulerElement = document.querySelector("#beat-ruler");
const LANE_KEYS = ["D", "F", "J", "K"];
const LANE_NAMES = ["レーン 1", "レーン 2", "レーン 3", "レーン 4"];

// セルをクリックしたら、ノーツではなくカーソル位置だけを変更する。
gridElement.addEventListener("click", event => {
  const cell = event.target.closest(".step-cell");
  if (!cell || !gridElement.contains(cell)) return;
  setCursorStep(Number(cell.dataset.step));
  gridElement.focus({ preventScroll: true });
  showStatus("配置位置を移動しました。D・F・J・Kでノーツを配置できます。");
});

export function renderEditor() {
  renderRuler();
  renderLanes();

  const measureNotes = state.notes.filter(note => (note.measure ?? 1) === state.currentMeasure);
  document.querySelector("#note-count").textContent =
    `${measureNotes.length} / ${MAX_NOTES_PER_MEASURE}`;
  document.querySelector("#beat-length").textContent =
    `${Math.round(60000 / state.bpm)} ms`;
  document.querySelector("#bpm-input").value = state.bpm;
  document.querySelector("#snap-select").value = String(state.snap);
  document.querySelector("#measure-title").textContent = `小節 ${state.currentMeasure}`;
  document.querySelector("#cursor-position").textContent = formatCursorPosition(state.cursorStep);
  document.querySelector("#audio-offset-input").value = String(state.audioOffsetMs ?? 0);

  gridElement.style.setProperty(
    "--cursor-percent",
    `${((state.cursorStep + 0.5) / STEPS_PER_MEASURE) * 100}%`
  );
  document.querySelectorAll("[data-tool]").forEach(button => {
    button.classList.toggle("is-active", button.dataset.tool === state.tool);
    button.setAttribute("aria-pressed", String(button.dataset.tool === state.tool));
  });
  document.querySelector("#undo-button").disabled = !canUndo();
  document.querySelector("#redo-button").disabled = !canRedo();
  document.querySelector("#measure-prev").disabled = state.currentMeasure <= 1;
}

function formatCursorPosition(step) {
  const beat = Math.floor(step / 4) + 1;
  if (state.snap === 4) return `${beat}拍目`;
  if (state.snap === 2) return `${beat}拍目・8分 ${Math.floor((step % 4) / 2) + 1}`;
  return `${beat}拍目・16分 ${step + 1}`;
}

function renderRuler() {
  rulerElement.replaceChildren();
  for (let step = 0; step < STEPS_PER_MEASURE; step++) {
    const label = document.createElement("span");
    if (step % 4 === 0) label.textContent = String(step / 4 + 1);
    rulerElement.append(label);
  }
}

function renderLanes() {
  // グリッドを毎回組み直す。カーソル線は保持し、4本のレーンを必ず描画する。
  let playhead = gridElement.querySelector(".playhead-overlay");
  if (!playhead) {
    playhead = document.createElement("div");
    playhead.className = "playhead-overlay";
    playhead.setAttribute("aria-hidden", "true");
  }
  if (!playhead.querySelector(".playhead-line")) {
    const line = document.createElement("div");
    line.className = "playhead-line";
    playhead.append(line);
  }
  if (!playhead.querySelector(".playback-line")) {
    const playbackLine = document.createElement("div");
    playbackLine.className = "playback-line";
    playhead.append(playbackLine);
  }
  gridElement.replaceChildren(playhead);

  const fragment = document.createDocumentFragment();
  for (let lane = 1; lane <= 4; lane++) {
    const row = document.createElement("div");
    row.className = "lane-row";
    row.dataset.lane = String(lane);

    const laneName = document.createElement("div");
    laneName.className = "lane-name";
    const laneLabel = document.createElement("span");
    laneLabel.className = "lane-name-label";
    laneLabel.textContent = LANE_NAMES[lane - 1];
    const laneKey = document.createElement("kbd");
    laneKey.textContent = LANE_KEYS[lane - 1];
    laneKey.setAttribute("aria-label", `${LANE_KEYS[lane - 1]}キーでこのレーンに配置`);
    laneName.append(laneLabel, laneKey);

    const laneGrid = document.createElement("div");
    laneGrid.className = "lane-grid";

    for (let step = 0; step < STEPS_PER_MEASURE; step++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `step-cell${step === state.cursorStep ? " is-cursor" : ""}`;
      cell.dataset.lane = String(lane);
      cell.dataset.step = String(step);
      cell.setAttribute("aria-label", `${LANE_NAMES[lane - 1]}、${step + 1}番目の位置へカーソルを移動`);
      laneGrid.append(cell);
    }

    state.notes
      .filter(note => (note.measure ?? 1) === state.currentMeasure && note.lane === lane)
      .forEach(note => {
        const pill = document.createElement("span");
        pill.className = `note-pill ${note.type}`;
        pill.dataset.step = String(note.step);
        pill.dataset.type = note.type;
        const duration = note.type === "hold"
          ? Math.min(note.durationSteps, STEPS_PER_MEASURE - note.step)
          : 1;
        pill.style.gridColumn = `${note.step + 1} / span ${duration}`;
        pill.title = note.type === "hold" ? "長押しノーツ" : "タップノーツ";
        laneGrid.append(pill);
      });

    row.append(laneName, laneGrid);
    fragment.append(row);
  }

  gridElement.insertBefore(fragment, playhead);
}

export function showStatus(message, isError = false) {
  const status = document.querySelector("#status-message");
  const dot = document.querySelector(".status-dot");
  status.textContent = message;
  dot.style.background = isError ? "var(--danger)" : "#55d8b0";
  dot.style.boxShadow = isError
    ? "0 0 9px rgba(255, 113, 133, .5)"
    : "0 0 9px rgba(85, 216, 176, .5)";
}
