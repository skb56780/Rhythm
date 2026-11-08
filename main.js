import { renderEditor, showStatus } from "./editor.js";
import { initButtonEvents } from "./events/button-events.js";
import { initKeyboardEvents } from "./events/keyboard-events.js";
import { initAudioEvents } from "./audio.js";
import { initProjectEvents, restoreAutosavedProject } from "./events/project-events.js";

// 状態が変わったら画面を描き直す。
document.addEventListener("rhythm:statechange", renderEditor);

// 各機能のイベントを登録する。
initButtonEvents();
initKeyboardEvents();
initAudioEvents();
initProjectEvents();
renderEditor();

// IndexedDBに保存されているプロジェクトがあれば復元する。
restoreAutosavedProject().catch(error => {
  showStatus(`保存データの復元に失敗しました: ${error.message}`, true);
});
