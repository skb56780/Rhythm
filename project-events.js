import { state, replaceChart } from "../state.js";
import { validateChart } from "../validator.js";
import { saveProject, loadProject } from "../storage.js";
import { getAudioForSave, restoreAudioBlob, clearAudio } from "../audio.js";
import { showStatus } from "../editor.js";

export function initProjectEvents() {
  document.querySelector("#save-project-button").addEventListener("click", async () => {
    try {
      const errors = validateChart({ bpm: state.bpm, notes: state.notes, audioOffsetMs: state.audioOffsetMs });
      if (errors.length) throw new Error(errors.join("\n"));
      const audioData = getAudioForSave();
      await saveProject({
        bpm: state.bpm,
        notes: state.notes,
        audioOffsetMs: state.audioOffsetMs,
        audioBlob: audioData.blob,
        audioName: audioData.name
      });
      showStatus("譜面と音源をこのブラウザに保存しました。");
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "保存できませんでした。", true);
    }
  });

  document.querySelector("#load-project-button").addEventListener("click", async () => {
    try {
      const project = await loadProject();
      if (!project) {
        showStatus("保存されたプロジェクトがありません。先に保存してください。", true);
        return;
      }
      const errors = validateChart({ bpm: project.bpm, notes: project.notes, audioOffsetMs: project.audioOffsetMs ?? 0 });
      if (errors.length) throw new Error(errors.join("\n"));
      replaceChart({ bpm: project.bpm, notes: project.notes, audioOffsetMs: project.audioOffsetMs ?? 0 });
      document.querySelector("#audio-offset-input").value = String(project.audioOffsetMs ?? 0);
      if (project.audioBlob) await restoreAudioBlob(project.audioBlob, project.audioName || "保存済み音源");
      else clearAudio();
      showStatus("保存した譜面と音源を読み込みました。");
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "読み込めませんでした。", true);
    }
  });

  document.querySelector("#validate-button").addEventListener("click", () => {
    const errors = validateChart({ bpm: state.bpm, notes: state.notes, audioOffsetMs: state.audioOffsetMs });
    if (errors.length) {
      showStatus(`譜面に ${errors.length} 件の問題があります。\n${errors.slice(0, 3).join(" / ")}`, true);
    } else {
      showStatus(`譜面チェックOK！${state.notes.length}個のノーツに問題はありません。`);
    }
  });
}

export async function restoreAutosavedProject() {
  try {
    const project = await loadProject();
    if (!project) return false;
    const errors = validateChart({ bpm: project.bpm, notes: project.notes, audioOffsetMs: project.audioOffsetMs ?? 0 });
    if (errors.length) return false;
    replaceChart({ bpm: project.bpm, notes: project.notes, audioOffsetMs: project.audioOffsetMs ?? 0 });
    document.querySelector("#audio-offset-input").value = String(project.audioOffsetMs ?? 0);
    if (project.audioBlob) await restoreAudioBlob(project.audioBlob, project.audioName || "保存済み音源");
    else clearAudio();
    showStatus("前回保存したプロジェクトを復元しました。");
    return true;
  } catch (error) {
    showStatus(`前回の保存データを復元できませんでした: ${error.message}`, true);
    return false;
  }
}
