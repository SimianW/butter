"""Run with: python3 -m unittest discover -s scripts -p 'test_*.py'."""
import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location("review_tier", ROOT / "scripts" / "review-tier.py")
review_tier = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(review_tier)
classify = review_tier.classify


# File lists of merged PRs #11-#16. `gh pr view --json files` stops at 100 files and lists a rename
# once, so these come from the merge commits instead (a superset of gh's lists).
# PR #11 (merge 37a2b45), from `git diff --name-only --no-renames 37a2b45^ 37a2b45`.
PR_11_FILES = """
.prettierignore
.prettierrc
CHANGELOG.md
PRIVACY.md
PRIVACY.zh-CN.md
README.md
README.zh-CN.md
design/icon/REGENERATING.md
design/icon/butter-icon-final-16.svg
design/icon/butter-icon-final.svg
design/icon/butter-source.png
design/icon/make_icons.py
design/icon/regenerate.mjs
docs/REPORT.md
docs/development.md
docs/how-it-works.md
docs/install.md
docs/layout-storage-data.md
docs/layout-storage-design.md
extension/butter-cv.js
extension/butter-main.js
extension/butter-nav-main.js
extension/butter-nav.js
extension/butter-settings.js
extension/butter-status.js
extension/butter.css
extension/config.js
extension/consent/layout-consent.js
extension/history/conversation-main.js
extension/icons/icon-128.png
extension/icons/icon-16.png
extension/icons/icon-32.png
extension/icons/icon-48.png
extension/manifest.json
extension/popup.css
extension/popup.html
extension/popup.js
extension/popup/fonts/Bagel-Fat-One-OFL.txt
extension/popup/fonts/Nunito-OFL.txt
extension/popup/fonts/SOURCES.md
extension/popup/fonts/bagel-wordmark.woff2
extension/popup/fonts/nunito-latin.woff2
extension/popup/model.js
extension/popup/popup.css
extension/popup/popup.html
extension/popup/popup.js
extension/rail/rail.js
extension/seek/anchor-main.js
extension/seek/core-main.js
extension/seek/layout-cache-main.js
extension/seek/layout-check-main.js
extension/seek/layout-codec.js
extension/seek/preview-main.js
extension/seek/seek-meta.js
extension/shared/config-main.js
extension/shared/settings.js
extension/shared/status.js
extension/storage/layout-bridge.js
extension/storage/layout-worker.js
extension/stream/containment.css
extension/stream/offscreen.js
extension/stream/throttle-main.js
lab/harness/jump-latency.mjs
lab/harness/jump-typing.mjs
lab/harness/jump-variants.py
lab/harness/nav-earlier.mjs
lab/harness/nav-takeovers.mjs
lab/harness/popup-live.mjs
lab/harness/popup-probes.mjs
lab/harness/popup-qa.mjs
notes/review.md
package-lock.json
package.json
test/butter-nav.test.mjs
test/display-lock.test.js
test/height-cache-dom.test.js
test/height-cache-model.test.js
test/helpers/layout-fixture.cjs
test/history-pagination.test.mjs
test/history-thumb-hold.test.mjs
test/layout-check.test.js
test/layout-consent.test.js
test/layout-fingerprint.test.js
test/layout-storage.test.js
test/layout-store.test.js
test/offscreen.test.js
test/older.test.mjs
test/popup-assets.test.mjs
test/popup-model.test.mjs
test/popup-startup.test.cjs
test/raf.test.mjs
test/rail.test.mjs
test/review-r2.test.js
test/seek-activation.test.js
test/seek-fallback.test.js
test/seek-landing.test.js
test/seek-settings.test.mjs
test/seek-ui.test.mjs
test/seek-write.test.mjs
test/status-session.test.mjs
test/status.test.mjs
test/stream-throttle.test.mjs
test/thumb-hold.test.mjs
""".split()

# PR #12 (merge c5e9af9), from `git diff --name-only --no-renames c5e9af9^ c5e9af9`.
PR_12_FILES = """
CHANGELOG.md
README.md
README.zh-CN.md
extension/manifest.json
extension/popup/popup.css
extension/popup/popup.js
lab/harness/popup-qa.mjs
""".split()

