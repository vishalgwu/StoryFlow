import { validateProject } from './domain.js';

export function openStorage() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('storyflow', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects');
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Storage upgrade blocked. Close other StoryFlow tabs.'));
    request.onsuccess = () => resolve(request.result);
  });
}

export function saveProject(db, project) {
  const safe = validateProject(project);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readwrite');
    tx.objectStore('projects').put(safe, 'active');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Save aborted.'));
  });
}

export function loadProject(db) {
  return new Promise((resolve, reject) => {
    const request = db.transaction('projects').objectStore('projects').get('active');
    request.onsuccess = () => {
      try { resolve(request.result ? validateProject(request.result) : null); }
      catch (error) { reject(error); }
    };
    request.onerror = () => reject(request.error);
  });
}
