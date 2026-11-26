# Final veil acceptance stage L, stored layouts (#177)

Three `math12` runs in lab 2 with `0.1.0-alpha.22+veilaccept.veil3` (`aed9523`).
Each run seeded the layout store, reopened the chat and sampled with
`TRIGGER=1`. Each had 24 samples during reload, 150 during the scroll pass,
and one at the end.

| Load | Rows stored before reload | Samples (since first restore) | Restored turns / blocks | Most answer blocks at opacity 0 | Samples with a restored block marked at opacity 1 | Restore calls outside trigger | Rows after put-back |
|---|---:|---:|---:|---:|---:|---:|---:|
| [veil3-math12-scroll-1](veil3-math12-scroll-1.log) | 3 | 175 (144) | 8 / 8 | 0 | 0 | 0 | 0 |
| [veil3-math12-scroll-2](veil3-math12-scroll-2.log) | 3 | 175 (144) | 8 / 8 | 0 | 0 | 0 | 0 |
| [veil3-math12-scroll-3](veil3-math12-scroll-3.log) | 6 | 175 (144) | 8 / 8 | 0 | 0 | 0 | 0 |

- **Rule 1 — PASS for the sampled opacity check.** Zero answer blocks
  computed opacity 0 in all 525 samples, including 432 samples at or after
  the first counted restore. The restore counter recorded 8 turns and 8
  blocks on each reload. The persistence layer read the 3, 3 and 6 stored
  rows and reported 0 hits. The disk-backed restore case therefore remains
  unverified by this run sequence.
- **Rule 2 — PASS.** Before the first load and after the last,
  `butter` was `{"defaultsVersion":2}` with no stored `opts` or layout
  consent, `butterLayoutCleared` was absent, and the layout store had 0 rows.
  Full settings equality and row counts passed after every run and every
  setup attempt. No manual storage repair was needed.

All three runs read back `bookmark=true`, `layout=true`, `older=true`,
`rail=true` and `seek=true`, with `layoutConsent="granted"`. The sampled
`<html>` had no `data-butter-off` or `data-butter-disabled` on the seed
load or after reload. The seed load recorded 0 restore calls without the
trigger in all three runs. The reload samples recorded 0 calls outside
the harness-triggered reads, consistent with #183.

No restored block carried `data-butter-veil` at opacity 1 in any sample
(0 block observations). Each fixture run exited 0 with four `PASS`
verdicts and `SUMMARY PASS (0 FAIL)`.

## Script and run sequence

The [Stage L copy](stored-layout-check.mjs) adds `older: true` and
`seek: true` to the D3 settings write for #181 and adjusts the imports
for the extra directory level. Its added diagnostics read settings back
from storage, report the sampled page flags, count restored blocks with a
veil marker at opacity 1, and compare restore counters around the explicit
trigger. It preserves absent storage keys as absent and saves the exact
baseline with the private captures.

Chromium reordered the option keys on readback. The initial
order-sensitive comparison rejected three setup attempts before fixture
navigation. All exited 2 and passed storage put-back. The corrected
script uses value equality independent of key order and prints
`SUMMARY ERROR` for setup errors. The corrected driver stops on those
errors.

Six harness invocations used the six-invocation budget, including the
three setup attempts and three completed fixture runs. The completed
fixture runs took 139, 138 and 139 seconds. The lab and perf locks were
held for 8 min 13 s (21:22:48–21:31:01 UTC). The successful acquire waited
39 min 53 s. An earlier acquire was cancelled after 2 min 13 s when the
two distinct fixtures named `math12` were identified. The retry selected
account 2 to use the original fixture. `lab-restore` and lock release
both exited 0.

[Commands and outputs](commands.md) · [Sequence log](sequence.log) ·
[Lab restore](restore.log)