# PR #13 (merge 3774cca), from `git diff --name-only --no-renames 3774cca^ 3774cca`.
PR_13_FILES = """
.github/workflows/check.yml
AGENTS.md
CODING_STANDARDS.md
docs/development.md
lab/README.md
notes/runs/2026-11-01-prejump/data/archive.json
notes/runs/2026-11-01-prejump/data/comparison.json
notes/runs/2026-11-01-prejump/report.md
notes/runs/2026-11-01-rebase-c2ad6aab/data/archive.json
notes/runs/2026-11-01-rebase-c2ad6aab/data/mapping.tsv
notes/runs/2026-11-01-rebase-c2ad6aab/report.md
notes/runs/2026-11-01-scroll-diagnosis/data/archive.json
notes/runs/2026-11-01-scroll-diagnosis/data/summary.json
notes/runs/2026-11-01-scroll-diagnosis/report.md
notes/runs/2026-11-01-tail-trace/data/archive.json
notes/runs/2026-11-01-tail-trace/data/comparison.json
notes/runs/2026-11-01-tail-trace/report.md
notes/runs/2026-11-02-cache-v2/data/archive.json
notes/runs/2026-11-02-cache-v2/data/cache-status.json
notes/runs/2026-11-02-cache-v2/data/diagnosis-notes.md
notes/runs/2026-11-02-cache-v2/data/gate-diagnostic.json
notes/runs/2026-11-02-cache-v2/data/layout-compatibility.json
notes/runs/2026-11-02-cache-v2/data/streaming-table.md
notes/runs/2026-11-02-cache-v2/data/summary.json
notes/runs/2026-11-02-cache-v2/report.md
notes/runs/2026-11-02-fast-mount-opinion/data/archive.json
notes/runs/2026-11-02-fast-mount-opinion/data/control-warm-fast-r2-trace-audit.json
notes/runs/2026-11-02-fast-mount-opinion/data/expand-idle-trace-audit.json
notes/runs/2026-11-02-fast-mount-opinion/data/read-hook-warm-fast-r3-trace-audit.json
notes/runs/2026-11-02-fast-mount-opinion/report.md
notes/runs/2026-11-02-height-cache/data/archive.json
notes/runs/2026-11-02-height-cache/data/height-details.json
notes/runs/2026-11-02-height-cache/data/resize-cache.json
notes/runs/2026-11-02-height-cache/data/resize-prejump.json
notes/runs/2026-11-02-height-cache/data/summary.json
notes/runs/2026-11-02-height-cache/report.md
notes/runs/2026-11-02-idle-mount/data/EXCLUSIONS.md
notes/runs/2026-11-02-idle-mount/data/archive.json
notes/runs/2026-11-02-idle-mount/data/coverage.md
notes/runs/2026-11-02-idle-mount/data/drag-endpoints.json
notes/runs/2026-11-02-idle-mount/data/hidden-pruning.md
notes/runs/2026-11-02-idle-mount/data/mechanism-tests.json
notes/runs/2026-11-02-idle-mount/data/metric-definitions.md
notes/runs/2026-11-02-idle-mount/data/production-mechanism.md
notes/runs/2026-11-02-idle-mount/data/report-draft.md
notes/runs/2026-11-02-idle-mount/data/results.json
notes/runs/2026-11-02-idle-mount/data/retention-check.json
notes/runs/2026-11-02-idle-mount/data/screen-rejected.md
notes/runs/2026-11-02-idle-mount/data/summary.json
notes/runs/2026-11-02-idle-mount/data/tables.md
notes/runs/2026-11-02-idle-mount/report.md
notes/runs/2026-11-02-popup-shots/data/archive.json
notes/runs/2026-11-02-popup-shots/report.md
notes/runs/2026-11-02-remount/data/archive.json
notes/runs/2026-11-02-remount/data/cost-results.json
notes/runs/2026-11-02-remount/data/cost-table.md
notes/runs/2026-11-02-remount/data/drag-results.json
notes/runs/2026-11-02-remount/data/drag-table.md
notes/runs/2026-11-02-remount/data/mechanisms.md
notes/runs/2026-11-02-remount/data/metric-definitions.md
notes/runs/2026-11-02-remount/data/prototype-limitations.md
notes/runs/2026-11-02-remount/data/pruned-generic-stream.md
notes/runs/2026-11-02-remount/data/stream-results.json
notes/runs/2026-11-02-remount/data/stream-table.md
notes/runs/2026-11-02-remount/report.md
notes/runs/2026-11-02-retention/data/archive.json
notes/runs/2026-11-02-retention/data/cost-results.json
notes/runs/2026-11-02-retention/data/cost-table.md
notes/runs/2026-11-02-retention/data/drag-results.json
notes/runs/2026-11-02-retention/data/drag-table.md
notes/runs/2026-11-02-retention/data/geometry-table.md
notes/runs/2026-11-02-retention/data/methodology.md
notes/runs/2026-11-02-retention/data/stream-results.json
notes/runs/2026-11-02-retention/data/stream-table.md
notes/runs/2026-11-02-retention/data/strict-rejection.md
notes/runs/2026-11-02-retention/report.md
notes/runs/2026-11-02-review/data/archive.json
notes/runs/2026-11-02-review/data/benchmark-summary.json
notes/runs/2026-11-02-review/data/benchmark-table.md
notes/runs/2026-11-02-review/data/cache-summary.json
notes/runs/2026-11-02-review/data/review-notes.md
notes/runs/2026-11-02-review/report.md
notes/runs/2026-11-02-scrollbar/data/archive.json
notes/runs/2026-11-02-scrollbar/data/memory-all.json
notes/runs/2026-11-02-scrollbar/data/memory-control.json
notes/runs/2026-11-02-scrollbar/data/summary.json
notes/runs/2026-11-02-scrollbar/data/tables.md
notes/runs/2026-11-02-scrollbar/report.md
notes/runs/2026-11-02-second-opinion/data/archive.json
notes/runs/2026-11-02-second-opinion/report.md
notes/runs/2026-11-02-seek-preview/data/EXPERIMENT.md
notes/runs/2026-11-02-seek-preview/data/archive.json
notes/runs/2026-11-02-seek-preview/data/memory-best.json
notes/runs/2026-11-02-seek-preview/data/methods.md
notes/runs/2026-11-02-seek-preview/data/results.json
notes/runs/2026-11-02-seek-preview/report.md
notes/runs/2026-11-02-thumb-hold/data/archive.json
notes/runs/2026-11-02-thumb-hold/data/control-1-timeline.json
notes/runs/2026-11-02-thumb-hold/data/control-2-timeline.json
notes/runs/2026-11-02-thumb-hold/data/control-4-timeline.json
notes/runs/2026-11-02-thumb-hold/data/control-5-timeline.json
notes/runs/2026-11-02-thumb-hold/data/control-6-timeline.json
notes/runs/2026-11-02-thumb-hold/data/hold-1-timeline.json
notes/runs/2026-11-02-thumb-hold/data/hold-2-timeline.json
notes/runs/2026-11-02-thumb-hold/data/hold-3-timeline.json
notes/runs/2026-11-02-thumb-hold/data/hold-wheel-timeline.json
notes/runs/2026-11-02-thumb-hold/data/native-events.json
notes/runs/2026-11-02-thumb-hold/data/release-visual-shift.json
notes/runs/2026-11-02-thumb-hold/data/summary.json
notes/runs/2026-11-02-thumb-hold/report.md
notes/runs/2026-11-03-seek-cold/data/HYPOTHESES.md
notes/runs/2026-11-03-seek-cold/data/archive.json
notes/runs/2026-11-03-seek-cold/data/blank-preview-fix.md
notes/runs/2026-11-03-seek-cold/data/blank-preview-results.json
notes/runs/2026-11-03-seek-cold/data/clipping-check.json
notes/runs/2026-11-03-seek-cold/data/estimate-results.json
notes/runs/2026-11-03-seek-cold/data/results.json
notes/runs/2026-11-03-seek-cold/data/review-fix-r1-results.json
notes/runs/2026-11-03-seek-cold/data/review-fix-r1.md
notes/runs/2026-11-03-seek-cold/report.md
notes/runs/2026-11-03-seek-merge/data/archive.json
notes/runs/2026-11-03-seek-merge/data/lab-r2-summary.json
notes/runs/2026-11-03-seek-merge/data/lab-r2.md
notes/runs/2026-11-03-seek-merge/data/review-fix-r1.md
notes/runs/2026-11-03-seek-merge/data/review-fix-r1/attribution.md
notes/runs/2026-11-03-seek-merge/data/ui-comparison.json
notes/runs/2026-11-03-seek-merge/report.md
notes/runs/2026-11-03-seek-preview-v2/data/archive.json
notes/runs/2026-11-03-seek-preview-v2/data/pre-release-results.json
notes/runs/2026-11-03-seek-preview-v2/data/results.json
notes/runs/2026-11-03-seek-preview-v2/report.md
notes/runs/2026-11-03-seek-ui/data/archive.json
notes/runs/2026-11-03-seek-ui/data/perf-summary.json
notes/runs/2026-11-03-seek-ui/report.md
notes/runs/2026-11-03-visual-release-research/data/archive.json
notes/runs/2026-11-03-visual-release-research/report.md
notes/runs/2026-11-04-bench-lab2/data/archive.json
notes/runs/2026-11-04-bench-lab2/data/provenance.json
notes/runs/2026-11-04-bench-lab2/data/results.json
notes/runs/2026-11-04-bench-lab2/data/store-numbers.md
notes/runs/2026-11-04-bench-lab2/data/table.md
notes/runs/2026-11-04-bench-lab2/report.md
notes/runs/2026-11-04-capture-fix/data/archive.json
notes/runs/2026-11-04-capture-fix/data/per-run-metrics.csv
notes/runs/2026-11-04-capture-fix/data/results.json
notes/runs/2026-11-04-capture-fix/data/table.md
notes/runs/2026-11-04-capture-fix/report.md
notes/runs/2026-11-04-consent-card/data/archive.json
notes/runs/2026-11-04-consent-card/data/behavior.json
notes/runs/2026-11-04-consent-card/data/comparison.json
notes/runs/2026-11-04-consent-card/data/smoke-remaining.json
notes/runs/2026-11-04-consent-card/data/smoke.json
notes/runs/2026-11-04-consent-card/report.md
notes/runs/2026-11-04-drag-release/data/archive.json
notes/runs/2026-11-04-drag-release/data/run-timings.csv
notes/runs/2026-11-04-drag-release/report.md
notes/runs/2026-11-04-layout-storage/data/archive.json
notes/runs/2026-11-04-layout-storage/report.md
notes/runs/2026-11-04-math-box/data/archive.json
notes/runs/2026-11-04-math-box/data/drag-after-ats.json
notes/runs/2026-11-04-math-box/data/drag-after-fixture.json
notes/runs/2026-11-04-math-box/data/drag-before-ats.json
notes/runs/2026-11-04-math-box/data/stored-ats.json
notes/runs/2026-11-04-math-box/data/stored-ats2.json
notes/runs/2026-11-04-math-box/report.md
notes/runs/2026-11-04-partial-guard/data/archive.json
notes/runs/2026-11-04-partial-guard/data/probe-ats.json
notes/runs/2026-11-04-partial-guard/data/probe-fixture.json
notes/runs/2026-11-04-partial-guard/data/probe-outlook.json
notes/runs/2026-11-04-partial-guard/data/probe-psd.json
notes/runs/2026-11-04-partial-guard/report.md
notes/runs/2026-11-04-popup-build/data/archive.json
notes/runs/2026-11-04-popup-build/data/pixel-comparison.json
notes/runs/2026-11-04-popup-build/data/quick-geometry.json
notes/runs/2026-11-04-popup-build/report.md
notes/runs/2026-11-04-send-typing/data/archive.json
notes/runs/2026-11-04-send-typing/data/table.md
notes/runs/2026-11-04-send-typing/report.md
notes/runs/2026-11-04-store-final/data/archive.json
notes/runs/2026-11-04-store-final/data/numbers.json
notes/runs/2026-11-04-store-final/report.md
notes/runs/2026-11-04-stream-diag/data/archive.json
notes/runs/2026-11-04-stream-diag/data/arms.json
notes/runs/2026-11-04-stream-diag/data/completion-render.md
notes/runs/2026-11-04-stream-diag/data/main-table.md
notes/runs/2026-11-04-stream-diag/data/run-timings.csv
notes/runs/2026-11-04-stream-diag/data/script-table.md
notes/runs/2026-11-04-stream-diag/data/stream-render.md
notes/runs/2026-11-04-stream-diag/data/table.md
notes/runs/2026-11-04-stream-diag/report.md
notes/runs/2026-11-04-stream-fix/data/archive.json
notes/runs/2026-11-04-stream-fix/data/arms.json
notes/runs/2026-11-04-stream-fix/data/run-timings.csv
notes/runs/2026-11-04-stream-fix/data/table.md
notes/runs/2026-11-04-stream-fix/report.md
notes/runs/2026-11-04-thumb-fix/data/after-classic.json
notes/runs/2026-11-04-thumb-fix/data/after-overlay.json
notes/runs/2026-11-04-thumb-fix/data/archive.json
notes/runs/2026-11-04-thumb-fix/data/before-classic.json
notes/runs/2026-11-04-thumb-fix/data/before-overlay.json
notes/runs/2026-11-04-thumb-fix/report.md
notes/runs/2026-11-04-wheel-fix/data/archive.json
notes/runs/2026-11-04-wheel-fix/data/attempt2/results.json
notes/runs/2026-11-04-wheel-fix/data/attempt2/table.md
notes/runs/2026-11-04-wheel-fix/data/per-run-metrics.csv
notes/runs/2026-11-04-wheel-fix/data/results.json
notes/runs/2026-11-04-wheel-fix/data/table.md
notes/runs/2026-11-04-wheel-fix/report.md
notes/runs/2026-11-04-wheel-local/data/archive.json
notes/runs/2026-11-04-wheel-local/data/per-run-metrics.csv
notes/runs/2026-11-04-wheel-local/data/results.json
notes/runs/2026-11-04-wheel-local/data/runs-table.md
notes/runs/2026-11-04-wheel-local/data/table.md
notes/runs/2026-11-04-wheel-local/report.md
notes/runs/INVENTORY.md
notes/runs/README.md
scripts/check-version.py
scripts/package.py
scripts/test_package.py
""".split()

