import { state, setCurrentMeasure } from "./state.js";
import { showStatus } from "./editor.js";

const audio = new Audio();
audio.preload = "metadata";
let audioContext = null;
let audioBuffer = null;
let waveformPeaks = null;
let waveformCacheWidth = 0;
let audioBlob = null;
let audioFileName = "";
let objectUrl = null;
let animationId = 0;

const canvas = document.querySelector("#audio-waveform");
const context2d = canvas.getContext("2d");
const playButton = document.querySelector("#audio-play-button");
const stopButton = document.querySelector("#audio-stop-button");
const timeDisplay = document.querySelector("#audio-time-display");
const fileNameDisplay = document.querySelector("#audio-file-name");

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${rest.toFixed(1).padStart(4, "0")}`;
}

function updateTimeDisplay() {
  timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
}

function resizeCanvas() {
  if (!canvas || !context2d) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.round(rect.width * ratio);
  const height = Math.round(rect.height * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  drawWaveform();
}

function drawWaveform() {
  if (!canvas || !context2d) return;
  const width = canvas.width;
  const height = canvas.height;
  if (!width || !height) return;

  context2d.clearRect(0, 0, width, height);
  context2d.fillStyle = "#0b1728";
  context2d.fillRect(0, 0, width, height);
  context2d.strokeStyle = "rgba(135, 160, 190, .18)";
  context2d.lineWidth = 1;
  context2d.beginPath();
  context2d.moveTo(0, height / 2);
  context2d.lineTo(width, height / 2);
  context2d.stroke();

  if (audioBuffer) {
    if (!waveformPeaks || waveformCacheWidth !== width) {
      const samples = audioBuffer.getChannelData(0);
      waveformPeaks = new Float32Array(width * 2);
      for (let x = 0; x < width; x++) {
        const start = Math.floor(x * samples.length / width);
        const end = Math.max(start + 1, Math.floor((x + 1) * samples.length / width));
        let minimum = 1;
        let maximum = -1;
        for (let index = start; index < end; index++) {
          const sample = samples[index];
          if (sample < minimum) minimum = sample;
          if (sample > maximum) maximum = sample;
        }
        waveformPeaks[x * 2] = minimum;
        waveformPeaks[x * 2 + 1] = maximum;
      }
      waveformCacheWidth = width;
    }
    context2d.strokeStyle = "#4ed9e6";
    context2d.lineWidth = Math.max(1, window.devicePixelRatio || 1);
    context2d.beginPath();
    for (let x = 0; x < width; x++) {
      const minimum = waveformPeaks[x * 2];
      const maximum = waveformPeaks[x * 2 + 1];
      const yTop = (1 - maximum) * height / 2;
      const yBottom = (1 - minimum) * height / 2;
      context2d.moveTo(x + 0.5, yTop);
      context2d.lineTo(x + 0.5, Math.max(yTop + 1, yBottom));
    }
    context2d.stroke();
  } else {
    context2d.fillStyle = "#71859e";
    context2d.font = `${Math.round(12 * (window.devicePixelRatio || 1))}px sans-serif`;
    context2d.textAlign = "center";
    context2d.fillText("MP3 / WAV を読み込むと波形が表示されます", width / 2, height / 2 + 4);
  }

  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    const progress = Math.max(0, Math.min(1, audio.currentTime / audio.duration));
    const x = progress * width;
    context2d.strokeStyle = "#ffbf69";
    context2d.lineWidth = Math.max(2, window.devicePixelRatio || 1);
    context2d.beginPath();
    context2d.moveTo(x, 0);
    context2d.lineTo(x, height);
    context2d.stroke();
  }
}

function syncEditorToAudio() {
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  const offsetSeconds = state.audioOffsetMs / 1000;
  const chartSeconds = Math.max(0, audio.currentTime - offsetSeconds);
  const secondsPerMeasure = (60 / state.bpm) * 4;
  const measure = Math.min(9999, Math.floor(chartSeconds / secondsPerMeasure) + 1);
  const withinMeasure = chartSeconds % secondsPerMeasure;
  const step = Math.min(15, Math.floor(withinMeasure / (secondsPerMeasure / 16)));

  if (measure !== state.currentMeasure) setCurrentMeasure(measure);
  const percent = duration > 0 && chartSeconds > 0
    ? ((withinMeasure / secondsPerMeasure) * 100)
    : 0;
  document.querySelector("#measure-grid")?.style.setProperty("--playback-percent", `${percent}%`);
  document.querySelector("#playback-readout").textContent = `再生位置：${measure}小節 ${step + 1}/16`;
  drawWaveform();
}

function animationFrame() {
  syncEditorToAudio();
  updateTimeDisplay();
  if (!audio.paused && !audio.ended) animationId = requestAnimationFrame(animationFrame);
  else animationId = 0;
}

function startAnimation() {
  if (!animationId) animationId = requestAnimationFrame(animationFrame);
}

async function decodeForWaveform(file) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("このブラウザは波形解析に対応していません。");
  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") await audioContext.resume();
  const arrayBuffer = await file.arrayBuffer();
  return audioContext.decodeAudioData(arrayBuffer.slice(0));
}

function setLoadedUI(loaded) {
  playButton.disabled = !loaded;
  stopButton.disabled = !loaded;
  playButton.textContent = loaded && !audio.paused ? "一時停止" : "再生";
}

export async function loadAudioFile(file) {
  if (!file) return;
  const allowed = /\.(mp3|wav|wave)$/i.test(file.name) || ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"].includes(file.type);
  if (!allowed) throw new Error("MP3またはWAVファイルを選択してください。");

  audio.pause();
  setLoadedUI(false);
  if (animationId) cancelAnimationFrame(animationId);
  animationId = 0;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  audioBlob = file;
  audioFileName = file.name;
  audioBuffer = null;
  waveformPeaks = null;
  waveformCacheWidth = 0;
  objectUrl = URL.createObjectURL(file);
  audio.src = objectUrl;
  audio.currentTime = 0;

  await new Promise((resolve, reject) => {
    const onLoaded = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("音源を読み込めませんでした。ファイル形式や破損を確認してください。")); };
    const cleanup = () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("error", onError);
    };
    audio.addEventListener("loadedmetadata", onLoaded, { once: true });
    audio.addEventListener("error", onError, { once: true });
    audio.load();
  });

  fileNameDisplay.textContent = `${audioFileName} · ${formatTime(audio.duration)}`;
  setLoadedUI(true);
  updateTimeDisplay();
  try {
    audioBuffer = await decodeForWaveform(file);
    waveformPeaks = null;
    waveformCacheWidth = 0;
    showStatus("音源を読み込み、波形を解析しました。");
  } catch (error) {
    showStatus(`音源は再生できますが、波形を作成できませんでした。${error.message}`, true);
  }
  syncEditorToAudio();
  drawWaveform();
}

export async function restoreAudioBlob(blob, name = "保存済み音源") {
  if (!(blob instanceof Blob) || blob.size === 0) return false;
  const file = new File([blob], name, { type: blob.type || "audio/mpeg" });
  await loadAudioFile(file);
  return true;
}

export function clearAudio() {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null;
  audioBlob = null;
  audioFileName = "";
  audioBuffer = null;
  waveformPeaks = null;
  waveformCacheWidth = 0;
  if (animationId) cancelAnimationFrame(animationId);
  animationId = 0;
  fileNameDisplay.textContent = "音源が読み込まれていません。MP3 / WAVに対応。";
  setLoadedUI(false);
  updateTimeDisplay();
  syncEditorToAudio();
}

export function getAudioForSave() {
  return { blob: audioBlob, name: audioFileName };
}

export async function togglePlayback() {
  if (!audio.src) {
    showStatus("先にMP3またはWAVを読み込んでください。", true);
    return;
  }
  if (audio.paused) {
    if (audio.ended) audio.currentTime = 0;
    try {
      await audio.play();
      playButton.textContent = "一時停止";
      startAnimation();
      showStatus("音源を再生しています。");
    } catch (error) {
      showStatus(`再生できませんでした: ${error.message}`, true);
    }
  } else {
    audio.pause();
    playButton.textContent = "再生";
    showStatus("再生を一時停止しました。");
  }
}

export function stopPlayback() {
  audio.pause();
  audio.currentTime = 0;
  playButton.textContent = "再生";
  syncEditorToAudio();
  updateTimeDisplay();
  showStatus("再生を停止しました。");
}

export function setVolume(value) {
  const volume = Number(value);
  if (!Number.isFinite(volume)) return;
  audio.volume = Math.max(0, Math.min(1, volume));
}

export function setAudioOffset(value) {
  const offset = Number(value);
  if (!Number.isInteger(offset) || offset < -5000 || offset > 5000) {
    throw new Error("オフセットは -5000〜5000 ms の整数にしてください。");
  }
  state.audioOffsetMs = offset;
  syncEditorToAudio();
}

export function initAudioEvents() {
  document.querySelector("#audio-load-button").addEventListener("click", () => document.querySelector("#audio-file").click());
  document.querySelector("#audio-file").addEventListener("change", async event => {
    const input = event.currentTarget;
    try {
      await loadAudioFile(input.files?.[0]);
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "音源を読み込めませんでした。", true);
    } finally {
      input.value = "";
    }
  });
  playButton.addEventListener("click", togglePlayback);
  stopButton.addEventListener("click", stopPlayback);
  document.querySelector("#audio-volume").addEventListener("input", event => setVolume(event.currentTarget.value));
  document.querySelector("#audio-offset-input").addEventListener("change", event => {
    try {
      setAudioOffset(event.currentTarget.value);
      showStatus(`譜面開始オフセットを ${state.audioOffsetMs} ms に設定しました。`);
    } catch (error) {
      event.currentTarget.value = state.audioOffsetMs;
      showStatus(error.message, true);
    }
  });

  canvas.addEventListener("click", event => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    syncEditorToAudio();
    updateTimeDisplay();
  });
  audio.addEventListener("timeupdate", () => {
    syncEditorToAudio();
    updateTimeDisplay();
  });
  audio.addEventListener("play", () => setLoadedUI(true));
  audio.addEventListener("pause", () => {
    setLoadedUI(Boolean(audio.src));
    if (animationId) cancelAnimationFrame(animationId);
    animationId = 0;
    drawWaveform();
  });
  audio.addEventListener("ended", () => {
    playButton.textContent = "再生";
    updateTimeDisplay();
  });
  if ("ResizeObserver" in window) new ResizeObserver(resizeCanvas).observe(canvas);
  else window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  updateTimeDisplay();
}
