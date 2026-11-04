> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Butter stream regression: alpha.9 vs latest (6e83623), diagnosis

Date 2026-11-04. Lab2 only, under the lab2 and perf locks. Same harness as `(not archived)`, copied to `harness/`. Same 189-chunk local SSE replay, frozen sidebar list and `math-nine` fixture. The harness's fetch guards and route denial of write methods were on. Every run's final answer hash was `043dc8af…` and no conversation write reached the network. No 429 or usage notice appeared.

## Method

- **Runs:** one stream run per phase. Each phase loads a fresh browser with only the arm's extension (verified via `chrome://version`). Arms are interleaved, and each arm uses its own unpacked path, so it gets its own extension ID and storage. After each phase: clear the extension's storage, restart lab2 with no extension, `lab-restore` it, run the restore check, release the locks.
- **Settings arms:** settings were turned off through the popup's `chrome.storage`, as the harness does. The observed `data-butter-off` was `seek`, `layout` and `rail` respectively. On every other arm it was absent.
- **Traces:** every run captured a CDP trace with `devtools.timeline` and `v8.execute`, without the V8 CPU profiler. With the profiler, blocked time read 16.9 s instead of 13.2 s, so it was dropped. The light trace reproduces last night's untraced latest: 13.1 s blocked vs 12.9 s, longest freeze 1348 ms vs 1321 ms, frame p95 50 ms, completion task 1162 ms vs 1141 ms. alpha9 reproduces too: 8.3 s vs 8.0 s, 693 ms vs 698 ms, 33 ms, 574 ms vs 578 ms. Typing p95 reads about 30–40 ms higher than last night in every arm, so compare it only within this table.
- **Trace windows:** stream is replay start to `message_stream_complete` − 50 ms. Completion is the 5 s after that, anchored as in the benchmark on `performance.mark` events emitted by the replay.
- **Extension JS:** the outermost `FunctionCall` whose URL is `chrome-extension://`, including any style or layout it forces. Observer kind comes from the function name (MutationObserver) or the source line of the callback (`new ResizeObserver`).
- **Statistics:** median [min–max], n. n = 3 for the first 12 arms, n = 2 for the bisect and fix arms, n = 5 for latest. Ranges are tight throughout.

## Arms

| Arm | What |
|---|---|
| `alpha9` | `git archive v0.1.0-alpha.9`; byte-identical to the benchmark build (file index `15fc9231…`) |
| `alpha10` | `afbb1e3`, where `version_name` became `0.1.0-alpha.10`; differs from alpha.9 only by `overflow-clip-margin` |
| `head-prev` | `2bc372f` |
| `latest` | `6e83623`; identical to the benchmark zip except `version_name`, which was copied in |
| `latest-seek-off` / `-layout-off` / `-rail-off` | latest with `opts.seek` / `opts.layout` / `opts.rail` = false |
| `latest-offscreen-old` | latest with `stream/offscreen.js` from `2bc372f` |
| `latest-unrendered-skip`, `fix2-unrendered` | candidate suspect-1 fix that sets `data-butter-unrendered` **at completion** (v1: blocks in the `skipped` set; v2: every unmarked block) |
| `fix4-unrendered` | suspect-1 fix that sets `data-butter-unrendered` **during the stream**, at the 1 s flush, on blocks still skipped. The completion branch no longer calls `rendered()`. CSS: `[data-markdown-text-style="assistant-message"] > [data-butter-unrendered]:not([data-wide-block]) { content-visibility: auto }` |
| `latest-cache-mo-defer` | the layout cache's MutationObserver skips a turn while it is `in_progress` |
| `latest-cache-defer` | the same, and idle `work()` also waits while any turn is `in_progress` |
| `fix4` | `fix4-unrendered` + `latest-cache-defer` |
| `fix5` | `fix4` + the layout cache's observer split into `{childList, subtree}` and an attribute-only observer, with no `characterData` |
| `bis-*` | latest with whole scripts removed from the manifest: `noseek` (all `seek/*`), `nocache` (`seek/layout-cache-main.js` only), `nohistory`, `noconsent` (consent card and layout bridge) |
| `lc-*` | latest with one hook removed from `layout-cache-main.js`: `noblockro`, `noro` (no turn, row or block ResizeObserver targets), `nocvevent`, `noclientwidth`, `nochardata`, `mo-childlist`, `nomainmo` (main MutationObserver detached, so no turn is ever watched) |