# PR #14 (merge 5e7cb0f), from `git diff --name-only --no-renames 5e7cb0f^ 5e7cb0f`.
PR_14_FILES = """
CHANGELOG.md
extension/_locales/en/messages.json
extension/_locales/zh_CN/messages.json
extension/manifest.json
notes/runs/2026-11-04-store-i18n/data/chromium-check.mjs
notes/runs/2026-11-04-store-i18n/data/chromium-output.txt
notes/runs/2026-11-04-store-i18n/data/chromium-results.json
notes/runs/2026-11-04-store-i18n/data/extensions-en-US.png
notes/runs/2026-11-04-store-i18n/data/extensions-zh-CN.png
notes/runs/2026-11-04-store-i18n/data/node-test.txt
notes/runs/2026-11-04-store-i18n/data/popup-en-US-chinese.png
notes/runs/2026-11-04-store-i18n/data/popup-en-US.png
notes/runs/2026-11-04-store-i18n/data/popup-zh-CN-chinese.png
notes/runs/2026-11-04-store-i18n/data/popup-zh-CN.png
notes/runs/2026-11-04-store-i18n/data/zip-contents.txt
notes/runs/2026-11-04-store-i18n/report.md
scripts/test_package.py
test/manifest-locales.test.mjs
""".split()

