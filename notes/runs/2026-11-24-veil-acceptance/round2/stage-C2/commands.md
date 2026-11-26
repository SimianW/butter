# Commands: veil acceptance round 2, stage C2 (#177), 2026-11-26

Run from the worktree of branch `veil/177-r2-stage-c2`, based on `feat/implement-spec-170` at `552b8db`. The
harness is this checkout's `lab/harness`. `B` is `~/.local/share/chatgpt-lab/bin`. `C` is
`~/.local/share/chatgpt-lab/captures/veil-accept/round2/stage-C2` (raw logs and per-run JSON, kept local). `D`
is `~/snap/chromium/common/veil-accept`. Times are UTC.

## Harness change (commit `27dbd96`, before the lock)

`lab/harness/stream-ux-probe.mjs`:

- **`U2_DELAY=<ms>`** sets the time from completion to the u2 write. It defaults to 2000, as before, and must
  be a whole number from 0 to 14000 (`u2DelayMs`).
- **Web-font loads.** The probe now records each `document.fonts` `loadingdone` (time and families) and each
  font file's resource timing, from a `PerformanceObserver` installed with the probe. Times are in ms after
  completion, and only file names are kept (`fontRows`). They print as `REPORT ux … fonts` and are stored as
  `summary.ux.fonts`.

Both helpers have a case in `test/stream-replay-helpers.test.mjs`, and `lab/README.md` names the setting.

```sh
node --test test/stream-replay-helpers.test.mjs   # tests 10, pass 10, fail 0
npm run check                                      # exit=0; node tests 987 pass 0 fail; python 174 OK; version OK
```

## Builds

```sh
for n in head veil2; do grep version_name $D/$n/butter/manifest.json; node --check $D/$n/butter/stream/offscreen.js && echo "$n check ok"; grep -c prelayout $D/$n/butter/stream/offscreen.js; done
for p in head:547fa0a veil2:552b8db; do n=${p%%:*}; s=${p#*:}; T=$(mktemp -d); git archive $s extension | tar -x -C $T; echo "== $n vs $s"; diff -rq $T/extension $D/$n/butter; rm -rf $T; done
```
```text
  "version_name": "0.1.0-alpha.22+veilaccept.head",
head check ok
0
  "version_name": "0.1.0-alpha.22+veilaccept.veil2",
veil2 check ok
4
== head vs 547fa0a
Files /tmp/.../extension/manifest.json and ~/snap/chromium/common/veil-accept/head/butter/manifest.json differ
== veil2 vs 552b8db
Files /tmp/.../extension/manifest.json and ~/snap/chromium/common/veil-accept/veil2/butter/manifest.json differ
```

The only difference from each commit is the `version_name` suffix in `manifest.json`. veil2's
`stream/offscreen.js` contains `prelayout` (4 lines), and head's does not.

## Lock, runs, restore and release (one script, one lock)

The driver (`/tmp/va177r2c2/seq.sh`, kept local) is round 1's C2 driver with these changes:

- owner `veil-accept-r2-C2`;
- build `veil2` in place of `veil`;
- a `run` function that passes extra environment to the harness;
- after the 6 interleaved runs, up to 2 veil2 runs `veil2-ats12-u2late-<i>` with a later u2 write.

Its budget guards are unchanged: no new run after 1500 s of the budget clock, after 10 runs, or after a
`FAIL no-escape` or `FAIL server-unchanged`. Restore and release run from an exit trap.

The late runs' delay was first written as `U2_DELAY=8000`. After run 4, `veil2-ats12-u2-2` showed KaTeX font
loads at up to +8.24 s after completion (see summary). That suggested pre-layout might still be running at
+8 s, so the delay was raised to `U2_DELAY=12000` before the late runs started. The edit rewrote the
still-unread part of the script in place, on the same inode, and left the header comment saying 8000. Both
late runs ran with 12000: their `u2` acts are at +12025.0 and +12030.2 ms.

```sh
LAB=$($B/lab-lock acquire --lab auto --needs-fixture ats12 --owner veil-accept-r2-C2 --wait 3600 --perf)
# for i in 1 2 3, for BUILD in head veil2; then for i in 1 2: BUILD=veil2, NAME=veil2-ats12-u2late-<i>, U2_DELAY=12000
env LAB_ID=$LAB LAB_OWNER=veil-accept-r2-C2 EXT=$D/<build>/butter LABEL=<name> FIXTURE=ats12 OUT=$C/<name>.json \
  PHASES=stream UX=u2 U2_BLOCK=306 'OPTS={"rail":true,"bookmark":true}' [U2_DELAY=12000] \
  node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log 2>&1
# trap on exit:
$B/lab-restore --lab $LAB --owner veil-accept-r2-C2
$B/lab-lock release --lab $LAB --owner veil-accept-r2-C2
$B/lab-lock status
```
```text
acquire start 2026-11-26T00:17:14Z
lab=2 exit=0 at 2026-11-26T00:34:31Z          # waited 17 min behind veil-accept-r2-D
```