All lab-only builds are under `builds/`. The repo was not edited.

## Results (median [min–max], n)

| Arm | Blocked (s) | Longest freeze (ms) | Frame p95 (ms) | Completion longest task (ms) | Typing p95 (ms) | Blocked in completion window (s) | Ext JS, stream (ms) | Ext MO callbacks, stream (ms) | Ext RO callbacks, stream (ms) | Ext idle callbacks, stream (ms) |
|---|---|---|---|---|---|---|---|---|---|---|
| `alpha9` | 8.3 [8.3–8.4] n=3 | 693 [692–708] n=3 | 33.4 [33.4–33.4] n=3 | 574 [570–591] n=3 | 222 [222–226] n=3 | 0.6 [0.6–0.7] n=3 | 136 [134–137] n=3 | 17.5 [17.2–17.9] n=3 | 13.2 [13.2–14.2] n=3 | 0.0 [0.0–0.0] n=3 |
| `alpha10` | 8.4 [8.2–8.7] n=3 | 705 [703–733] n=3 | 33.4 [33.3–33.4] n=3 | 585 [578–614] n=3 | 226 [222–237] n=3 | 0.7 [0.7–0.7] n=3 | 133 [132–137] n=3 | 17.3 [17.0–17.8] n=3 | 14.3 [13.0–14.4] n=3 | 0.0 [0.0–0.0] n=3 |
| `head-prev` | 13.2 [12.9–13.3] n=3 | 1124 [1123–1137] n=3 | 50.0 [50.0–50.0] n=3 | 626 [608–648] n=3 | 254 [254–260] n=3 | 0.8 [0.7–0.8] n=3 | 4677 [4640–4702] n=3 | 1050 [1045–1076] n=3 | 18.5 [17.9–20.0] n=3 | 0.0 [0.0–0.0] n=3 |
| `latest` | 13.1 [12.4–13.4] n=5 | 1348 [1328–1370] n=5 | 50.0 [49.9–50.0] n=5 | 1162 [1148–1179] n=5 | 253 [249–264] n=5 | 1.3 [1.3–1.3] n=5 | 2115 [2098–2136] n=5 | 1062 [1055–1088] n=5 | 25.2 [24.6–57.1] n=5 | 866 [859–872] n=5 |
| `latest-seek-off` | 13.4 [13.3–13.4] n=3 | 1341 [1337–1397] n=3 | 50.0 [50.0–50.0] n=3 | 1155 [1154–1216] n=3 | 252 [243–259] n=3 | 1.3 [1.3–1.4] n=3 | 2135 [2134–2137] n=3 | 1081 [1078–1090] n=3 | 25.6 [24.9–26.1] n=3 | 871 [863–877] n=3 |
| `latest-layout-off` | 13.3 [13.3–13.5] n=3 | 1356 [1347–1391] n=3 | 50.0 [50.0–50.0] n=3 | 1170 [1162–1204] n=3 | 251 [247–254] n=3 | 1.3 [1.3–1.4] n=3 | 2112 [2099–2136] n=3 | 1060 [1058–1089] n=3 | 25.3 [25.2–26.4] n=3 | 861 [846–885] n=3 |
| `latest-rail-off` | 13.1 [12.9–13.5] n=3 | 1349 [1344–1530] n=3 | 50.0 [50.0–50.0] n=3 | 1169 [1162–1344] n=3 | 242 [242–261] n=3 | 1.3 [1.3–1.5] n=3 | 2048 [2022–2096] n=3 | 1043 [1020–1076] n=3 | 25.8 [25.0–26.3] n=3 | 866 [863–885] n=3 |
| `latest-offscreen-old` | 12.7 [11.3–12.9] n=3 | 748 [743–760] n=3 | 49.9 [49.9–50.0] n=3 | 617 [616–618] n=3 | 242 [242–246] n=3 | 0.7 [0.7–0.7] n=3 | 2123 [2088–2137] n=3 | 1074 [1025–1098] n=3 | 26.6 [24.6–26.7] n=3 | 860 [850–950] n=3 |
| `latest-unrendered-skip` | 13.2 [13.2–13.3] n=3 | 1343 [1330–1400] n=3 | 50.0 [49.9–50.0] n=3 | 1193 [1176–1253] n=3 | 256 [243–259] n=3 | 1.3 [1.3–1.4] n=3 | 2109 [2082–2111] n=3 | 1056 [1037–1075] n=3 | 25.5 [24.2–26.5] n=3 | 865 [853–874] n=3 |
| `fix2-unrendered` | 13.1 [12.5–13.8] n=2 | 1435 [1384–1486] n=2 | 50.0 [50.0–50.0] n=2 | 1285 [1242–1328] n=2 | 262 [257–267] n=2 | 1.4 [1.3–1.4] n=2 | 2144 [2117–2171] n=2 | 1090 [1066–1114] n=2 | 34.0 [24.6–43.4] n=2 | 870 [866–873] n=2 |
| `fix4-unrendered` | 12.3 [11.6–12.9] n=2 | 762 [729–796] n=2 | 49.9 [49.9–49.9] n=2 | 632 [600–664] n=2 | 268 [253–283] n=2 | 0.7 [0.7–0.7] n=2 | 2120 [2079–2161] n=2 | 1073 [1050–1096] n=2 | 25.4 [25.0–25.8] n=2 | 869 [850–888] n=2 |
| `latest-cache-mo-defer` | 12.0 [11.6–12.3] n=3 | 1345 [1332–1404] n=3 | 49.9 [49.9–50.0] n=3 | 1164 [1141–1215] n=3 | 245 [235–291] n=3 | 1.3 [1.3–1.4] n=3 | 1060 [1054–1075] n=3 | 61.9 [59.3–68.6] n=3 | 28.9 [28.4–29.0] n=3 | 816 [808–832] n=3 |
| `latest-cache-defer` | 12.0 [11.8–12.2] n=3 | 1347 [1334–1386] n=3 | 49.9 [49.9–50.0] n=3 | 1160 [1147–1190] n=3 | 253 [241–280] n=3 | 1.3 [1.3–1.3] n=3 | 890 [883–926] n=3 | 62.3 [60.7–62.8] n=3 | 25.2 [25.1–27.5] n=3 | 648 [640–681] n=3 |
| `fix4` | 11.8 [11.6–11.9] n=2 | 736 [736–736] n=2 | 50.0 [49.9–50.0] n=2 | 590 [587–594] n=2 | 252 [249–256] n=2 | 0.7 [0.7–0.7] n=2 | 898 [894–902] n=2 | 62.0 [60.7–63.2] n=2 | 24.5 [23.8–25.2] n=2 | 652 [645–659] n=2 |
| `fix5` | 11.0 [10.8–11.2] n=2 | 742 [742–743] n=2 | 49.9 [49.9–49.9] n=2 | 608 [607–609] n=2 | 254 [250–257] n=2 | 0.7 [0.7–0.7] n=2 | 905 [883–927] n=2 | 18.2 [17.4–19.0] n=2 | 23.9 [22.7–25.1] n=2 | 665 [641–689] n=2 |
| `bis-noseek` | 9.0 [8.9–9.1] n=2 | 1328 [1297–1359] n=2 | 33.3 [33.3–33.4] n=2 | 1150 [1121–1178] n=2 | 223 [223–223] n=2 | 1.3 [1.3–1.4] n=2 | 151 [148–154] n=2 | 18.1 [17.9–18.3] n=2 | 14.3 [13.6–14.9] n=2 | 0.0 [0.0–0.0] n=2 |
| `bis-nocache` | 8.2 [7.9–8.5] n=2 | 1302 [1291–1313] n=2 | 33.3 [33.3–33.3] n=2 | 1122 [1114–1131] n=2 | 226 [223–229] n=2 | 1.3 [1.3–1.3] n=2 | 167 [167–168] n=2 | 17.8 [17.6–18.1] n=2 | 13.5 [13.5–13.5] n=2 | 0.0 [0.0–0.0] n=2 |
| `bis-nohistory` | 13.2 [13.1–13.2] n=2 | 1346 [1335–1357] n=2 | 50.0 [50.0–50.0] n=2 | 1166 [1157–1175] n=2 | 247 [243–252] n=2 | 1.3 [1.3–1.3] n=2 | 2105 [2084–2126] n=2 | 1066 [1057–1075] n=2 | 25.8 [24.8–26.7] n=2 | 854 [842–866] n=2 |
| `bis-noconsent` | 13.1 [12.9–13.3] n=2 | 1354 [1345–1364] n=2 | 50.0 [49.9–50.0] n=2 | 1170 [1162–1179] n=2 | 254 [246–261] n=2 | 1.3 [1.3–1.3] n=2 | 2089 [2073–2106] n=2 | 1046 [1030–1062] n=2 | 25.1 [25.0–25.2] n=2 | 865 [862–867] n=2 |
| `lc-noblockro` | 13.0 [12.9–13.1] n=2 | 1322 [1317–1328] n=2 | 50.0 [49.9–50.0] n=2 | 1144 [1138–1149] n=2 | 242 [240–243] n=2 | 1.3 [1.3–1.3] n=2 | 3513 [3477–3548] n=2 | 1065 [1065–1065] n=2 | 21.9 [21.9–22.0] n=2 | 2273 [2236–2309] n=2 |
| `lc-noro` | 12.9 [12.7–13.1] n=2 | 1366 [1337–1396] n=2 | 50.0 [49.9–50.0] n=2 | 1183 [1153–1213] n=2 | 241 [240–242] n=2 | 1.3 [1.3–1.4] n=2 | 3426 [3391–3462] n=2 | 1038 [1035–1042] n=2 | 19.4 [12.5–26.3] n=2 | 2216 [2169–2262] n=2 |
| `lc-nocvevent` | 16.5 [15.9–17.1] n=2 | 1397 [1390–1404] n=2 | 50.0 [50.0–50.1] n=2 | 1202 [1199–1205] n=2 | 276 [276–277] n=2 | 1.4 [1.4–1.4] n=2 | 2393 [2349–2436] n=2 | 1055 [1045–1066] n=2 | 49.1 [25.3–72.9] n=2 | 1155 [1148–1161] n=2 |
| `lc-noclientwidth` | 13.1 [12.6–13.6] n=2 | 1450 [1352–1548] n=2 | 50.0 [49.9–50.0] n=2 | 1260 [1169–1351] n=2 | 253 [246–259] n=2 | 1.4 [1.3–1.5] n=2 | 2143 [2136–2150] n=2 | 1085 [1075–1094] n=2 | 33.6 [24.3–42.9] n=2 | 870 [863–878] n=2 |
| `lc-nochardata` | 13.2 [13.1–13.2] n=2 | 1460 [1381–1540] n=2 | 50.0 [50.0–50.0] n=2 | 1271 [1189–1353] n=2 | 254 [252–256] n=2 | 1.4 [1.4–1.5] n=2 | 2038 [2031–2045] n=2 | 1010 [1000–1020] n=2 | 25.2 [24.7–25.7] n=2 | 849 [847–852] n=2 |
| `lc-mo-childlist` | 12.9 [12.7–13.1] n=2 | 1434 [1344–1524] n=2 | 50.0 [50.0–50.0] n=2 | 1244 [1154–1333] n=2 | 247 [243–250] n=2 | 1.4 [1.3–1.5] n=2 | 2108 [2052–2163] n=2 | 18.4 [18.2–18.6] n=2 | 31.3 [25.0–37.5] n=2 | 861 [849–872] n=2 |
| `lc-nomainmo` | 9.0 [9.0–9.1] n=2 | 1344 [1329–1360] n=2 | 33.3 [33.3–33.4] n=2 | 1158 [1144–1172] n=2 | 224 [218–229] n=2 | 1.3 [1.3–1.3] n=2 | 193 [186–199] n=2 | 18.2 [17.9–18.5] n=2 | 23.4 [14.0–32.8] n=2 | 0.0 [0.0–0.0] n=2 |

