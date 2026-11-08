const DATABASE_NAME = "rhythm-maker-db";
const DATABASE_VERSION = 1;
const STORE_NAME = "projects";
const PROJECT_KEY = "current-project";

function openDatabase() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("このブラウザはIndexedDBに対応していません。"));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("保存データベースを開けませんでした。"));
  });
}

export async function saveProject(project) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({
      id: PROJECT_KEY,
      bpm: project.bpm,
      notes: project.notes.map(note => ({ ...note })),
      audioOffsetMs: project.audioOffsetMs ?? 0,
      audioBlob: project.audioBlob ?? null,
      audioName: project.audioName ?? "",
      savedAt: new Date().toISOString()
    });
    transaction.oncomplete = () => { database.close(); resolve(true); };
    transaction.onerror = () => { database.close(); reject(transaction.error || new Error("プロジェクトを保存できませんでした。")); };
    transaction.onabort = () => { database.close(); reject(transaction.error || new Error("保存が中止されました。")); };
  });
}

export async function loadProject() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(PROJECT_KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error || new Error("保存データを読み込めませんでした。"));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => { database.close(); reject(transaction.error || new Error("保存データを読み込めませんでした。")); };
  });
}