# PR #15 (merge 78d814f), from `git diff --name-only --no-renames 78d814f^ 78d814f`.
PR_15_FILES = """
README.md
README.zh-CN.md
docs/REPORT.md
docs/benchmarks.md
docs/development.md
docs/history-rail.md
docs/how-it-works.md
docs/install.md
docs/layout-storage-data.md
docs/layout-storage-design.md
docs/media/store/screenshot-2-1280x800.png
docs/media/store/screenshot-3-1280x800.png
docs/media/store/screenshot-5-1280x800.png
docs/oss-survey.md
lab/README.md
notes/review.md
notes/runs/2026-11-04-big-benchmark/data/archive.json
notes/runs/2026-11-04-big-benchmark/data/results.json
notes/runs/2026-11-04-big-benchmark/report.md
notes/runs/2026-11-04-big-benchmark/store-numbers.md
notes/runs/INVENTORY.md
notes/runs/README.md
results/README.md
""".split()

# PR #16 (merge e4a4eb5), from `git diff --name-only --no-renames e4a4eb5^ e4a4eb5`.
PR_16_FILES = """
CHANGELOG.md
README.md
README.zh-CN.md
design/icon/REGENERATING.md
design/icon/butter-icon-final-16.svg
design/icon/butter-icon-toolbar.svg
design/icon/regenerate.mjs
docs/benchmarks.md
extension/icons/icon-16.png
extension/icons/icon-32.png
extension/manifest.json
""".split()