### Rendering in the stream window (trace)

| Arm | Style (ms) | Layout (ms) | PrePaint+Paint+Layerize (ms) | IO computeIntersections (ms) | Main-thread tasks (ms) | Ext forced style+layout (ms) |
|---|---|---|---|---|---|---|
| `alpha9` | 15257 [15249–15299] n=3 | 3660 [3629–3670] n=3 | 7642 [7595–7689] n=3 | 13189 [13151–13313] n=3 | 60132 [59951–60626] n=3 | 0.8 [0.0–0.8] n=3 |
| `alpha10` | 15561 [15356–15675] n=3 | 3682 [3671–3888] n=3 | 7569 [7543–7722] n=3 | 13371 [13220–13389] n=3 | 60326 [59834–61032] n=3 | 0.7 [0.0–0.8] n=3 |
| `head-prev` | 18482 [18399–18788] n=3 | 3901 [3755–3924] n=3 | 7314 [7285–7349] n=3 | 13624 [13619–13703] n=3 | 68690 [68644–68937] n=3 | 1555 [1524–1617] n=3 |
| `latest` | 18232 [17967–18403] n=5 | 3844 [3677–4171] n=5 | 7279 [7206–7390] n=5 | 13739 [13711–14039] n=5 | 67059 [66478–67728] n=5 | 594 [588–598] n=5 |
| `latest-rail-off` | 17983 [17980–18320] n=3 | 3899 [3802–3939] n=3 | 5085 [5060–5101] n=3 | 13098 [13073–13099] n=3 | 63661 [63579–63734] n=3 | 594 [587–600] n=3 |
| `latest-offscreen-old` | 18081 [17950–18559] n=3 | 4009 [3760–4046] n=3 | 7339 [7249–7356] n=3 | 13998 [13849–14145] n=3 | 67273 [65573–67672] n=3 | 591 [582–687] n=3 |
| `latest-cache-defer` | 18105 [17862–18293] n=3 | 3799 [3760–3812] n=3 | 7216 [7152–7321] n=3 | 14037 [13893–14187] n=3 | 65663 [65363–65672] n=3 | 582 [576–616] n=3 |
| `fix4` | 18235 [18143–18327] n=2 | 3895 [3827–3962] n=2 | 7366 [7341–7391] n=2 | 13905 [13870–13940] n=2 | 66277 [66258–66296] n=2 | 586 [579–594] n=2 |
| `fix5` | 18187 [17997–18376] n=2 | 3778 [3610–3946] n=2 | 7352 [7274–7430] n=2 | 13297 [12795–13800] n=2 | 65817 [65812–65822] n=2 | 600 [577–624] n=2 |
| `bis-nocache` | 15025 [14933–15117] n=2 | 3686 [3617–3756] n=2 | 7461 [7421–7501] n=2 | 13444 [13264–13625] n=2 | 59171 [58507–59836] n=2 | 0.4 [0.0–0.8] n=2 |
| `lc-nomainmo` | 15020 [14895–15145] n=2 | 3611 [3515–3707] n=2 | 7394 [7352–7436] n=2 | 13586 [13292–13880] n=2 | 60247 [59989–60505] n=2 | 0.4 [0.0–0.8] n=2 |
| `lc-mo-childlist` | 17990 [17807–18173] n=2 | 3993 [3929–4057] n=2 | 7292 [7264–7321] n=2 | 13715 [13689–13742] n=2 | 66539 [66304–66774] n=2 | 593 [591–595] n=2 |