| # | Name | Build | Exit | Took | Budget clock at end |
|---:|---|---|---:|---:|---:|
| 1 | `head-ats12-u2-1` | head | 0 | 199 s | 199 s |
| 2 | `veil2-ats12-u2-1` | veil2 | 0 | 205 s | 404 s |
| 3 | `head-ats12-u2-2` | head | 0 | 204 s | 608 s |
| 4 | `veil2-ats12-u2-2` | veil2 | 0 | 199 s | 807 s |
| 5 | `head-ats12-u2-3` | head | 0 | 199 s | 1006 s |
| 6 | `veil2-ats12-u2-3` | veil2 | 0 | 198 s | 1204 s |
| 7 | `veil2-ats12-u2late-1` | veil2, `U2_DELAY=12000` | 0 | 198 s | 1402 s |
| 8 | `veil2-ats12-u2late-2` | veil2, `U2_DELAY=12000` | 0 | 204 s | 1606 s |

```text
restore exit=0 (restarted the browser without extensions; "ok":true)   # 01:01:17Z
{"lab": 2, "lab_released": true, "perf_released": true}
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-26T01:01:28Z since-lock=1617s
```

The sequence made 8 harness runs in 26 min 57 s from lock to release.

## Per-run numbers (`u2.jsonl`)

The extractor is round 1's `u2` extractor (`/tmp/va177r2c2/u2.mjs`, kept local), unchanged in what it
computed then. On round 1's `veil-ats12-u2-1.json` it gives the same 230.2 ms, 246.8 ms and render parts
67.6 / 25.4 as round 1's `u2.jsonl`. It gained two fields:

- **`fonts`:** `summary.ux.fonts` as recorded.
- **`prelayout`:** two things:
  - long-animation-frame scripts after completion from a `butter:` source or an idle callback (`idleOrOffscreen`, `butterAfter`);
  - the distinct scrollTop and scrollHeight values, and the long frames, from +900 ms after completion to the write (`before`).

```js
// added to /tmp/va177r2c2/u2.mjs, a copy of round 1's extractor (printed in ../../stage-C2/commands.md)
const pre = (s, u, mid, C) => {
  const g = u.goneAfterEnter, fr = (s.lafDetail?.frames ?? []).filter(f => f.s >= g);
  const rows = [];
  for (const f of fr) for (const x of f.scripts) if (x.src.includes('offscreen') || /idle/i.test(`${x.invokerType} ${x.invoker}`)) rows.push({ at: r1(f.s - g), frame: f.d, b: f.b, d: x.d, forced: x.forced, src: x.src, inv: `${x.invokerType}:${x.invoker}` });
  const butterAfter = fr.flatMap(f => f.scripts.filter(x => x.src.startsWith('butter:')).map(x => ({ at: r1(f.s - g), frame: f.d, d: x.d, src: x.src, inv: `${x.invokerType}:${x.invoker}` })));
  const w = C.filter(f => f[0] >= 900 && f[0] < mid.rt);
  const ys = [...new Set(w.map(f => f[1]))], hs = [...new Set(w.map(f => f[2]))];
  const laf = fr.filter(f => f.s - g >= 900 && f.s - g < mid.rt);
  return { idleOrOffscreen: rows, butterAfter, before: { frames: w.length, scrollTops: ys.slice(0, 5), scrollHeights: hs.slice(0, 5), laf: laf.map(f => `${r1(f.s - g)}:${f.d}/${f.b}b`) } };
};
// and in the output line: fonts: u.fonts ?? null, prelayout: pre(s, u, mid, C)
```
```sh
node /tmp/va177r2c2/u2.mjs $C/{head,veil2}-ats12-u2-{1,2,3}.json $C/veil2-ats12-u2late-{1,2}.json > u2.jsonl
```

## Logs

Each `<name>.log` is that run's full harness output plus the driver's exit and time line. `restore.log` and
`release.log` are as printed. In the logs, the ChatGPT project URL was replaced by `<home-url>` and the home
folder by `~`. `u2.jsonl` holds only these fields:

- block indexes, px, ms and flags;
- script source labels;
- KaTeX font family and file names, which are public assets.

A scan of the committed files for `chatgpt.com`, `/home/` and email addresses found none after those
replacements.
