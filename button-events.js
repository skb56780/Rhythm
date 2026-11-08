import {
  state,
  setBpm,
  setTool,
  setSnap,
  clearNotes,
  moveMeasure,
  undo,
  redo
} from "../state.js";
import { showStatus } from "../editor.js";
import { downloadTxt, loadTxtFile } from "../file-manager.js";

function getElement(selector) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`画面の要素が見つかりません: ${selector}`);
  return element;
}

function focusEditor() {
  getElement("#measure-grid").focus({ preventScroll: true });
}

export function initButtonEvents() {
  getElement("#bpm-input").addEventListener("change", event => {
    const input = event.currentTarget;
    try {
      setBpm(input.value);
      showStatus(`BPMを${state.bpm}に設定しました。`);
      focusEditor();
    } catch (error) {
      input.value = state.bpm;
      showStatus(error instanceof Error ? error.message : "BPMを変更できませんでした。", true);
    }
  });

  document.querySelectorAll("[data-tool]").forEach(button => {
    button.addEventListener("click", () => {
      setTool(button.dataset.tool);
      const names = { tap: "タップノーツ", hold: "長押しノーツ", erase: "消しゴム" };
      showStatus(`${names[state.tool]}を選択しました。D・F・J・Kで配置できます。`);
      focusEditor();
    });
  });

  getElement("#snap-select").addEventListener("change", event => {
    setSnap(event.currentTarget.value);
    showStatus("カーソルの移動間隔を変更しました。");
    focusEditor();
  });

  getElement("#measure-prev").addEventListener("click", () => {
    moveMeasure(-1);
    showStatus(`小節${state.currentMeasure}を編集中です。`);
    focusEditor();
  });

  getElement("#measure-next").addEventListener("click", () => {
    moveMeasure(1);
    showStatus(`小節${state.currentMeasure}を編集中です。`);
    focusEditor();
  });

  getElement("#undo-button").addEventListener("click", () => {
    showStatus(undo() ? "ひとつ前の状態に戻しました。" : "戻せる操作はありません。");
    focusEditor();
  });

  getElement("#redo-button").addEventListener("click", () => {
    showStatus(redo() ? "操作をやり直しました。" : "やり直せる操作はありません。");
    focusEditor();
  });

  getElement("#clear-button").addEventListener("click", () => {
    const hasNotes = state.notes.some(note => (note.measure ?? 1) === state.currentMeasure);
    if (!hasNotes) {
      showStatus("この小節にはノーツがありません。");
      focusEditor();
      return;
    }
    if (window.confirm(`小節${state.currentMeasure}のノーツをすべて削除しますか？`)) {
      clearNotes();
      showStatus(`小節${state.currentMeasure}をクリアしました。`);
    }
    focusEditor();
  });

  getElement("#export-button").addEventListener("click", () => {
    try {
      downloadTxt();
      showStatus("TXTファイルを書き出しました。");
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "TXTを書き出せませんでした。", true);
    }
    focusEditor();
  });

  const importButton = getElement("#import-button");
  const importInput = getElement("#import-file");
  importButton.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", async event => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    try {
      await loadTxtFile(file);
      showStatus("TXTファイルを読み込みました。");
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "TXTを読み込めませんでした。", true);
    } finally {
      input.value = "";
      focusEditor();
    }
  });
}