### Rendering in the completion window (trace)

| Arm | Style (ms) | Layout (ms) | PrePaint+Paint+Layerize (ms) | Ext JS (ms) | Main-thread tasks (ms) |
|---|---|---|---|---|---|
| `alpha9` | 156 [155–156] n=3 | 230 [221–236] n=3 | 37.1 [34.6–39.8] n=3 | 3.2 [2.9–3.5] n=3 | 1144 [1143–1184] n=3 |
| `alpha10` | 160 [157–162] n=3 | 240 [229–249] n=3 | 44.6 [29.4–116] n=3 | 3.4 [3.0–4.3] n=3 | 1194 [1139–1326] n=3 |
| `head-prev` | 188 [180–196] n=3 | 244 [231–258] n=3 | 38.1 [36.9–80.1] n=3 | 84.4 [82.9–113] n=3 | 1464 [1412–1539] n=3 |
| `latest` | 211 [208–215] n=5 | 776 [753–827] n=5 | 80.2 [74.8–212] n=5 | 75.1 [72.6–95.8] n=5 | 1974 [1928–2226] n=5 |
| `latest-rail-off` | 212 [210–214] n=3 | 780 [774–920] n=3 | 75.5 [74.9–82.8] n=3 | 73.3 [72.8–73.8] n=3 | 1952 [1947–2195] n=3 |
| `latest-offscreen-old` | 177 [177–190] n=3 | 239 [224–247] n=3 | 38.7 [37.6–43.5] n=3 | 79.2 [71.8–89.5] n=3 | 1415 [1411–1423] n=3 |
| `latest-cache-defer` | 213 [212–217] n=3 | 782 [778–819] n=3 | 110 [81.2–161] n=3 | 76.8 [76.1–77.2] n=3 | 2005 [1978–2179] n=3 |
| `fix4` | 179 [179–180] n=2 | 234 [219–249] n=2 | 77.1 [34.0–120] n=2 | 63.9 [58.8–68.9] n=2 | 1460 [1364–1556] n=2 |
| `fix5` | 178 [177–178] n=2 | 231 [227–235] n=2 | 37.1 [34.6–39.5] n=2 | 63.5 [63.4–63.5] n=2 | 1500 [1441–1560] n=2 |
| `bis-nocache` | 193 [191–195] n=2 | 782 [774–790] n=2 | 93.5 [82.8–104] n=2 | 6.5 [6.3–6.7] n=2 | 1757 [1756–1757] n=2 |
| `lc-nomainmo` | 193 [192–193] n=2 | 798 [797–798] n=2 | 87.7 [84.6–90.7] n=2 | 8.0 [7.4–8.5] n=2 | 1795 [1776–1814] n=2 |
| `lc-mo-childlist` | 214 [210–218] n=2 | 834 [772–897] n=2 | 82.2 [80.5–83.9] n=2 | 78.9 [76.9–80.8] n=2 | 2075 [1968–2182] n=2 |

