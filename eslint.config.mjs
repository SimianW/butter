// Undefined names, unused names and file length (max-lines, counting blank lines and comments).
// Formatting is Prettier's job.
import globals from 'globals';

export const maxLines = 500;

// Raising a cap needs the reason in the PR body; prefer splitting the file along a seam.
export const maxLinesCaps = {
  'extension/bookmarks/content.js': 566,
  'extension/dev/recorder.js': 574,
  'extension/rail/rail.js': 1520,
  'extension/seek/core-main.js': 570,
  'extension/seek/layout-cache-main.js': 1349,
  'extension/seek/preview-main.js': 1546,
  'lab/harness/dev-capture-qa.mjs': 802,
  'lab/harness/popup-qa.mjs': 548,
  'test/bookmark-notice.test.js': 537,
  'test/branch-run.test.js': 509,
  'test/dev-sources.test.js': 519,
  'test/height-cache-dom.test.js': 1463,
  'test/layout-storage.test.js': 565,
  'test/rail.test.mjs': 647,
  'test/seek-landing.test.js': 917,
};

const rules = {
  'no-undef': 'error',
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
};

export default [
  // lab/harness/ is linted for file length only.
  { ignores: ['lab/*', '!lab/harness/', 'node_modules/', 'dist/', 'design/', 'notes/'] },
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
      'extension/bookmarks/notice.js',
      'extension/popup/popup.js',
      'extension/storage/layout-worker.js',
    ],
    languageOptions: { globals: { ButterStatus: 'readonly' } }, // defined in shared/status.js
  },
  {
    files: ['extension/consent/layout-consent.js', 'extension/bookmarks/notice.js'],
    languageOptions: { globals: { ButterCard: 'readonly' } }, // defined in consent/card.js
  },
  {
    files: ['extension/rail/rail.js'],
    languageOptions: { globals: { ButterRailModel: 'readonly' } }, // defined in rail/model.js
  },
  {
    // The rail model falls back to their dependencies under node.
    files: ['extension/rail/model.js'],
    languageOptions: { globals: { require: 'readonly' } },
  },
  {
    files: ['extension/bookmarks/content.js'],
    languageOptions: {
      globals: {
        ButterBookmarks: 'readonly', // defined in bookmarks/model.js
        ButterWash: 'readonly', // defined in bookmarks/wash.js
      },
    },
  },
  {
    files: ['extension/bookmarks/content.js'],
    languageOptions: {
      globals: {
        ButterBookmarkStore: 'readonly', // defined in bookmarks/client.js
        ButterBookmarkSession: 'readonly', // defined in bookmarks/session.js
      },
    },
  },
  {
    files: ['extension/bookmarks/session.js'],
    languageOptions: { globals: { require: 'readonly' } }, // falls back to model.js under node
  },
  {
    files: ['extension/bookmarks/content.js', 'extension/branch/content.js'],
    languageOptions: { globals: { ButterPill: 'readonly' } }, // defined in selection/pill.js
  },
  {
    files: ['extension/bookmarks/content.js', 'extension/branch/*.js'],
    languageOptions: { globals: { ButterPageReader: 'readonly' } }, // defined in page/reader.js
  },
  {
    // Loaded by storage/layout-worker.js, which defines the database, its requests and the queue.
    files: ['extension/bookmarks/worker.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        ButterBookmarks: 'readonly',
        database: 'readonly',
        request: 'readonly',
        serial: 'readonly',
      },
    },
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
    files: ['extension/dev/sources.js'],
    languageOptions: { globals: { require: 'readonly' } }, // falls back to recorder.js under node
  },
  {
    // Dev build only (extension/dev/, left out of the store package).
    files: ['extension/dev/recorder-main.js', 'extension/dev/worker.js', 'extension/dev/toast.js'],
    languageOptions: {
      globals: {
        ButterDevRecorder: 'readonly', // dev/recorder.js
        ButterDevSources: 'readonly', // dev/sources.js
        ButterStatus: 'readonly', // shared/status.js
      },
    },
  },
  {
    // The store worker's queue and message handler, which dev/worker.js imports.
    files: ['extension/dev/worker.js'],
    languageOptions: { globals: { serial: 'readonly', handle: 'readonly' } },
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
      'extension/bookmarks/model.js',
      'extension/bookmarks/wash.js',
      'extension/bookmarks/session.js',
      'extension/rail/conversations.js',
      'extension/rail/wave.js',
      'extension/rail/model.js',
      'extension/page/reader.js',
      'extension/page/reader-main.js',
      'extension/dev/recorder.js',
      'extension/dev/sources.js',
    ],
    languageOptions: { globals: { module: 'readonly' } },
  },

  {
    files: ['test/**/*.{js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node } },
    rules,
  },
  // Every linted file stays at or under maxLines, except the capped files, which may only shrink.
  { files: ['**/*.{js,mjs,cjs}'], rules: { 'max-lines': ['error', { max: maxLines }] } },
  ...Object.entries(maxLinesCaps).map(([file, max]) => ({
    files: [file],
    rules: { 'max-lines': ['error', { max }] },
  })),
];