MANIFEST_ALPHA_10 = {
    "manifest_version": 3,
    "name": "Butter for ChatGPT",
    "version": "0.1.0.10",
    "version_name": "0.1.0-alpha.10",
    "description": "Keeps long ChatGPT conversations smooth while answers stream, with a history rail to jump between questions.",
    "icons": {
        "16": "icons/icon-16.png",
        "32": "icons/icon-32.png",
        "48": "icons/icon-48.png",
        "128": "icons/icon-128.png"
    },
    "content_scripts": [
        {
            "matches": [
                "https://chatgpt.com/*"
            ],
            "css": [
                "butter.css"
            ],
            "js": [
                "butter-status.js",
                "butter-settings.js",
                "butter-nav.js",
                "butter-cv.js"
            ],
            "run_at": "document_start"
        },
        {
            "matches": [
                "https://chatgpt.com/*"
            ],
            "js": [
                "config.js",
                "butter-main.js",
                "butter-nav-main.js"
            ],
            "world": "MAIN",
            "run_at": "document_start"
        }
    ],
    "permissions": [
        "storage"
    ],
    "action": {
        "default_popup": "popup.html",
        "default_icon": {
            "16": "icons/icon-16.png",
            "32": "icons/icon-32.png"
        }
    }
}

MANIFEST_ALPHA_11 = {
    "manifest_version": 3,
    "name": "Butter for ChatGPT",
    "version": "0.1.0.11",
    "version_name": "0.1.0-alpha.11",
    "description": "Keeps long ChatGPT conversations smooth while answers stream, with a history rail to jump between questions.",
    "icons": {
        "16": "icons/icon-16.png",
        "32": "icons/icon-32.png",
        "48": "icons/icon-48.png",
        "128": "icons/icon-128.png"
    },
    "content_scripts": [
        {
            "matches": [
                "https://chatgpt.com/*"
            ],
            "css": [
                "stream/containment.css"
            ],
            "js": [
                "shared/status.js",
                "storage/layout-bridge.js",
                "shared/settings.js",
                "consent/layout-consent.js",
                "seek/seek-meta.js",
                "rail/rail.js",
                "stream/offscreen.js"
            ],
            "run_at": "document_start"
        },
        {
            "matches": [
                "https://chatgpt.com/*"
            ],
            "js": [
                "shared/config-main.js",
                "stream/throttle-main.js",
                "history/conversation-main.js",
                "seek/core-main.js",
                "seek/layout-check-main.js",
                "seek/anchor-main.js",
                "seek/layout-codec.js",
                "seek/layout-cache-main.js",
                "seek/preview-main.js"
            ],
            "world": "MAIN",
            "run_at": "document_start"
        }
    ],
    "permissions": [
        "storage",
        "unlimitedStorage"
    ],
    "action": {
        "default_popup": "popup/popup.html",
        "default_icon": {
            "16": "icons/icon-16.png",
            "32": "icons/icon-32.png"
        }
    },
    "background": {
        "service_worker": "storage/layout-worker.js"
    },
    "web_accessible_resources": [
        {
            "resources": [
                "popup/fonts/nunito-latin.woff2"
            ],
            "matches": [
                "https://chatgpt.com/*"
            ],
            "use_dynamic_url": True
        }
    ]
}