### Extension JS by script, stream window (ms)

| Script (stream window, ms) | `alpha9` | `head-prev` | `latest` | `latest-cache-defer` | `fix5` |
|---|---|---|---|---|---|
| butter-cv.js | 36.0 [35.2–36.6] n=3 | 0.0 [0.0–0.0] n=3 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=3 | 0.0 [0.0–0.0] n=2 |
| butter-main.js | 35.4 [34.9–40.5] n=3 | 0.0 [0.0–0.0] n=3 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=3 | 0.0 [0.0–0.0] n=2 |
| butter-nav-main.js | 0.1 [0.1–0.1] n=3 | 0.0 [0.0–0.0] n=3 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=3 | 0.0 [0.0–0.0] n=2 |
| butter-nav.js | 62.1 [60.5–65.5] n=3 | 0.0 [0.0–0.0] n=3 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=3 | 0.0 [0.0–0.0] n=2 |
| history/conversation-main.js | 0.0 [0.0–0.0] n=3 | 0.1 [0.1–0.1] n=3 | 0.1 [0.1–0.1] n=5 | 0.1 [0.1–0.1] n=3 | 0.1 [0.1–0.1] n=2 |
| rail/rail.js | 0.0 [0.0–0.0] n=3 | 60.0 [60.0–61.2] n=3 | 58.8 [57.3–62.4] n=5 | 59.8 [56.9–60.5] n=3 | 58.6 [57.2–60.0] n=2 |
| seek/layout-cache-main.js | 0.0 [0.0–0.0] n=3 | 4530 [4495–4559] n=3 | 1950 [1936–1963] n=5 | 725 [717–760] n=3 | 739 [717–761] n=2 |
| seek/preview-main.js | 0.0 [0.0–0.0] n=3 | 15.0 [13.8–16.2] n=3 | 16.4 [13.8–16.8] n=5 | 15.8 [14.7–16.3] n=3 | 15.3 [15.1–15.6] n=2 |
| stream/offscreen.js | 0.0 [0.0–0.0] n=3 | 33.9 [33.6–35.6] n=3 | 54.6 [54.4–68.8] n=5 | 55.7 [54.8–57.6] n=3 | 56.4 [54.9–57.9] n=2 |
| stream/throttle-main.js | 0.0 [0.0–0.0] n=3 | 35.4 [33.9–36.2] n=3 | 35.4 [34.4–39.7] n=5 | 34.6 [34.0–34.9] n=3 | 35.9 [35.7–36.0] n=2 |

