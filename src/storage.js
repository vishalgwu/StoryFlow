import { validateSession, restoreSession } from './session.js';

export function openStorage() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('storyflow', 1);
    let expired = false;
    const timeout = setTimeout(() => { expired = true; reject(new Error('Browser storage did not open. Retry after closing other tabs.')); }, 5000);
    request.onupgradeneeded = () => request.result.createObjectStore('projects');
    request.onerror = () => { clearTimeout(timeout); reject(request.error || new Error('Could not open browser storage.')); };
    request.onblocked = () => { clearTimeout(timeout); expired = true; reject(new Error('Storage upgrade blocked. Close other StoryFlow tabs.')); };
    request.onsuccess = () => {
      clearTimeout(timeout);
      if (expired) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

export function saveSession(db, session) {
  const safe = validateSession(session);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readwrite');
    tx.objectStore('projects').put(safe, 'active');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Save transaction failed.'));
    tx.onabort = () => reject(tx.error || new Error('Save aborted.'));
  });
}

export function loadSession(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects');
    const request = tx.objectStore('projects').get('active');
    let result;
    request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => {
      try { resolve(result === undefined ? null : restoreSession(result)); }
      catch (error) { reject(error); }
    };
    tx.onerror = () => reject(tx.error || request.error || new Error('Restore transaction failed.'));
    tx.onabort = () => reject(tx.error || new Error('Restore aborted.'));
  });
}
