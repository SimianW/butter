// ISOLATED world. Only compact geometry and hashes cross into extension storage.
(() => {
  let enabled = false,
    settingsVersion = 0,
    consent = 'pending',
    migrationReady = false,
    migrated = false;
  const emit = (detail) =>
    document.dispatchEvent(
      new CustomEvent('butter-layout-response', { detail: JSON.stringify(detail) }),
    );
  const announce = () => emit({ state: true, enabled });
  const migrate = () => {
    if (!migrationReady || migrated || consent === 'pending') return;
    migrated = true;
    // Delete, never read/import the legacy cache, after the consent choice. A blocked delete
    // is retried on a subsequent visit.
    const r = indexedDB.deleteDatabase('butter-seek-cold-geometry-v1');
    r.onsuccess = () => chrome.storage.local.set({ butterLayoutMigrated: true });
  };
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
    const request = {
      version: 1,
      type: 'butter-layout-' + m.op,
      account: m.account,
      conv: m.conv,
      generation: m.generation,
      records: m.records,
    };
    // A terminated worker closes the port. Re-sending wakes it; all disk operations are atomic
    // and idempotent (puts use stable keys and timestamps). No MAIN-thread await at drag time.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await chrome.runtime.sendMessage(request);
        if (!result || result.error === 'layout-storage') throw Error('layout-storage');
        emit({ id: m.id, ...result });
        return;
      } catch {}
    }
    emit({ id: m.id, error: 'layout-storage' });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.butter) {
      settingsVersion++;
      const settings = ButterStatus.normalize(changes.butter.newValue);
      enabled = settings.opts.layout;
      consent = settings.layoutConsent;
      announce();
      migrate();
    }
    if (changes.butterLayoutCleared) emit({ cleared: true });
  });
  chrome.storage.local
    .get(['butter', 'butterLayoutMigrated'])
    .then(({ butter, butterLayoutMigrated }) => {
      if (!settingsVersion) {
        const settings = ButterStatus.normalize(butter);
        enabled = settings.opts.layout;
        consent = settings.layoutConsent;
      }
      announce();
      migrationReady = true;
      migrated = !!butterLayoutMigrated;
      migrate();
    });
})();
