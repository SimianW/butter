# Mac confirmation of the held-scrollbar preview fixes

2026-11-07. Build: `0.1.0-alpha.13+unseen-notice.9` (code identical to `12dd1fc`), tested by the
user on their macOS machine, in normal use. Released afterwards as `0.1.0-alpha.14` with no
extension code change. No lab, capture or chat content is recorded here.

## Result

The user reports no problems. With this build they have essentially stopped seeing the
"Only the start of this answer can be previewed" notice on answers they have read. When the
notice does appear, reading that answer and then dragging the scrollbar again shows the full
preview, which is the designed behavior for an answer that has not been opened.

## What this does and does not establish

- Confirms the symptom from
  [press-time-unseen](../2026-11-06-press-time-unseen/report.md) and
  [math-pending-long-answer](../2026-11-06-math-pending-long-answer/report.md) no longer
  shows up in the user's normal use on the affected Mac.
- Does **not** identify which of the reproduced causes (startup scan, `math-pending` geometry
  reuse, skipped never-measured blocks) applied on that Mac. No readiness or press-decision
  JSON was collected for this check.
- If the notice appears again on an answer that was already read, collect
  `notes/diagnostics/capture-record-readiness.js` and `capture-press-decision.js` output.