### Top extension functions, stream window


| Function (script:function:line, kind) | stream ms median | completion ms median |
|---|---|---|
| `seek/layout-cache-main.js:MutationObserver.observe.childList:878|MutationObserver` | 1044 | 18 |
| `seek/layout-cache-main.js:work:621|idle` | 866 | 49 |
| `rail/rail.js:step:723|rAF` | 43 | 0 |
| `seek/layout-cache-main.js:(anon):511|event` | 21 | 1 |
| `stream/offscreen.js:(anon):42|event` | 21 | 1 |
| `stream/throttle-main.js:run:67|rAF` | 18 | 0 |
| `stream/offscreen.js:MutationObserver.observe.childList:66|MutationObserver` | 18 | 3 |
| `seek/preview-main.js:(anon):757|timer` | 13 | 0 |
| `stream/offscreen.js:(anon):45|ResizeObserver` | 13 | 1 |
| `seek/layout-cache-main.js:(anon):845|ResizeObserver` | 12 | 0 |


alpha9 for comparison: rail `step` 46 ms, `butter-cv.js` MutationObserver 18 ms, throttle `run` 18 ms, `butter-cv.js` ResizeObserver 13 ms. Total extension JS: 136 ms.

## Where alpha9 → latest's +4.8 s comes from

Blocked time is 8.3 s → 13.1 s (+4.8 s; the benchmark measured +4.9 s). It splits cleanly into two causes:

