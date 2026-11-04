# Coverage and deliberate pruning

Detailed numeric metrics are in tables.md and results.json. “Shared” means the source and behavior before streaming are identical to the retained transition arm; it is not an extra independent sample. “Pruned” is unmeasured, not zero. The absolutely seamless target fails before those cells.

| Arm | Background task/LoAF/full-growth time | Key/scroll during growth | Full fast + slow drag/frame/LoAF/blank | Stream/block/key/start/end | Send + rail | Memory/switch/gates | Disposition |
|---|---|---|---|---|---|---|---|
| Released control | no background growth | 3 typing/scroll probes | 3 fast, 3 slow | 3 full replays | 3 each | GC drag samples; switch unchanged native behavior | control |
| Ordinary one-turn growth | 1 full cold screen | pruned | pruned | pruned | pruned | 1 paired GC | task gate failure |
| Transition one-turn growth + shrink | 3 controlled cold runs, 3 real idle scheduler runs | 3 typing/scroll probes | 3 fast, 3 slow after full retention | 3 full replays | 3 each | paired GC, lifecycle/cap/setting/chat switch | best diagnostic, not seamless |
| Provisional turn/block staging v1 | stopped measured prefix | pruned | pruned | pruned | pruned | final geometry/memory pruned | task and LoAF failure |
| Provisional turn/block staging v2 | stopped measured prefix | pruned | pruned | pruned | pruned | measured prefix geometry only | task and LoAF failure |
| Transition + remembered geometry | warmed screen; repeat only if task gate passed | pruned on failure | pruned on failure | pruned on failure | pruned on failure | paired GC in screen | content-width/cold coverage limitations inherited |
| Transition + deferred initial ref | warmed screen; repeat only if task gate passed | pruned on failure | pruned on failure | pruned on failure | pruned on failure | paired GC in screen | private-source deferral, not automatically safe |
| Full retention + CV hidden streaming | shared | shared | shared pre-stream drag | 1 full replay; remaining repeats pruned after 7.6-fold blocking | pruned | state/hidden/controller audited | severe streaming failure |
| Full retention + display-none contents streaming | shared | shared | shared pre-stream drag | screen, repeat only if surviving | pruned on failure | retained state and height arrays audited | see final results |
| Full retention + hold-time CV visible | shared | shared | 1 warmed fast screen; slow pruned after 983 ms activation/release frame | pruned | pruned | stable full-history geometry | zero blankness does not imply smoothness |
| Incomplete growth | setup two extra turns | pruned | 1 calibrated fast screen; slow pruned after 2.98 s frame | pruned | pruned | actual starting mounted count saved | unmounted destination still stalls |

The old state-only hidden screen, initial uncalibrated controls, startup failure, and deliberate process cancellations are listed in EXCLUSIONS.md. No failed precondition is silently pooled into a surviving arm.