def with_keys(manifest, **changes):
    return {**manifest, **changes}


# Manifests before and after each PR's change (#11 is MANIFEST_ALPHA_10 -> MANIFEST_ALPHA_11).
MANIFEST_ALPHA_12 = with_keys(MANIFEST_ALPHA_11, version="0.1.0.12", version_name="0.1.0-alpha.12")
MANIFEST_LOCALIZED = with_keys(
    MANIFEST_ALPHA_12, name="__MSG_appName__", description="__MSG_appDesc__", default_locale="en"
)
MANIFEST_ALPHA_13 = with_keys(MANIFEST_LOCALIZED, version="0.1.0.13", version_name="0.1.0-alpha.13")


class MergedPullRequestTests(unittest.TestCase):
    def test_pr_11_storage_consent_stream_and_permissions_is_tier_2(self):
        tier, reasons = classify(PR_11_FILES, MANIFEST_ALPHA_10, MANIFEST_ALPHA_11)
        self.assertEqual(tier, 2)
        self.assertIn("extension/storage/layout-worker.js (high-risk directory)", reasons)
        self.assertIn("extension/consent/layout-consent.js (high-risk directory)", reasons)
        self.assertIn(
            "extension/manifest.json: background, content_scripts, permissions changed", reasons
        )

    def test_pr_12_popup_script_is_tier_2(self):
        tier, reasons = classify(PR_12_FILES, MANIFEST_ALPHA_11, MANIFEST_ALPHA_12)
        self.assertEqual(tier, 2)
        self.assertEqual(reasons, ["extension/popup/popup.js (storage or consent)"])

    def test_pr_13_workflow_and_ci_is_tier_1(self):
        tier, reasons = classify(PR_13_FILES, None, None)
        self.assertEqual(tier, 1)
        self.assertEqual(
            reasons,
            [
                ".github/workflows/check.yml",
                "scripts/check-version.py",
                "scripts/package.py",
                "scripts/test_package.py",
            ],
        )

    def test_pr_14_manifest_name_and_tests_is_tier_1(self):
        tier, reasons = classify(PR_14_FILES, MANIFEST_ALPHA_12, MANIFEST_LOCALIZED)
        self.assertEqual(tier, 1)
        self.assertEqual(
            reasons,
            [
                "extension/manifest.json: default_locale, description, name changed",
                "scripts/test_package.py",
                "test/manifest-locales.test.mjs",
            ],
        )

    def test_pr_15_docs_is_tier_0(self):
        self.assertEqual(classify(PR_15_FILES, None, None)[0], 0)

    def test_pr_16_icons_and_version_bump_is_tier_0(self):
        tier, reasons = classify(PR_16_FILES, MANIFEST_LOCALIZED, MANIFEST_ALPHA_13)
        self.assertEqual(tier, 0)
        self.assertIn("extension/manifest.json: only version, version_name changed", reasons)


