// ISOLATED world. Only compact geometry and hashes cross into extension storage.
(() => {
  let enabled = false,
    settingsVersion = 0;
  const emit = (detail) =>
    document.dispatchEvent(
      new CustomEvent('butter-layout-response', { detail: JSON.stringify(detail) }),
    );
  const announce = () => emit({ state: true, enabled });
  document.addEventListener('butter-layout-request', async (e) => {
    let m;
    try {
      m = JSON.parse(e.detail);
    } catch {
      return;
    }
    if (m.op === 'state') {
      announce();
      return;
    }
    if (!enabled || !['load', 'put'].includes(m.op)) {
      emit({ id: m.id, records: [] });
      return;
    }
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'butter-layout-' + m.op,
        account: m.account,
        conv: m.conv,
        generation: m.generation,
        records: m.records,
      });
      emit({ id: m.id, ...result });
    } catch {
      emit({ id: m.id, error: 'layout-storage' });
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.butter) {
      settingsVersion++;
      enabled = changes.butter.newValue?.opts?.layout !== false;
      announce();
    }
    if (changes.butterLayoutCleared) emit({ cleared: true });
  });
  chrome.storage.local
    .get(['butter', 'butterLayoutMigrated'])
    .then(({ butter, butterLayoutMigrated }) => {
      if (!settingsVersion) enabled = butter?.opts?.layout !== false;
      announce();
      if (butterLayoutMigrated) return;
      // Delete, never open/read the trial site's database. A blocked delete is retried next visit.
      const r = indexedDB.deleteDatabase('butter-seek-cold-geometry-v1');
      r.onsuccess = () => chrome.storage.local.set({ butterLayoutMigrated: true });
    });
})();