**1. Completion, +0.7 s blocked (0.6 → 1.3 s in the completion window); longest task 574 → 1162 ms.** Cause: the `6e83623` change to `stream/offscreen.js`.
- With `offscreen.js` from `2bc372f`, everything else as latest: completion longest task 617 ms, completion layout 239 ms, longest freeze 748 ms.
- Removing every seek script (`bis-noseek` 1150 ms) or only the layout cache (`bis-nocache` 1122 ms) does not help.
- Mechanism, from the trace: the completion task is ChatGPT's own code (`226913…js`), run in one microtask. It flips the turn state and then forces a 759 ms layout of every block that the streaming rule had skipped and that was never marked. alpha9 and `2bc372f` marked those blocks at their placeholder size, so they stayed skipped (228 ms).
- Every extension MutationObserver runs **after** that forced layout. A fix that reacts at completion therefore cannot work: `latest-unrendered-skip` measured 1193 ms and `fix2-unrendered` 1285 ms. The attribute has to be in place before completion.

**2. Stream, +4.1 s blocked outside the completion window (7.7 → 11.8 s); frame p95 33 → 50 ms.** Cause: `seek/layout-cache-main.js` alone.
- `bis-nocache` (latest without that one file) measures 8.2 s blocked, frame p95 33 ms, style 15.0 s. `lc-nomainmo` (its main MutationObserver detached) measures 9.0 s, 33 ms, 15.0 s.
- History, consent and the layout bridge, rail, the popup and status code, `offscreen.js`, `overflow-clip-margin` (alpha10) and the seek and layout settings change nothing measurable.
- The seek and layout toggles leave the cache running, because `needed()` is true unless seek, cv **and** layout are all off.
- Rail off saves 2.2 s of paint and 3.3 s of task time but no blocked time, so it isn't a cause.

In trace time, the layout cache adds:
- **Its own JS: ≈ 2.0 s.**
  - MutationObserver callback: 1.06 s. On every streamed mutation (`characterData` + `childList` + subtree on `document`), it runs `t.querySelectorAll(BLOCK)` and `t.querySelectorAll(ITEMS)` over the whole streaming turn, then `queue(t)`.
  - Idle `work()`: 0.87 s. That is 393 'incomplete' rejections of the streaming turn and 3 refreshes of finished turns, which force layout of a page that every chunk invalidates.
    - One ≈ 0.5 s idle call lands 0.75 s after send, before the answer turn is `in_progress`. It re-measures the previous long answer: a 484 ms call with 386 ms of forced style. A 24-item slice cannot bound it, because the first `getBoundingClientRect` forces the whole recalc.
  - Everything else: ≈ 0.1 s.
- **Extra style recalc: ≈ +3.0 s** (15.3 → 18.2 s), about as many recalcs (6.2k vs 6.5k) with the same total elements. The time sits in small recalcs of under 1k elements (15.0 → 17.3 s), so each recalc carries more fixed cost. It goes away only when the cache watches no turn (`bis-nocache`, `lc-nomainmo`). It **persists** when any one of the following is removed:
  - block ResizeObservers (`lc-noblockro`) or all turn, row and block ResizeObserver targets (`lc-noro`);
  - the `clientWidth` hook;
  - `characterData` (−0.5 s), or the switch to a `childList`-only observer (callback JS 1.06 s → 18 ms, style still 18.0 s);
  - the MutationObserver callback work and idle measuring during the stream (`cache-defer`).

  **The mechanism is not resolved.** The next step would be a `TRACE=heavy` invalidation and selector-stats trace of `latest` vs `lc-nomainmo`, or variants removing several hooks at once.
- **IntersectionObserver `computeIntersections`: +0.6 s** (13.2 → 13.8 s). It is back at 13.1–13.4 s without the cache.

