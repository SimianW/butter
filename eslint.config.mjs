// Only two rules: undefined names and unused names. Formatting is Prettier's job.
import globals from 'globals';

const rules = {
  'no-undef': 'error',
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
};

export default [
  { ignores: ['lab/', 'node_modules/', 'dist/', 'design/', 'notes/'] },
  {
    files: ['extension/**/*.js'],
    ignores: [
      'extension/storage/layout-worker.js',
      'extension/branch/worker.js',
      'extension/dev/worker.js',
    ],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser, chrome: 'readonly' },
    },
    rules,
  },
  // The service worker gets worker globals instead of window globals.
  {
    files: [
      'extension/storage/layout-worker.js',
      'extension/branch/worker.js',
      'extension/dev/worker.js',
    ],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.serviceworker, chrome: 'readonly' },
    },
    rules,
  },

  // Content scripts, popup and worker are classic scripts: a later script reads a global that an
  // earlier one (in manifest.json, popup.html or importScripts order) defines.
  {
    files: [
      'extension/storage/layout-bridge.js',
      'extension/shared/settings.js',
      'extension/consent/layout-consent.js',
      'extension/popup/popup.js',
      'extension/storage/layout-worker.js',
    ],
    languageOptions: { globals: { ButterStatus: 'readonly' } }, // defined in shared/status.js
  },
  {
    files: ['extension/rail/rail.js'],
    languageOptions: { globals: { ButterSeekMeta: 'readonly' } }, // defined in seek/seek-meta.js
  },
  {
    files: ['extension/popup/popup.js'],
    languageOptions: { globals: { ButterPopup: 'readonly' } }, // defined in popup/model.js
  },
  {
    files: ['extension/seek/anchor-main.js', 'extension/seek/layout-cache-main.js'],
    languageOptions: { globals: { __butterLayoutCheck: 'readonly' } }, // defined in seek/layout-check-main.js
  },
  {
    files: ['extension/seek/layout-cache-main.js', 'extension/storage/layout-worker.js'],
    languageOptions: { globals: { ButterLayoutCodec: 'readonly' } }, // defined in seek/layout-codec.js
  },
  {
    // Ask in branch: classic scripts in manifest order (logic, run, page, ui, content).
    files: ['extension/branch/*.js'],
    ignores: ['extension/branch/logic.js'],
    languageOptions: {
      globals: {
        ButterBranch: 'readonly',
        ButterBranchRun: 'readonly',
        ButterBranchPage: 'readonly', // page.js
        ButterBranchUI: 'readonly', // ui.js
      },
    },
  },
  {
    files: ['extension/branch/run.js'],
    languageOptions: { globals: { require: 'readonly' } }, // falls back to logic.js under node
  },
  {
    // Dev build only (extension/dev/, left out of the store package).
    files: ['extension/dev/recorder-main.js', 'extension/dev/worker.js', 'extension/dev/toast.js'],
    languageOptions: {
      globals: { ButterDevRecorder: 'readonly', ButterStatus: 'readonly' }, // dev/recorder.js, shared/status.js
    },
  },
  // Files that also export themselves for node --test, behind a `typeof module` check.
  {
    files: [
      'extension/popup/model.js',
      'extension/shared/status.js',
      'extension/seek/seek-meta.js',
      'extension/seek/layout-codec.js',
      'extension/seek/layout-check-main.js',
      'extension/seek/core-main.js',
      'extension/branch/logic.js',
      'extension/branch/run.js',
      'extension/dev/recorder.js',
    ],
    languageOptions: { globals: { module: 'readonly' } },
  },

  {
    files: ['test/**/*.{js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node } },
    rules,
  },
];
