import { state, addNote, removeNote, setCursorStep } from "./state.js";

// クリックはノーツを置かず、配置する位置（縦ライン）だけを移動する。
export function handleGridClick(_lane, clickedStep) {
  setCursorStep(clickedStep);
}

// D/F/J/K のキーに対応するレーンへ、カーソル位置でノーツを配置する。
export function handleLaneKey(lane) {
  if (state.tool === "erase") {
    return removeNote(lane, state.cursorStep);
  }
  return addNote(lane, state.cursorStep, state.tool);
}