class RuleTests(unittest.TestCase):
    def test_permission_change_is_tier_2(self):
        after = with_keys(MANIFEST_ALPHA_13, host_permissions=["https://example.com/*"])
        self.assertEqual(
            classify(["extension/manifest.json"], MANIFEST_ALPHA_13, after),
            (2, ["extension/manifest.json: host_permissions changed"]),
        )

    def test_version_only_manifest_change_is_tier_0(self):
        self.assertEqual(classify(["extension/manifest.json"], MANIFEST_LOCALIZED, MANIFEST_ALPHA_13)[0], 0)

    def test_markdown_inside_extension_is_tier_0(self):
        self.assertEqual(
            classify(["extension/popup/fonts/SOURCES.md"], None, None),
            (0, ["extension/popup/fonts/SOURCES.md (Markdown)"]),
        )

    def test_markdown_in_high_risk_directory_is_tier_2(self):
        self.assertEqual(classify(["extension/storage/NOTES.md"], None, None)[0], 2)

    def test_storage_and_consent_files_outside_high_risk_dirs_are_tier_2(self):
        for path in ("extension/shared/settings.js", "extension/shared/status.js", "extension/popup/popup.js"):
            with self.subTest(path=path):
                self.assertEqual(classify([path], None, None), (2, [f"{path} (storage or consent)"]))

    def test_other_popup_and_shared_files_are_tier_1(self):
        self.assertEqual(classify(["extension/popup/popup.css", "extension/shared/config-main.js"], None, None)[0], 1)

    def test_other_extension_code_is_tier_1(self):
        self.assertEqual(classify(["extension/rail/rail.js", "README.md"], None, None), (1, ["extension/rail/rail.js"]))

    def test_empty_change_is_an_error(self):
        with self.assertRaises(ValueError):
            classify([], None, None)


class CommandTests(unittest.TestCase):
    """Run the script against a throwaway repository."""

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.git("init", "-q", "-b", "main")
        (self.root / "README.md").write_text("Butter\n", encoding="utf-8")
        self.git("add", ".")
        self.git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "base")

    def git(self, *args):
        subprocess.run(["git", *args], cwd=self.root, check=True, capture_output=True)

    def run_script(self, *args):
        return subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "review-tier.py"), *args],
            capture_output=True,
            text=True,
            cwd=self.root,
        )

    def test_untracked_script_is_tier_1(self):
        (self.root / "scripts").mkdir()
        (self.root / "scripts" / "new.py").write_text("print()\n", encoding="utf-8")
        result = self.run_script("main")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "Review tier: 1\nscripts/new.py\n")

    def test_empty_diff_fails(self):
        result = self.run_script("main")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("no changes", result.stderr)

    def test_bad_ref_fails(self):
        result = self.run_script("no-such-ref")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("no-such-ref", result.stderr)


if __name__ == "__main__":
    unittest.main()
