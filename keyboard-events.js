import { state, moveCursor, moveMeasure } from "../state.js";
import { handleLaneKey } from "../notes.js";
import { showStatus } from "../editor.js";

const LANE_BY_CODE = {
  KeyD: 1,
  KeyF: 2,
  KeyJ: 3,
  KeyK: 4
};

const LANE_BY_KEY = {
  d: 1,
  f: 2,
  j: 3,
  k: 4
};

const gridElement = document.querySelector("#measure-grid");

function focusEditor() {
  gridElement?.focus({ preventScroll: true });
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === "TEXTAREA" || target.tagName === "SELECT") return true;
  if (target.tagName === "INPUT") {
    // BPM欄は数字入力なので、D/F/J/Kのショートカットは使えるようにする。
    // 矢印キーは数値入力の編集を邪魔しないよう、別途キー処理側で無視する。
    return (target.type || "text").toLowerCase() !== "number";
  }
  return false;
}

export function initKeyboardEvents() {
  document.addEventListener("keydown", event => {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;

    const target = event.target;
    const editable = isEditableTarget(target);
    const key = String(event.key || "").toLowerCase();

    if (event.key === "ArrowLeft" || event.key === "ArrowRight" ||
        event.key === "ArrowUp" || event.key === "ArrowDown") {
      if (editable || target instanceof HTMLInputElement) return;
      event.preventDefault();

      if (event.key === "ArrowLeft") {
        moveCursor(-1);
        showStatus("配置位置を左へ移動しました。");
      } else if (event.key === "ArrowRight") {
        moveCursor(1);
        showStatus("配置位置を右へ移動しました。");
      } else if (event.key === "ArrowUp") {
        moveMeasure(-1);
        showStatus(`小節${state.currentMeasure}を編集中です。`);
      } else {
        moveMeasure(1);
        showStatus(`小節${state.currentMeasure}を編集中です。`);
      }
      focusEditor();
      return;
    }

    if (editable) return;
    const lane = LANE_BY_CODE[event.code] ?? LANE_BY_KEY[key];
    if (!lane || event.repeat) return;

    event.preventDefault();
    // BPM欄にフォーカスが残っている場合は、値を確定してから配置する。
    if (target instanceof HTMLInputElement && target.type === "number") {
      target.blur();
    }

    try {
      const changed = handleLaneKey(lane);
      const laneName = `レーン${lane}`;
      if (state.tool === "erase") {
        showStatus(changed
          ? `${laneName}のノーツを削除しました。`
          : `${laneName}の現在位置にノーツはありません。`);
      } else if (changed === "removed") {
        showStatus(`${laneName}の現在位置にあったノーツを取り除きました。`);
      } else {
        showStatus(`${laneName}に${state.tool === "hold" ? "長押し" : "タップ"}ノーツを配置しました。`);
      }
      focusEditor();
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "ノーツを配置できませんでした。", true);
    }
  }, true);
}