These overlap inside the same frames, so the trace components do not add up to LoAF blocked time. The arms do: 7.7 s stream-window blocked without the file, 11.8 s with it.

## Recommended fixes

| Cause | Fix | Measured effect (vs latest) | Trade-off |
|---|---|---|---|
| 1. Completion render (`offscreen.js`, 6e83623) | **fix4**: at the flush, a block still skipped gets `data-butter-unrendered`; it stays in `waiting` and the completion branch no longer calls `rendered()`. One CSS selector keeps `content-visibility: auto` on `[data-butter-unrendered]`. When the block renders (scrolled to), `rendered()` → ResizeObserver → flush marks it seen and removes the attribute. | Completion task 1162 → **632** ms alone, **590** ms with the cache defer (alpha9 574). Longest freeze 1348 → **762 / 736** ms. Completion layout 776 → 236 ms. Stream blocked unchanged. | The layout cache rejects the turn as `placeholder` (44 rejections in the scroll check) until the user scrolls through it. Scroll check, 2 runs per fix arm: 229 blocks held back after completion; after scrolling, 0 unrendered and all measured and marked. Seek preview therefore has no record of a fresh long answer until it has been seen. latest also records nothing for it by then (45 `zero-block` rejections), so coverage is not worse. |
| 2a. Layout cache JS while streaming | **cache-defer**: skip `in_progress` turns in the MutationObserver loop (they are processed when the state attribute flips) and defer idle `work()` while any turn is `in_progress`. Optionally also drop `characterData` (fix5: the observer callback falls to 18 ms). | Extension JS 2.1 → 0.9 s; stream blocked −1.1 s (13.1 → 12.0). With fix4: 11.8 s; fix5: **11.0** s blocked, 10.3 s outside the completion window. Frame p95 stays 50 ms. | Finished turns are not re-recorded until the stream ends; a seek during a stream uses `measure()` on press anyway. The ≈ 0.5 s measure right after send remains, because no turn is `in_progress` yet. Also deferring while a send is pending would remove it (not measured). |
| 2b. +3 s style while the cache watches turns | **Not found.** The only measured remedy is not watching turns at all during a stream (`lc-nomainmo`: 9.0 s blocked, p95 33 ms, but no records). | Upper bound: −4.1 s blocked, frame p95 back to 33 ms. | Turning the cache off while streaming (for example, attach the main observer only when no turn is `in_progress`, then rescan) would need a re-scan at completion. Not built or measured. Needs the invalidation trace first. |

**Smallest change with a measured effect:** fix4 (`offscreen.js` + one CSS selector). It removes the whole completion regression: the 1.3 s freeze becomes 0.74–0.76 s, matching alpha.9. Adding cache-defer takes stream blocked time from 13.1 s to about 11.8 s. About 2.7 s of stream blocked time (frame p95 50 vs 33 ms) remains, tied to the layout cache watching turns, with the mechanism unresolved.

## Lab state

- 76 phases ran (including 2 shakedowns); all exited 0, and none hit a 429 or usage notice.
- After each phase:
  - the arm's extension storage was cleared: `chrome.storage` local, session and sync; the extension's IndexedDB via `butter-layout-clear` and `Storage.clearDataForOrigin`. The last check showed the IndexedDB database list empty. Log: `raw/extension-cleanup.jsonl`, 76 entries.
  - its Snap staging directory `~/snap/chromium/common/butter-diag-<arm>` was removed (none remain);
  - lab2 was restarted with no extension and restored with `lab-restore`.
- Final restore check (17:18 UTC): lab2 on its home URL `…<project>`, one tab, empty composer, native fetch, no replay, no extension loaded.
- `lab-lock status`: lab1, lab2 and perf are all free. lab1 was never touched.
- Raw data (11 GB, mostly traces): `(not archived)`. Private; do not publish.

## Files

- `harness/`: the copied harness (`stream.mjs` adds full-run light tracing, replay marks, `data-butter-off` capture, `ARM_OPTS` and the scroll check), `clear.mjs`
- `phase.sh`, `matrix.py`: per-arm phase and driver
- `analyze.py`, `summarize.py`, `longtask.py`, `when.py`, `style.py`: trace analysis
- `table.md` (all metrics × all arms), `functions.md` (top functions per arm), `arms.json` (n, observed `data-butter-off`, storage per arm)
- `builds/`: every arm's extension, including the lab-only fix variants
