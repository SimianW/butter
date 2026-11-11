# Corrected control commands and redacted actual output

The prior task commands remain in [commands-aborted.md](commands-aborted.md); those attempts remain excluded. This rerun accepts blocked denials and rejects completed ChatGPT writes, escaped replay POSTs, missing send guard, expired login or fixture mismatch. Raw captures remain local.

## Preparation

Read host lab README and `lab/README.md` first. Read main/alpha.11 `stream/containment.css`, `stream/offscreen.js`, and both storage normalizers. Read the existing temporary drivers, safety helper and runner; no extension code edits.

```text
$ git fetch origin
(exit 0, no output; refs already current)
$ git rev-parse origin/main origin/t3/replay-blocking
2f2412706c318e2592c081e13436cee8e1af80c6
a86d2905952a4a6b9ff7f92a038c89da459cda3f
$ python3 /tmp/replay-blocking-work/prepare-rerun.py
main 2f2412706c318e2592c081e13436cee8e1af80c6
parent a86d2905952a4a6b9ff7f92a038c89da459cda3f
release zip sha256 8cc5476fdd0ac4748aa2b726dd0a1c1308f0b7ec6a63c3bd19dbd77c1f57a3ef
rerun prepared; original captures retained
$ node --check /tmp/replay-blocking-work/rerun/harness/selectors.mjs
$ node --check /tmp/replay-blocking-work/rerun/harness/m1.mjs
$ node --check /tmp/replay-blocking-work/rerun/harness/m2.mjs
(all exit 0, no output)
```

Preparation created a fresh mode-700 rerun directory, copied the frozen inputs and exact released extension, archived current main into a new directory and staged pristine Snap-readable extension copies. It removed the fetch-denial failure assertion, checked that lab.sendGuard returns an installed handler, counted completed network writes and escaped local replay POSTs, and added before-Enter/half-chunk selector probes.

The network route templates replace UUIDs and challenge-path suffixes with `<id>`. This template-only normalization was strengthened after inspecting local captures; it does not change request handling or timing. Preexisting template files were sanitized in place, while raw captures stayed private.

## Matrix and ablations

`python3 /tmp/replay-blocking-work/rerun/run.py > /tmp/replay-blocking-work/rerun/run.log 2>&1` executed the commands below. Each restart set LAB_ID privately from acquire output, LAB_EXTENSIONS empty for none or to the task-owned immutable extension path, and method-specific LAB_FLAGS. CHAT was resolved privately from math12; REC pointed to the copied immutable recording. No private fixture URL appears in published arguments.

The coordinator evaluates the ablation triggers outside all measured commands after the full matrix, before cleanup. A planned manual ablation helper was prepared but its execution, if any, is listed below.

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner replay-blocking --wait 1800 --perf --needs-fixture math12
# UTC 2026-11-11T20:55:30.195582+00:00 -> 2026-11-11T20:55:30.259549+00:00; exit 0; 0.064 s
1
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T20:55:30.259974+00:00 -> 2026-11-11T20:55:32.330606+00:00; exit 0; 2.071 s
chromium: stopped
chromium: started (pid 2804031)
```

```text
$ node /tmp/replay-blocking-work/rerun/harness/m1.mjs M1-none-1 1
# UTC 2026-11-11T20:55:35.862984+00:00 -> 2026-11-11T20:58:16.678686+00:00; exit 0; 160.816 s
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
20:55:36 [M1-none-1] replaying 189 chunks over 122s, 1 reps
20:55:57 [M1-none-1] fresh-history {"rep":1,"beforeReset":{"url":"https://chatgpt.com/","ticks":0,"rows":[]},"freshHistory":{"ticks":0,"rows":[5]}}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"[container-type:inline-size] flex min-h-full shrink-0 flex-col justify-start overflow-clip [container-name:thread-content] shiftWithTranscript-HwFV6s","subtreeElements":103287,"type":"inline-size"},{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":0,"unrendered":0},"states":{"complete":5},"autoBlocks":0,"off":"","butter":null,"chunks":0,"probeMs":164.5}
20:56:41 [M1-none-1] progress {"rep":1,"elapsedMs":30489,"chunks":76,"total":189,"started":true,"done":false}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"[container-type:inline-size] flex min-h-full shrink-0 flex-col justify-start overflow-clip [container-name:thread-content] shiftWithTranscript-HwFV6s","subtreeElements":69412,"type":"inline-size"},{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":0,"unrendered":0},"states":{"complete":3,"in_progress":1},"autoBlocks":0,"off":"","butter":null,"chunks":95,"probeMs":112.09999990463257}
20:57:11 [M1-none-1] progress {"rep":1,"elapsedMs":60640,"chunks":105,"total":189,"started":true,"done":false}
20:57:42 [M1-none-1] progress {"rep":1,"elapsedMs":92141,"chunks":140,"total":189,"started":true,"done":false}
20:58:12 [M1-none-1] progress {"rep":1,"elapsedMs":122318,"chunks":189,"total":189,"started":true,"done":true}
20:58:16 [M1-none-1] rep 1: fps=16 p95=283.2 jank=20% busy=87% style=61.3% blocked=72.4s maxFreeze=2737 keyP95=289.5 keyMax=395.1 wheelP95=364 LoAF[renderSL=72.7s forcedSL=27.6s script=9.7s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1166 seenMarks=0 butter=null nodes=194641 turns=9 chunks=189/189
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T20:58:16.687355+00:00 -> 2026-11-11T20:58:18.761055+00:00; exit 0; 2.074 s
chromium: stopped
chromium: started (pid 2807862)
```

```text
$ node /tmp/replay-blocking-work/rerun/harness/m1.mjs M1-a11-1 1
# UTC 2026-11-11T20:58:22.262111+00:00 -> 2026-11-11T21:01:02.363557+00:00; exit 0; 160.101 s
storage seed {"version":"0.1.0-alpha.11","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
20:58:23 [M1-a11-1] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":4747,"visibleScrollers":1,"off":""}
20:58:42 [M1-a11-1] fresh-history {"rep":1,"beforeReset":{"url":"https://chatgpt.com/","ticks":0,"rows":[]},"freshHistory":{"ticks":9,"rows":[5]}}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":6611.5}
20:59:26 [M1-a11-1] progress {"rep":1,"elapsedMs":30098,"chunks":74,"total":189,"started":true,"done":false}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1864,"unrendered":172},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":147,"published":147},"chunks":95,"probeMs":2375.0999999046326}
20:59:56 [M1-a11-1] progress {"rep":1,"elapsedMs":60388,"chunks":105,"total":189,"started":true,"done":false}
21:00:27 [M1-a11-1] progress {"rep":1,"elapsedMs":90831,"chunks":139,"total":189,"started":true,"done":false}
21:00:57 [M1-a11-1] progress {"rep":1,"elapsedMs":121147,"chunks":187,"total":189,"started":true,"done":false}
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
21:01:02 [M1-a11-1] rep 1: fps=46.2 p95=50.1 jank=5.1% busy=59.1% style=20.5% blocked=14.0s maxFreeze=6621 keyP95=278.7 keyMax=303.8 wheelP95=102 LoAF[renderSL=23.7s forcedSL=2s script=2s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1181 seenMarks=440 butter={"smootherFrames":387,"published":386} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T21:01:02.376928+00:00 -> 2026-11-11T21:01:04.447866+00:00; exit 0; 2.071 s
chromium: stopped
chromium: started (pid 2812125)
```

```text
$ node /tmp/replay-blocking-work/rerun/harness/m1.mjs M1-main-1 1
# UTC 2026-11-11T21:01:07.959539+00:00 -> 2026-11-11T21:04:02.502576+00:00; exit 0; 174.543 s
storage seed {"version":"0.1.0-alpha.20","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
21:01:09 [M1-main-1] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":4747,"visibleScrollers":1,"off":""}
21:01:39 [M1-main-1] fresh-history {"rep":1,"beforeReset":{"url":"https://chatgpt.com/","ticks":0,"rows":[]},"freshHistory":{"ticks":9,"rows":[5]}}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":9018.800000190735}
21:02:26 [M1-main-1] progress {"rep":1,"elapsedMs":30194,"chunks":74,"total":189,"started":true,"done":false}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1862,"unrendered":174},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":141,"published":141},"chunks":95,"probeMs":3861.300000190735}
21:02:56 [M1-main-1] progress {"rep":1,"elapsedMs":60398,"chunks":105,"total":189,"started":true,"done":false}
21:03:28 [M1-main-1] progress {"rep":1,"elapsedMs":91961,"chunks":140,"total":189,"started":true,"done":false}
21:03:58 [M1-main-1] progress {"rep":1,"elapsedMs":122377,"chunks":189,"total":189,"started":true,"done":true}
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
21:04:02 [M1-main-1] rep 1: fps=20.2 p95=250 jank=12.3% busy=85.6% style=60.4% blocked=67.0s maxFreeze=9028 keyP95=629.8 keyMax=651 wheelP95=400 LoAF[renderSL=67.7s forcedSL=6.4s script=3.8s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1167 seenMarks=438 butter={"smootherFrames":329,"published":329} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T21:04:02.519819+00:00 -> 2026-11-11T21:04:04.592650+00:00; exit 0; 2.073 s
chromium: stopped
chromium: started (pid 2816220)
```

```text
$ node /tmp/replay-blocking-work/rerun/harness/m1.mjs M1-a11-2 1
# UTC 2026-11-11T21:04:08.110421+00:00 -> 2026-11-11T21:06:46.007850+00:00; exit 0; 157.897 s
storage seed {"version":"0.1.0-alpha.11","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
21:04:09 [M1-a11-2] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
21:04:26 [M1-a11-2] fresh-history {"rep":1,"beforeReset":{"url":"https://chatgpt.com/","ticks":0,"rows":[]},"freshHistory":{"ticks":9,"rows":[5]}}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":6650.599999904633}
21:05:10 [M1-a11-2] progress {"rep":1,"elapsedMs":30207,"chunks":76,"total":189,"started":true,"done":false}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1862,"unrendered":174},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":147,"published":147},"chunks":95,"probeMs":2393.300000190735}
21:05:40 [M1-a11-2] progress {"rep":1,"elapsedMs":60394,"chunks":105,"total":189,"started":true,"done":false}
21:06:10 [M1-a11-2] progress {"rep":1,"elapsedMs":90684,"chunks":139,"total":189,"started":true,"done":false}
21:06:41 [M1-a11-2] progress {"rep":1,"elapsedMs":120768,"chunks":187,"total":189,"started":true,"done":false}
active Butter preflight {"ticks":10,"seen":4063,"visibleScrollers":1,"off":""}
21:06:45 [M1-a11-2] rep 1: fps=46.7 p95=50 jank=4.9% busy=58.2% style=19.7% blocked=13.0s maxFreeze=6660 keyP95=276.4 keyMax=281.6 wheelP95=96 LoAF[renderSL=22.6s forcedSL=2s script=2.1s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1179 seenMarks=442 butter={"smootherFrames":386,"published":386} nodes=194643 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4063,"visibleScrollers":1,"off":""}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T21:06:46.030117+00:00 -> 2026-11-11T21:06:48.103065+00:00; exit 0; 2.073 s
chromium: stopped
chromium: started (pid 2820437)
```

```text
$ node /tmp/replay-blocking-work/rerun/harness/m1.mjs M1-main-2 1
# UTC 2026-11-11T21:06:51.616734+00:00 -> 2026-11-11T21:09:45.003185+00:00; exit 0; 173.386 s
storage seed {"version":"0.1.0-alpha.20","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
21:06:52 [M1-main-2] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":4747,"visibleScrollers":1,"off":""}
21:07:22 [M1-main-2] fresh-history {"rep":1,"beforeReset":{"url":"https://chatgpt.com/","ticks":0,"rows":[]},"freshHistory":{"ticks":9,"rows":[5]}}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":9100.200000286102}
21:08:09 [M1-main-2] progress {"rep":1,"elapsedMs":30016,"chunks":74,"total":189,"started":true,"done":false}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1862,"unrendered":174},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":140,"published":140},"chunks":95,"probeMs":3965.5999999046326}
21:08:39 [M1-main-2] progress {"rep":1,"elapsedMs":60403,"chunks":105,"total":189,"started":true,"done":false}
21:09:10 [M1-main-2] progress {"rep":1,"elapsedMs":91836,"chunks":140,"total":189,"started":true,"done":false}
21:09:41 [M1-main-2] progress {"rep":1,"elapsedMs":122187,"chunks":189,"total":189,"started":true,"done":true}
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
21:09:44 [M1-main-2] rep 1: fps=20.2 p95=250.1 jank=12.3% busy=85.6% style=60.4% blocked=66.7s maxFreeze=9110 keyP95=624.1 keyMax=632.2 wheelP95=429 LoAF[renderSL=67.3s forcedSL=6.4s script=3.6s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1161 seenMarks=438 butter={"smootherFrames":335,"published":334} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T21:09:45.028876+00:00 -> 2026-11-11T21:09:47.101054+00:00; exit 0; 2.072 s
chromium: stopped
chromium: started (pid 2824483)
```

```text
$ node /tmp/replay-blocking-work/rerun/harness/m1.mjs M1-none-2 1
# UTC 2026-11-11T21:09:50.602010+00:00 -> 2026-11-11T21:12:40.032098+00:00; exit 0; 169.43 s
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
21:09:51 [M1-none-2] replaying 189 chunks over 122s, 1 reps
21:10:23 [M1-none-2] fresh-history {"rep":1,"beforeReset":{"url":"https://chatgpt.com/","ticks":0,"rows":[]},"freshHistory":{"ticks":0,"rows":[5]}}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"[container-type:inline-size] flex min-h-full shrink-0 flex-col justify-start overflow-clip [container-name:thread-content] shiftWithTranscript-HwFV6s","subtreeElements":103287,"type":"inline-size"},{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":0,"unrendered":0},"states":{"complete":5},"autoBlocks":0,"off":"","butter":null,"chunks":0,"probeMs":160.19999980926514}
21:11:04 [M1-none-2] progress {"rep":1,"elapsedMs":30102,"chunks":74,"total":189,"started":true,"done":false}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"[container-type:inline-size] flex min-h-full shrink-0 flex-col justify-start overflow-clip [container-name:thread-content] shiftWithTranscript-HwFV6s","subtreeElements":69412,"type":"inline-size"},{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":0,"unrendered":0},"states":{"complete":3,"in_progress":1},"autoBlocks":0,"off":"","butter":null,"chunks":95,"probeMs":461.7000002861023}
21:11:34 [M1-none-2] progress {"rep":1,"elapsedMs":60240,"chunks":105,"total":189,"started":true,"done":false}
21:12:06 [M1-none-2] progress {"rep":1,"elapsedMs":91975,"chunks":140,"total":189,"started":true,"done":false}
21:12:36 [M1-none-2] progress {"rep":1,"elapsedMs":122116,"chunks":189,"total":189,"started":true,"done":true}
21:12:39 [M1-none-2] rep 1: fps=15.1 p95=283.3 jank=21.3% busy=88.2% style=61.7% blocked=73.1s maxFreeze=2744 keyP95=271 keyMax=271.2 wheelP95=358 LoAF[renderSL=72.9s forcedSL=28.1s script=9.7s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1166 seenMarks=0 butter=null nodes=194641 turns=9 chunks=189/189
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T21:12:40.064823+00:00 -> 2026-11-11T21:12:42.137330+00:00; exit 0; 2.073 s
chromium: stopped
chromium: started (pid 2829028)
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner replay-blocking
# UTC 2026-11-11T21:15:33.606876+00:00 -> 2026-11-11T21:15:44.189587+00:00; exit 0; 10.583 s
restore lab 1: restarting browser (now {"pid":2829028,"extensions":["/home/simon/snap/chromium/common/replay-blocking-main"],"flags":[]}, cdp up, want {"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]})
chromium: stopped
chromium: started (pid 2836709)
restored {"lab":1,"restarted":true,"url":"<REDACTED_CHAT_URL>","composer":"","pages":["<REDACTED_CHAT_URL>"],"browser":{"pid":2836709,"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]},"at":"2026-11-11T21:15:43.599Z","ok":true}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner replay-blocking
# UTC 2026-11-11T21:15:44.189835+00:00 -> 2026-11-11T21:15:44.253556+00:00; exit 0; 0.064 s
{"lab": 1, "lab_released": true, "perf_released": true}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner replay-blocking --wait 1800 --perf --needs-fixture math12
# UTC 2026-11-11T21:15:59.142137+00:00 -> 2026-11-11T21:15:59.206131+00:00; exit 0; 0.064 s
1
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T21:15:59.213902+00:00 -> 2026-11-11T21:16:01.286353+00:00; exit 0; 2.072 s
chromium: stopped
chromium: started (pid 2837574)
```

```text
$ node /tmp/replay-blocking-work/rerun/harness/m1.mjs M1-main-3 1
# UTC 2026-11-11T21:16:04.818869+00:00 -> 2026-11-11T21:19:02.669118+00:00; exit 0; 177.85 s
storage seed {"version":"0.1.0-alpha.20","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
21:16:06 [M1-main-3] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
21:16:39 [M1-main-3] fresh-history {"rep":1,"beforeReset":{"url":"https://chatgpt.com/","ticks":0,"rows":[]},"freshHistory":{"ticks":9,"rows":[5]}}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":9042.5}
21:17:26 [M1-main-3] progress {"rep":1,"elapsedMs":30204,"chunks":74,"total":189,"started":true,"done":false}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1862,"unrendered":174},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":140,"published":140},"chunks":95,"probeMs":3861.7000002861023}
21:17:56 [M1-main-3] progress {"rep":1,"elapsedMs":60389,"chunks":105,"total":189,"started":true,"done":false}
21:18:28 [M1-main-3] progress {"rep":1,"elapsedMs":91879,"chunks":140,"total":189,"started":true,"done":false}
21:18:58 [M1-main-3] progress {"rep":1,"elapsedMs":121952,"chunks":187,"total":189,"started":true,"done":false}
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
21:19:02 [M1-main-3] rep 1: fps=20.5 p95=249.9 jank=12.2% busy=85.5% style=60.1% blocked=66.1s maxFreeze=9052 keyP95=636.4 keyMax=654 wheelP95=374 LoAF[renderSL=66.7s forcedSL=6.7s script=3.7s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1161 seenMarks=438 butter={"smootherFrames":333,"published":333} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T21:19:02.712764+00:00 -> 2026-11-11T21:19:04.782284+00:00; exit 0; 2.07 s
chromium: stopped
chromium: started (pid 2841663)
```

```text
$ node /tmp/replay-blocking-work/rerun/harness/m1.mjs M1-none-3 1
# UTC 2026-11-11T21:19:08.302338+00:00 -> 2026-11-11T21:21:48.859541+00:00; exit 0; 160.557 s
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
21:19:09 [M1-none-3] replaying 189 chunks over 122s, 1 reps
21:19:31 [M1-none-3] fresh-history {"rep":1,"beforeReset":{"url":"https://chatgpt.com/","ticks":0,"rows":[]},"freshHistory":{"ticks":0,"rows":[5]}}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"[container-type:inline-size] flex min-h-full shrink-0 flex-col justify-start overflow-clip [container-name:thread-content] shiftWithTranscript-HwFV6s","subtreeElements":103287,"type":"inline-size"},{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":0,"unrendered":0},"states":{"complete":5},"autoBlocks":0,"off":"","butter":null,"chunks":0,"probeMs":175.7000002861023}
21:20:13 [M1-none-3] progress {"rep":1,"elapsedMs":30143,"chunks":74,"total":189,"started":true,"done":false}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"[container-type:inline-size] flex min-h-full shrink-0 flex-col justify-start overflow-clip [container-name:thread-content] shiftWithTranscript-HwFV6s","subtreeElements":69412,"type":"inline-size"},{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":0,"unrendered":0},"states":{"complete":3,"in_progress":1},"autoBlocks":0,"off":"","butter":null,"chunks":95,"probeMs":207.80000019073486}
21:20:43 [M1-none-3] progress {"rep":1,"elapsedMs":60448,"chunks":105,"total":189,"started":true,"done":false}
21:21:14 [M1-none-3] progress {"rep":1,"elapsedMs":91932,"chunks":140,"total":189,"started":true,"done":false}
21:21:45 [M1-none-3] progress {"rep":1,"elapsedMs":122139,"chunks":189,"total":189,"started":true,"done":true}
21:21:48 [M1-none-3] rep 1: fps=16.1 p95=266.7 jank=20.1% busy=86.4% style=61% blocked=71.8s maxFreeze=2697 keyP95=281.5 keyMax=322 wheelP95=418 LoAF[renderSL=72.2s forcedSL=27.6s script=9.2s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1157 seenMarks=0 butter=null nodes=194641 turns=9 chunks=189/189
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T21:21:48.904229+00:00 -> 2026-11-11T21:21:50.973135+00:00; exit 0; 2.069 s
chromium: stopped
chromium: started (pid 2846123)
```

```text
$ node /tmp/replay-blocking-work/rerun/harness/m1.mjs M1-a11-3 1
# UTC 2026-11-11T21:21:54.484519+00:00 -> 2026-11-11T21:24:39.607316+00:00; exit 0; 165.123 s
storage seed {"version":"0.1.0-alpha.11","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
21:21:55 [M1-a11-3] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":2932,"visibleScrollers":1,"off":""}
21:22:19 [M1-a11-3] fresh-history {"rep":1,"beforeReset":{"url":"https://chatgpt.com/","ticks":0,"rows":[]},"freshHistory":{"ticks":9,"rows":[5]}}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":6693.699999809265}
21:23:03 [M1-a11-3] progress {"rep":1,"elapsedMs":30140,"chunks":74,"total":189,"started":true,"done":false}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1862,"unrendered":174},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":147,"published":147},"chunks":95,"probeMs":2450.0999999046326}
21:23:34 [M1-a11-3] progress {"rep":1,"elapsedMs":60315,"chunks":105,"total":189,"started":true,"done":false}
21:24:04 [M1-a11-3] progress {"rep":1,"elapsedMs":90382,"chunks":139,"total":189,"started":true,"done":false}
21:24:34 [M1-a11-3] progress {"rep":1,"elapsedMs":120955,"chunks":187,"total":189,"started":true,"done":false}
active Butter preflight {"ticks":10,"seen":2247,"visibleScrollers":1,"off":""}
21:24:39 [M1-a11-3] rep 1: fps=44.5 p95=66.7 jank=6% busy=60.8% style=22.6% blocked=17.1s maxFreeze=6703 keyP95=303.8 keyMax=310.1 wheelP95=126 LoAF[renderSL=26.1s forcedSL=2.3s script=2.4s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1163 seenMarks=440 butter={"smootherFrames":384,"published":384} nodes=194549 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":2247,"visibleScrollers":1,"off":""}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T21:24:39.655932+00:00 -> 2026-11-11T21:24:41.725985+00:00; exit 0; 2.07 s
chromium: stopped
chromium: started (pid 2849842)
```

```text
$ node /tmp/replay-blocking-work/rerun/harness/m2.mjs M2-none-1 1
# UTC 2026-11-11T21:24:45.249042+00:00 -> 2026-11-11T21:27:34.078546+00:00; exit 0; 168.83 s
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
21:24:48 [M2-none-1] replaying 189 chunks over 122s, 1 reps
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"[container-type:inline-size] flex min-h-full shrink-0 flex-col justify-start overflow-clip [container-name:thread-content] shiftWithTranscript-HwFV6s","subtreeElements":103287,"type":"inline-size"},{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":0,"unrendered":0},"states":{"complete":5},"autoBlocks":0,"off":"","butter":null,"chunks":0,"probeMs":166.19999980926514}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"[container-type:inline-size] flex min-h-full shrink-0 flex-col justify-start overflow-clip [container-name:thread-content] shiftWithTranscript-HwFV6s","subtreeElements":69412,"type":"inline-size"},{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":0,"unrendered":0},"states":{"complete":3,"in_progress":1},"autoBlocks":0,"off":"","butter":null,"chunks":95,"probeMs":114.5}
21:27:33 [M2-none-1] rep 1: fps=13.8 p95=283.4 jank=22.3% busy=87.3% style=61.2% blocked=70.6s maxFreeze=1410 keyP95=351 keyMax=416.1 wheelP95=375 LoAF[renderSL=72.2s forcedSL=28.3s script=9.7s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1172 seenMarks=0 butter=null nodes=194621 turns=9 chunks=189/189
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T21:27:34.126892+00:00 -> 2026-11-11T21:27:36.199815+00:00; exit 0; 2.073 s
chromium: stopped
chromium: started (pid 2854483)
```

```text
$ node /tmp/replay-blocking-work/rerun/harness/m2.mjs M2-a11-1 1
# UTC 2026-11-11T21:27:39.700768+00:00 -> 2026-11-11T21:30:22.665141+00:00; exit 0; 162.964 s
storage seed {"version":"0.1.0-alpha.11","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
21:27:43 [M2-a11-1] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":6174.5}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1864,"unrendered":172},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":147,"published":147},"chunks":95,"probeMs":2431.1000003814697}
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
21:30:22 [M2-a11-1] rep 1: fps=44.8 p95=50.1 jank=5.2% busy=58.9% style=20% blocked=13.0s maxFreeze=2438 keyP95=256.5 keyMax=281.3 wheelP95=100 LoAF[renderSL=23s forcedSL=2s script=2.1s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1172 seenMarks=440 butter={"smootherFrames":387,"published":386} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T21:30:22.713090+00:00 -> 2026-11-11T21:30:24.785012+00:00; exit 0; 2.072 s
chromium: stopped
chromium: started (pid 2858239)
```

```text
$ node /tmp/replay-blocking-work/rerun/harness/m2.mjs M2-main-1 1
# UTC 2026-11-11T21:30:28.285966+00:00 -> 2026-11-11T21:33:33.848418+00:00; exit 0; 185.562 s
storage seed {"version":"0.1.0-alpha.20","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
21:30:32 [M2-main-1] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":8810.099999904633}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1862,"unrendered":174},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":140,"published":140},"chunks":95,"probeMs":4065.0999999046326}
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
21:33:33 [M2-main-1] rep 1: fps=17.9 p95=266.7 jank=14.4% busy=86.6% style=61.2% blocked=66.3s maxFreeze=4072 keyP95=685 keyMax=714.7 wheelP95=398 LoAF[renderSL=68.3s forcedSL=6.3s script=3.9s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1173 seenMarks=439 butter={"smootherFrames":328,"published":328} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T21:33:33.902723+00:00 -> 2026-11-11T21:33:35.974137+00:00; exit 0; 2.071 s
chromium: stopped
chromium: started (pid 2862998)
```

```text
$ node /tmp/replay-blocking-work/rerun/harness/m2.mjs M2-a11-2 1
# UTC 2026-11-11T21:33:39.485107+00:00 -> 2026-11-11T21:36:13.267953+00:00; exit 0; 153.783 s
storage seed {"version":"0.1.0-alpha.11","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
21:33:43 [M2-a11-2] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":4987,"visibleScrollers":1,"off":""}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2055,"unrendered":0},"states":{"complete":5},"autoBlocks":2050,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":5330.599999904633}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1421,"unrendered":174},"states":{"complete":3,"in_progress":1},"autoBlocks":1600,"off":"","butter":{"smootherFrames":148,"published":148},"chunks":95,"probeMs":2360.7000002861023}
active Butter preflight {"ticks":10,"seen":3622,"visibleScrollers":1,"off":""}
21:36:13 [M2-a11-2] rep 1: fps=44.9 p95=50 jank=5% busy=59.7% style=19.7% blocked=12.8s maxFreeze=2381 keyP95=265 keyMax=290.6 wheelP95=101 LoAF[renderSL=23.1s forcedSL=2s script=2.2s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1172 seenMarks=441 butter={"smootherFrames":386,"published":386} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":3622,"visibleScrollers":1,"off":""}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T21:36:13.316654+00:00 -> 2026-11-11T21:36:15.388292+00:00; exit 0; 2.072 s
chromium: stopped
chromium: started (pid 2867243)
```

```text
$ node /tmp/replay-blocking-work/rerun/harness/m2.mjs M2-main-2 1
# UTC 2026-11-11T21:36:18.889297+00:00 -> 2026-11-11T21:39:14.629030+00:00; exit 0; 175.74 s
storage seed {"version":"0.1.0-alpha.20","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
21:36:22 [M2-main-2] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":2932,"visibleScrollers":1,"off":""}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":8936.699999809265}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1861,"unrendered":175},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":142,"published":142},"chunks":95,"probeMs":4003.6000003814697}
active Butter preflight {"ticks":10,"seen":2245,"visibleScrollers":1,"off":""}
21:39:14 [M2-main-2] rep 1: fps=17.8 p95=266.7 jank=14.4% busy=86.8% style=61.8% blocked=67.2s maxFreeze=4017 keyP95=662.1 keyMax=690.7 wheelP95=394 LoAF[renderSL=68.6s forcedSL=6.5s script=4s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1166 seenMarks=437 butter={"smootherFrames":332,"published":331} nodes=194549 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":2245,"visibleScrollers":1,"off":""}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T21:39:14.682806+00:00 -> 2026-11-11T21:39:16.754810+00:00; exit 0; 2.072 s
chromium: stopped
chromium: started (pid 2871240)
```

```text
$ node /tmp/replay-blocking-work/rerun/harness/m2.mjs M2-none-2 1
# UTC 2026-11-11T21:39:20.255809+00:00 -> 2026-11-11T21:42:00.510243+00:00; exit 0; 160.254 s
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
21:39:24 [M2-none-2] replaying 189 chunks over 122s, 1 reps
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"[container-type:inline-size] flex min-h-full shrink-0 flex-col justify-start overflow-clip [container-name:thread-content] shiftWithTranscript-HwFV6s","subtreeElements":103287,"type":"inline-size"},{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":0,"unrendered":0},"states":{"complete":5},"autoBlocks":0,"off":"","butter":null,"chunks":0,"probeMs":156.19999980926514}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"[container-type:inline-size] flex min-h-full shrink-0 flex-col justify-start overflow-clip [container-name:thread-content] shiftWithTranscript-HwFV6s","subtreeElements":69412,"type":"inline-size"},{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":0,"unrendered":0},"states":{"complete":3,"in_progress":1},"autoBlocks":0,"off":"","butter":null,"chunks":95,"probeMs":122.80000019073486}
21:42:00 [M2-none-2] rep 1: fps=13.8 p95=283.4 jank=22.6% busy=87.2% style=62.1% blocked=71.2s maxFreeze=1355 keyP95=289.7 keyMax=308 wheelP95=428 LoAF[renderSL=73.3s forcedSL=28.3s script=9.4s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1162 seenMarks=0 butter=null nodes=194641 turns=9 chunks=189/189
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T21:42:00.565467+00:00 -> 2026-11-11T21:42:02.637240+00:00; exit 0; 2.072 s
chromium: stopped
chromium: started (pid 2875466)
```

```text
$ node /tmp/replay-blocking-work/rerun/harness/m2.mjs M2-main-3 1
# UTC 2026-11-11T21:42:06.151451+00:00 -> 2026-11-11T21:45:10.102332+00:00; exit 0; 183.951 s
storage seed {"version":"0.1.0-alpha.20","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
21:42:10 [M2-main-3] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":9390.099999904633}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1862,"unrendered":174},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":141,"published":141},"chunks":95,"probeMs":3950}
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
21:45:09 [M2-main-3] rep 1: fps=18.1 p95=266.6 jank=14.3% busy=86.6% style=61.1% blocked=66.4s maxFreeze=3956 keyP95=672.5 keyMax=702.9 wheelP95=376 LoAF[renderSL=68.3s forcedSL=6.3s script=4.1s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1162 seenMarks=438 butter={"smootherFrames":331,"published":331} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T21:45:10.152299+00:00 -> 2026-11-11T21:45:12.224027+00:00; exit 0; 2.072 s
chromium: stopped
chromium: started (pid 2879629)
```

```text
$ node /tmp/replay-blocking-work/rerun/harness/m2.mjs M2-none-3 1
# UTC 2026-11-11T21:45:15.724940+00:00 -> 2026-11-11T21:48:05.862250+00:00; exit 0; 170.137 s
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
21:45:19 [M2-none-3] replaying 189 chunks over 122s, 1 reps
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"[container-type:inline-size] flex min-h-full shrink-0 flex-col justify-start overflow-clip [container-name:thread-content] shiftWithTranscript-HwFV6s","subtreeElements":103287,"type":"inline-size"},{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":0,"unrendered":0},"states":{"complete":5},"autoBlocks":0,"off":"","butter":null,"chunks":0,"probeMs":177.69999980926514}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"[container-type:inline-size] flex min-h-full shrink-0 flex-col justify-start overflow-clip [container-name:thread-content] shiftWithTranscript-HwFV6s","subtreeElements":69412,"type":"inline-size"},{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":0,"unrendered":0},"states":{"complete":3,"in_progress":1},"autoBlocks":0,"off":"","butter":null,"chunks":95,"probeMs":122.59999990463257}
21:48:05 [M2-none-3] rep 1: fps=14.3 p95=283.3 jank=22.2% busy=86.4% style=61.2% blocked=69.9s maxFreeze=1362 keyP95=309.7 keyMax=379.9 wheelP95=443 LoAF[renderSL=72.7s forcedSL=27.6s script=9.3s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1176 seenMarks=0 butter=null nodes=194641 turns=9 chunks=189/189
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T21:48:05.911618+00:00 -> 2026-11-11T21:48:07.982634+00:00; exit 0; 2.071 s
chromium: stopped
chromium: started (pid 2884203)
```

```text
$ node /tmp/replay-blocking-work/rerun/harness/m2.mjs M2-a11-3 1
# UTC 2026-11-11T21:48:11.483637+00:00 -> 2026-11-11T21:50:44.882184+00:00; exit 0; 153.399 s
storage seed {"version":"0.1.0-alpha.11","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
21:48:15 [M2-a11-3] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":4987,"visibleScrollers":1,"off":""}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2055,"unrendered":0},"states":{"complete":5},"autoBlocks":2050,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":5363.300000190735}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1423,"unrendered":172},"states":{"complete":3,"in_progress":1},"autoBlocks":1600,"off":"","butter":{"smootherFrames":147,"published":147},"chunks":95,"probeMs":2304}
active Butter preflight {"ticks":10,"seen":3619,"visibleScrollers":1,"off":""}
21:50:44 [M2-a11-3] rep 1: fps=45.2 p95=50 jank=5% busy=59.1% style=19.5% blocked=12.4s maxFreeze=2311 keyP95=270.6 keyMax=281.8 wheelP95=99 LoAF[renderSL=22.6s forcedSL=2s script=2.1s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1170 seenMarks=440 butter={"smootherFrames":386,"published":385} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":3619,"visibleScrollers":1,"off":""}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner replay-blocking
# UTC 2026-11-11T21:50:44.932865+00:00 -> 2026-11-11T21:50:55.323772+00:00; exit 0; 10.391 s
restore lab 1: restarting browser (now {"pid":2884203,"extensions":["/home/simon/snap/chromium/common/replay-blocking-a11"],"flags":["--disable-extensions-except=/home/simon/snap/chromium/common/replay-blocking-a11"]}, cdp up, want {"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]})
chromium: stopped
chromium: started (pid 2887747)
restored {"lab":1,"restarted":true,"url":"<REDACTED_CHAT_URL>","composer":"","pages":["<REDACTED_CHAT_URL>"],"browser":{"pid":2887747,"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]},"at":"2026-11-11T21:50:54.670Z","ok":true}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner replay-blocking
# UTC 2026-11-11T21:50:55.323920+00:00 -> 2026-11-11T21:50:55.438977+00:00; exit 0; 0.115 s
{"lab": 1, "lab_released": true, "perf_released": true}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab-lock status
# UTC 2026-11-11T21:50:55.439109+00:00 -> 2026-11-11T21:50:55.502989+00:00; exit 0; 0.064 s
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

## Interrupted attempt

The initial coordinator and its in-flight M1-main-3 Node process terminated during a user/tool interruption. No exit code or final metric file was returned for that command. The last progress log showed 105/189 chunks after 60390 ms. The partial attempt is preserved privately and excluded. The explicit restore/release commands above succeeded; `prepare-resume.py` started a detached coordinator from the six saved complete results and reran only the interrupted/pending cells. `run-resume.py` uses the same measure function and guards, with completed-cell skipping. No interruption or retry result was silently pooled.

## Analysis, checks and publication

The task-owned export scripts summarize all retained measurements without changing them; only numeric fields enter JSON data. Full class inventories and public bundle URLs are Markdown artifacts. The privacy script checks every exported file and JSON leaves before publication. Actual verification outputs are linked from report.md and recorded below.

```text
$ python3 /tmp/replay-blocking-work/rerun/verify-final.py
{"matrix18": 1, "threePerCell": 1, "rotatingOrders": 1, "allChunks189": 1, "oneExpectedHash": 1, "zeroCompletedWrites": 1, "zeroReplayEscapes": 1, "twoProbesEveryRun": 1, "midProbeDuringReplay": 1, "extensionActivityAtMid": 1, "noButterInNone": 1, "ablationBudget": 1, "restoreOk": 1, "releaseOk": 1, "labAndPerfReleased": 1, "statusUnchanged": 1, "branchUnchanged": 1, "headUnchanged": 1, "a11Pristine": 1, "mainPristine": 1, "releasedZipSha": 1, "allPass": 1}
task-owned runtime extensions removed after restore; raw captures retained
```

```text
$ python3 /tmp/replay-blocking-work/rerun/privacy.py
{"filesScanned": 16, "identifierNeedles": 111, "textFragmentNeedles": 308, "uuid": 0, "chatURL": 0, "email": 0, "privateEndpoint": 0, "challengePathSuffix": 0, "bearerCredential": 0, "tokenCredential": 0, "privateIdentifiers": 0, "capturedTextFragments": 0, "allJsonLeavesNumeric": 1, "passed": 1}
```

Publication uses GIT_INDEX_FILE=/tmp/replay-blocking-work/rerun/index, read-tree origin/t3/replay-blocking, hash-object -w, update-index --add --cacheinfo, write-tree, commit-tree -p origin/t3/replay-blocking, then a fast-forward push of the new commit to refs/heads/t3/replay-blocking. No branch/index/working-tree operations in the shared checkout. The final commit SHA and actual push output are in the task reply/local publish.log, since a commit cannot include its own SHA.

## Bisect commands and actual output

The first-parent list was checked with `git log --first-parent --reverse ... -- extension/`. Each point uses git archive into a new directory, byte verification and the control storage-normalizer check. Runtime archives stay outside the shared checkout. `python3 /tmp/replay-blocking-work/bisect/run.py` was started detached so a T3 interruption could not kill the lab coordinator.

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner replay-blocking --wait 1800 --perf --needs-fixture math12
# UTC 2026-11-11T22:55:52.580452+00:00 -> 2026-11-11T22:55:52.644565+00:00; exit 0; 0.064 s
1
```

```text
$ node /tmp/replay-blocking-work/bisect/check-seed.mjs /tmp/replay-blocking-work/bisect/builds/i12/extension/shared/status.js
# UTC 2026-11-11T22:55:52.667795+00:00 -> 2026-11-11T22:55:52.699548+00:00; exit 0; 0.032 s
{"accepted":true,"seed":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}},"normalized":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true,"container":true,"cv":true,"throttle":true,"older":true,"rail":true,"seek":true,"branch":true},"lang":"en"}}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T22:55:52.701689+00:00 -> 2026-11-11T22:55:54.772888+00:00; exit 0; 2.071 s
chromium: stopped
chromium: started (pid 2978560)
```

```text
$ node /tmp/replay-blocking-work/bisect/harness/m2.mjs bisect-i12-r1 1
# UTC 2026-11-11T22:55:58.296947+00:00 -> 2026-11-11T22:58:58.736851+00:00; exit 0; 180.44 s
storage seed {"version":"0.1.0-alpha.15","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
22:56:02 [bisect-i12-r1] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":9232.700000286102}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1862,"unrendered":174},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":141,"published":141},"chunks":95,"probeMs":3947.5}
active Butter preflight {"ticks":10,"seen":4062,"visibleScrollers":1,"off":""}
22:58:58 [bisect-i12-r1] rep 1: fps=18.8 p95=266.6 jank=13.5% busy=85.8% style=60.3% blocked=65.4s maxFreeze=3956 keyP95=629.3 keyMax=635.4 wheelP95=404 LoAF[renderSL=66.9s forcedSL=6.6s script=4s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1160 seenMarks=444 butter={"smootherFrames":331,"published":330} nodes=194643 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4062,"visibleScrollers":1,"off":""}
```

```text
$ node /tmp/replay-blocking-work/bisect/check-seed.mjs /tmp/replay-blocking-work/bisect/builds/i6/extension/shared/status.js
# UTC 2026-11-11T22:58:58.755994+00:00 -> 2026-11-11T22:58:58.787698+00:00; exit 0; 0.032 s
{"accepted":true,"seed":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}},"normalized":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true,"container":true,"cv":true,"throttle":true,"older":true,"rail":true,"seek":true},"lang":"en"}}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T22:58:58.790059+00:00 -> 2026-11-11T22:59:00.862185+00:00; exit 0; 2.072 s
chromium: stopped
chromium: started (pid 2982963)
```

```text
$ node /tmp/replay-blocking-work/bisect/harness/m2.mjs bisect-i6-r2 1
# UTC 2026-11-11T22:59:04.363136+00:00 -> 2026-11-11T23:02:05.215250+00:00; exit 0; 180.852 s
storage seed {"version":"0.1.0-alpha.14","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
22:59:08 [bisect-i6-r2] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":2932,"visibleScrollers":1,"off":""}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":9267.89999961853}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1862,"unrendered":174},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":139,"published":139},"chunks":95,"probeMs":4024.5}
active Butter preflight {"ticks":10,"seen":2251,"visibleScrollers":1,"off":""}
23:02:04 [bisect-i6-r2] rep 1: fps=18.3 p95=250.1 jank=13.3% busy=86.2% style=60.4% blocked=66.4s maxFreeze=4040 keyP95=755.6 keyMax=787.3 wheelP95=433 LoAF[renderSL=66.9s forcedSL=6.9s script=4.3s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1159 seenMarks=444 butter={"smootherFrames":315,"published":314} nodes=194549 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":2251,"visibleScrollers":1,"off":""}
```

```text
$ node /tmp/replay-blocking-work/bisect/check-seed.mjs /tmp/replay-blocking-work/bisect/builds/i3/extension/shared/status.js
# UTC 2026-11-11T23:02:05.245618+00:00 -> 2026-11-11T23:02:05.309570+00:00; exit 0; 0.064 s
{"accepted":true,"seed":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}},"normalized":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true,"container":true,"cv":true,"throttle":true,"older":true,"rail":true,"seek":true},"lang":"en"}}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T23:02:05.313044+00:00 -> 2026-11-11T23:02:07.380030+00:00; exit 0; 2.067 s
chromium: stopped
chromium: started (pid 2991808)
```

```text
$ node /tmp/replay-blocking-work/bisect/harness/m2.mjs bisect-i3-r3 1
# UTC 2026-11-11T23:02:10.900895+00:00 -> 2026-11-11T23:04:54.391126+00:00; exit 0; 163.49 s
storage seed {"version":"0.1.0-alpha.13","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
23:02:14 [bisect-i3-r3] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":6190.699999809265}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1864,"unrendered":172},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":148,"published":148},"chunks":95,"probeMs":2393.5999999046326}
active Butter preflight {"ticks":10,"seen":4061,"visibleScrollers":1,"off":""}
23:04:54 [bisect-i3-r3] rep 1: fps=45.4 p95=50 jank=4.9% busy=58.1% style=19.6% blocked=11.8s maxFreeze=2400 keyP95=253.2 keyMax=255.6 wheelP95=98 LoAF[renderSL=22.4s forcedSL=1.9s script=2s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1164 seenMarks=441 butter={"smootherFrames":388,"published":387} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4061,"visibleScrollers":1,"off":""}
```

```text
$ node /tmp/replay-blocking-work/bisect/check-seed.mjs /tmp/replay-blocking-work/bisect/builds/i4/extension/shared/status.js
# UTC 2026-11-11T23:04:54.418128+00:00 -> 2026-11-11T23:04:54.449944+00:00; exit 0; 0.032 s
{"accepted":true,"seed":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}},"normalized":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true,"container":true,"cv":true,"throttle":true,"older":true,"rail":true,"seek":true},"lang":"en"}}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T23:04:54.453228+00:00 -> 2026-11-11T23:04:56.525361+00:00; exit 0; 2.072 s
chromium: stopped
chromium: started (pid 2995713)
```

```text
$ node /tmp/replay-blocking-work/bisect/harness/m2.mjs bisect-i4-r4 1
# UTC 2026-11-11T23:05:00.026383+00:00 -> 2026-11-11T23:07:33.416463+00:00; exit 0; 153.39 s
storage seed {"version":"0.1.0-alpha.13","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
23:05:03 [bisect-i4-r4] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":4987,"visibleScrollers":1,"off":""}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2055,"unrendered":0},"states":{"complete":5},"autoBlocks":2050,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":5491.900000095367}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1423,"unrendered":172},"states":{"complete":3,"in_progress":1},"autoBlocks":1600,"off":"","butter":{"smootherFrames":147,"published":147},"chunks":95,"probeMs":2278}
active Butter preflight {"ticks":10,"seen":3619,"visibleScrollers":1,"off":""}
23:07:33 [bisect-i4-r4] rep 1: fps=44.9 p95=50 jank=5% busy=59.7% style=19.5% blocked=12.8s maxFreeze=2284 keyP95=283 keyMax=294.5 wheelP95=101 LoAF[renderSL=22.9s forcedSL=2s script=2.1s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1170 seenMarks=441 butter={"smootherFrames":386,"published":385} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":3619,"visibleScrollers":1,"off":""}
```

```text
$ node /tmp/replay-blocking-work/bisect/check-seed.mjs /tmp/replay-blocking-work/bisect/builds/i5/extension/shared/status.js
# UTC 2026-11-11T23:07:33.437821+00:00 -> 2026-11-11T23:07:33.469571+00:00; exit 0; 0.032 s
{"accepted":true,"seed":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}},"normalized":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true,"container":true,"cv":true,"throttle":true,"older":true,"rail":true,"seek":true},"lang":"en"}}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T23:07:33.472889+00:00 -> 2026-11-11T23:07:35.542436+00:00; exit 0; 2.07 s
chromium: stopped
chromium: started (pid 2999849)
```

```text
$ node /tmp/replay-blocking-work/bisect/harness/m2.mjs bisect-i5-r5 1
# UTC 2026-11-11T23:07:39.043403+00:00 -> 2026-11-11T23:10:12.535900+00:00; exit 0; 153.493 s
storage seed {"version":"0.1.0-alpha.13","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
23:07:42 [bisect-i5-r5] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":4987,"visibleScrollers":1,"off":""}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2055,"unrendered":0},"states":{"complete":5},"autoBlocks":2050,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":5471.60000038147}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1423,"unrendered":172},"states":{"complete":3,"in_progress":1},"autoBlocks":1600,"off":"","butter":{"smootherFrames":149,"published":149},"chunks":95,"probeMs":2355.5999999046326}
active Butter preflight {"ticks":10,"seen":3622,"visibleScrollers":1,"off":""}
23:10:12 [bisect-i5-r5] rep 1: fps=44.7 p95=66.6 jank=5.3% busy=60.2% style=19.9% blocked=12.9s maxFreeze=2363 keyP95=266.3 keyMax=282.6 wheelP95=101 LoAF[renderSL=23.4s forcedSL=1.9s script=2s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1174 seenMarks=443 butter={"smootherFrames":390,"published":389} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":3622,"visibleScrollers":1,"off":""}
```

```text
$ node /tmp/replay-blocking-work/bisect/check-seed.mjs /tmp/replay-blocking-work/bisect/builds/i1005/extension/shared/status.js
# UTC 2026-11-11T23:10:12.564102+00:00 -> 2026-11-11T23:10:12.595901+00:00; exit 0; 0.032 s
{"accepted":true,"seed":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}},"normalized":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true,"container":true,"cv":true,"throttle":true,"older":true,"rail":true,"seek":true},"lang":"en"}}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T23:10:12.599526+00:00 -> 2026-11-11T23:10:14.672717+00:00; exit 0; 2.073 s
chromium: stopped
chromium: started (pid 3003393)
```

```text
$ node /tmp/replay-blocking-work/bisect/harness/m2.mjs bisect-i1005-r6 1
# UTC 2026-11-11T23:10:18.173736+00:00 -> 2026-11-11T23:13:16.219515+00:00; exit 0; 178.046 s
storage seed {"version":"0.1.0-alpha.13","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
23:10:22 [bisect-i1005-r6] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":8837}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1862,"unrendered":174},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":139,"published":139},"chunks":95,"probeMs":4239.400000095367}
active Butter preflight {"ticks":10,"seen":4061,"visibleScrollers":1,"off":""}
23:13:15 [bisect-i1005-r6] rep 1: fps=19.5 p95=250 jank=12.5% busy=85.1% style=59.2% blocked=63.9s maxFreeze=4258 keyP95=655.7 keyMax=676.8 wheelP95=606 LoAF[renderSL=65.5s forcedSL=6.3s script=3.8s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1158 seenMarks=440 butter={"smootherFrames":326,"published":325} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4061,"visibleScrollers":1,"off":""}
```

```text
$ node /tmp/replay-blocking-work/bisect/check-seed.mjs /tmp/replay-blocking-work/bisect/builds/i1002/extension/shared/status.js
# UTC 2026-11-11T23:13:16.247722+00:00 -> 2026-11-11T23:13:16.279464+00:00; exit 0; 0.032 s
{"accepted":true,"seed":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}},"normalized":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true,"container":true,"cv":true,"throttle":true,"older":true,"rail":true,"seek":true},"lang":"en"}}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T23:13:16.283331+00:00 -> 2026-11-11T23:13:18.354442+00:00; exit 0; 2.071 s
chromium: stopped
chromium: started (pid 3007989)
```

```text
$ node /tmp/replay-blocking-work/bisect/harness/m2.mjs bisect-i1002-r7 1
# UTC 2026-11-11T23:13:21.876530+00:00 -> 2026-11-11T23:16:05.791697+00:00; exit 0; 163.915 s
storage seed {"version":"0.1.0-alpha.13","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
23:13:25 [bisect-i1002-r7] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":6267}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1864,"unrendered":172},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":147,"published":147},"chunks":95,"probeMs":2533.5}
active Butter preflight {"ticks":10,"seen":4063,"visibleScrollers":1,"off":""}
23:16:05 [bisect-i1002-r7] rep 1: fps=44.7 p95=66.6 jank=5.2% busy=59.1% style=20.1% blocked=12.9s maxFreeze=2540 keyP95=270.9 keyMax=318.6 wheelP95=101 LoAF[renderSL=22.9s forcedSL=2.1s script=2.2s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1168 seenMarks=443 butter={"smootherFrames":386,"published":385} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4063,"visibleScrollers":1,"off":""}
```

```text
$ node /tmp/replay-blocking-work/bisect/check-seed.mjs /tmp/replay-blocking-work/bisect/builds/i1003/extension/shared/status.js
# UTC 2026-11-11T23:16:05.820629+00:00 -> 2026-11-11T23:16:05.852346+00:00; exit 0; 0.032 s
{"accepted":true,"seed":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}},"normalized":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true,"container":true,"cv":true,"throttle":true,"older":true,"rail":true,"seek":true},"lang":"en"}}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T23:16:05.856542+00:00 -> 2026-11-11T23:16:07.928055+00:00; exit 0; 2.072 s
chromium: stopped
chromium: started (pid 3011948)
```

```text
$ node /tmp/replay-blocking-work/bisect/harness/m2.mjs bisect-i1003-r8 1
# UTC 2026-11-11T23:16:11.428978+00:00 -> 2026-11-11T23:19:00.561255+00:00; exit 0; 169.132 s
storage seed {"version":"0.1.0-alpha.13","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
23:16:15 [bisect-i1003-r8] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":4747,"visibleScrollers":1,"off":""}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":6748.599999904633}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1864,"unrendered":172},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":148,"published":148},"chunks":95,"probeMs":2436.699999809265}
active Butter preflight {"ticks":10,"seen":4063,"visibleScrollers":1,"off":""}
23:19:00 [bisect-i1003-r8] rep 1: fps=44.6 p95=50.1 jank=5.1% busy=59.2% style=20% blocked=12.9s maxFreeze=2449 keyP95=294.8 keyMax=300.9 wheelP95=108 LoAF[renderSL=23.2s forcedSL=2.1s script=2.6s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1172 seenMarks=443 butter={"smootherFrames":386,"published":386} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4063,"visibleScrollers":1,"off":""}
```

```text
$ node /tmp/replay-blocking-work/bisect/check-seed.mjs /tmp/replay-blocking-work/bisect/builds/i1004/extension/shared/status.js
# UTC 2026-11-11T23:19:00.601327+00:00 -> 2026-11-11T23:19:00.633180+00:00; exit 0; 0.032 s
{"accepted":true,"seed":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}},"normalized":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true,"container":true,"cv":true,"throttle":true,"older":true,"rail":true,"seek":true},"lang":"en"}}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T23:19:00.639629+00:00 -> 2026-11-11T23:19:02.710044+00:00; exit 0; 2.07 s
chromium: stopped
chromium: started (pid 3016485)
```

```text
$ node /tmp/replay-blocking-work/bisect/harness/m2.mjs bisect-i1004-r9 1
# UTC 2026-11-11T23:19:06.211021+00:00 -> 2026-11-11T23:22:10.722362+00:00; exit 0; 184.511 s
storage seed {"version":"0.1.0-alpha.13","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
23:19:09 [bisect-i1004-r9] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":8859.200000286102}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1862,"unrendered":174},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":139,"published":139},"chunks":95,"probeMs":3974.5}
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
23:22:10 [bisect-i1004-r9] rep 1: fps=18.4 p95=266.6 jank=13.8% busy=86.1% style=61% blocked=65.9s maxFreeze=3983 keyP95=648.8 keyMax=678.3 wheelP95=369 LoAF[renderSL=67.7s forcedSL=6.7s script=3.9s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1157 seenMarks=438 butter={"smootherFrames":331,"published":331} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

```text
$ node /tmp/replay-blocking-work/bisect/check-seed.mjs /tmp/replay-blocking-work/bisect/builds/i2001/extension/shared/status.js
# UTC 2026-11-11T23:22:10.749485+00:00 -> 2026-11-11T23:22:10.781164+00:00; exit 0; 0.032 s
{"accepted":true,"seed":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}},"normalized":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true,"container":true,"cv":true,"throttle":true,"older":true,"rail":true,"seek":true},"lang":"en"}}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T23:22:10.785770+00:00 -> 2026-11-11T23:22:12.856778+00:00; exit 0; 2.071 s
chromium: stopped
chromium: started (pid 3020811)
```

```text
$ node /tmp/replay-blocking-work/bisect/harness/m2.mjs control-i2001-r1 1
# UTC 2026-11-11T23:22:16.362425+00:00 -> 2026-11-11T23:25:02.388535+00:00; exit 0; 166.026 s
storage seed {"version":"0.1.0-alpha.13","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
23:22:20 [control-i2001-r1] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":2932,"visibleScrollers":1,"off":""}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":6515.5}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1864,"unrendered":172},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":147,"published":147},"chunks":95,"probeMs":2500.1000003814697}
active Butter preflight {"ticks":10,"seen":2248,"visibleScrollers":1,"off":""}
23:25:02 [control-i2001-r1] rep 1: fps=43 p95=66.7 jank=6.2% busy=60.9% style=22.7% blocked=16.3s maxFreeze=2507 keyP95=293.2 keyMax=317.7 wheelP95=113 LoAF[renderSL=26.2s forcedSL=2.3s script=2.3s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1166 seenMarks=443 butter={"smootherFrames":385,"published":384} nodes=194487 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":2248,"visibleScrollers":1,"off":""}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T23:25:02.394930+00:00 -> 2026-11-11T23:25:04.467480+00:00; exit 0; 2.073 s
chromium: stopped
chromium: started (pid 3025296)
```

```text
$ node /tmp/replay-blocking-work/bisect/harness/m2.mjs control-i1004-r2 1
# UTC 2026-11-11T23:25:07.992476+00:00 -> 2026-11-11T23:28:05.678194+00:00; exit 0; 177.686 s
storage seed {"version":"0.1.0-alpha.13","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
23:25:11 [control-i1004-r2] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":8916.599999904633}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1861,"unrendered":175},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":141,"published":141},"chunks":95,"probeMs":3959.2000002861023}
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
23:28:05 [control-i1004-r2] rep 1: fps=18.1 p95=266.7 jank=14.2% busy=86.4% style=60.9% blocked=66.6s maxFreeze=3980 keyP95=695.7 keyMax=724.4 wheelP95=396 LoAF[renderSL=68.2s forcedSL=6.2s script=3.8s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1160 seenMarks=437 butter={"smootherFrames":332,"published":331} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T23:28:05.685215+00:00 -> 2026-11-11T23:28:07.757052+00:00; exit 0; 2.072 s
chromium: stopped
chromium: started (pid 3034337)
```

```text
$ node /tmp/replay-blocking-work/bisect/harness/m2.mjs control-i1004-r3 1
# UTC 2026-11-11T23:28:11.761221+00:00 -> 2026-11-11T23:31:07.650273+00:00; exit 0; 175.889 s
storage seed {"version":"0.1.0-alpha.13","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
23:28:15 [control-i1004-r3] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":2932,"visibleScrollers":1,"off":""}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":8816.700000286102}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1862,"unrendered":174},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":141,"published":141},"chunks":95,"probeMs":3965.2999997138977}
active Butter preflight {"ticks":10,"seen":2247,"visibleScrollers":1,"off":""}
23:31:07 [control-i1004-r3] rep 1: fps=17.7 p95=266.7 jank=14.5% busy=86.7% style=61.5% blocked=67.5s maxFreeze=3974 keyP95=1220.3 keyMax=1228.3 wheelP95=395 LoAF[renderSL=68.8s forcedSL=6.6s script=4.2s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1164 seenMarks=441 butter={"smootherFrames":330,"published":330} nodes=194549 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":2247,"visibleScrollers":1,"off":""}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T23:31:07.662798+00:00 -> 2026-11-11T23:31:09.734014+00:00; exit 0; 2.071 s
chromium: stopped
chromium: started (pid 3038375)
```

```text
$ node /tmp/replay-blocking-work/bisect/harness/m2.mjs control-i2001-r4 1
# UTC 2026-11-11T23:31:13.234969+00:00 -> 2026-11-11T23:33:56.999968+00:00; exit 0; 163.765 s
storage seed {"version":"0.1.0-alpha.13","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
23:31:17 [control-i2001-r4] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
selector probe {"phase":"before","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":54,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":103412,"type":"inline-size"}],"visibleCounts":{"turns":5,"answerRoots":5,"dilRoots":0,"turnStates":5,"seen":2932,"unrendered":0},"states":{"complete":5},"autoBlocks":2927,"off":"","butter":{"smootherFrames":0,"published":0},"chunks":0,"probeMs":6240.700000286102}
selector probe {"phase":"mid","oldMatches":2,"containers":[{"scope":"inside","tag":"DIV","classes":"ComposerLayoutFooter-_8IVRO AnimatedAdaptiveFooter-By8hrZ LegacyExpandableFooter-NDIzy0","subtreeElements":55,"type":"inline-size"},{"scope":"ancestor","tag":"DIV","classes":"MainContentFrame-sss8BP","subtreeElements":69543,"type":"inline-size"}],"visibleCounts":{"turns":4,"answerRoots":4,"dilRoots":0,"turnStates":4,"seen":1864,"unrendered":172},"states":{"complete":3,"in_progress":1},"autoBlocks":2041,"off":"","butter":{"smootherFrames":147,"published":147},"chunks":95,"probeMs":2399.199999809265}
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
23:33:56 [control-i2001-r4] rep 1: fps=45.1 p95=50.1 jank=5.2% busy=58.8% style=19.5% blocked=12.7s maxFreeze=2406 keyP95=252.5 keyMax=257.5 wheelP95=102 LoAF[renderSL=22.4s forcedSL=2s script=2.2s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1166 seenMarks=440 butter={"smootherFrames":385,"published":384} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner replay-blocking
# UTC 2026-11-11T23:33:57.004316+00:00 -> 2026-11-11T23:34:07.443005+00:00; exit 0; 10.439 s
restore lab 1: restarting browser (now {"pid":3038375,"extensions":["/home/simon/snap/chromium/common/replay-blocking-bisect-i2001"],"flags":["--disable-extensions-except=/home/simon/snap/chromium/common/replay-blocking-bisect-i2001"]}, cdp up, want {"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]})
chromium: stopped
chromium: started (pid 3042717)
restored {"lab":1,"restarted":true,"url":"<REDACTED_CHAT_URL>","composer":"","pages":["<REDACTED_CHAT_URL>"],"browser":{"pid":3042717,"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]},"at":"2026-11-11T23:34:06.844Z","ok":true}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner replay-blocking
# UTC 2026-11-11T23:34:07.443233+00:00 -> 2026-11-11T23:34:07.557087+00:00; exit 0; 0.114 s
{"lab": 1, "lab_released": true, "perf_released": true}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab-lock status
# UTC 2026-11-11T23:34:07.557219+00:00 -> 2026-11-11T23:34:07.621128+00:00; exit 0; 0.064 s
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

The runner read the first bad merge parents with git show and enumerated its branch commits with `git rev-list --reverse <merge>^1..<merge>^2 -- extension/`; all sampled SHAs are above. Attribution uses only saved raw observer data and public source-path lookup. `git diff --stat <parent> <bad> -- extension/` actual output:

```text
extension/seek/anchor-main.js       |  2 +-
 extension/seek/core-main.js         | 27 +++++++++++++++++++++++----
 extension/seek/layout-cache-main.js | 33 +++++++++++++++++++++++++++------
 extension/seek/layout-codec.js      |  4 ++--
 extension/seek/preview-main.js      |  4 ++--
 extension/shared/settings.js        |  5 ++++-
 extension/stream/containment.css    | 11 +++++++----
 extension/stream/offscreen.js       |  6 ++++--
 8 files changed, 70 insertions(+), 22 deletions(-)
```

### Git enumeration and source commands

```text
$ git log --first-parent --reverse --format=%h %s 37a2b45..a100fd6 -- extension/
c5e9af9 0.1.0-alpha.12: popup fits under Chrome's 600 px cap; language switch and GitHub move to the header's top-right, the version number opens the changelog (#12)
5e7cb0f Localize Butter's Chrome metadata in English and Simplified Chinese (#14)
e4a4eb5 0.1.0-alpha.13: bigger toolbar icon (#16)
cc12fe2 Merge pull request #19 from SimianW/t3/eslint
482a427 Merge pull request #22 from SimianW/t3/diagnostics-hooks
0560ae5 Merge pull request #24 from SimianW/t3/fix-scrollbar-preview-stuck
0a0dc28 Merge pull request #33 from SimianW/t3/fix-message-scrollbar-content
2b90cef Merge pull request #31 from SimianW/t3/ask-in-branch
f0cba43 Merge pull request #34 from SimianW/t3/release-alpha-15
ca4b186 Merge pull request #42 from SimianW/t3/popup-redesign-35
159a2b8 Merge pull request #48 from SimianW/t3/32-dev-bug-capture
9f72525 Merge pull request #60 from SimianW/t3/branch-handoff-sidebar
3b75e38 Merge pull request #61 from SimianW/t3/release-alpha-16
466483d Merge pull request #63 from SimianW/t3/fix-new-branch-confirmation
b29efc1 Merge pull request #64 from SimianW/t3/fix-branch-box-dictation
0c1183a Merge pull request #65 from SimianW/t3/release-alpha-17
0fd5b23 Merge pull request #58 from SimianW/t3/51-bookmarks
5d0bd2c Merge pull request #67 from SimianW/t3/drip-align
1488367 Merge pull request #68 from SimianW/t3/background-branch-creation
126f568 Merge pull request #75 from SimianW/t3/bookmark-dot-69
3c8f3fb Merge pull request #78 from SimianW/t3/bookmark-selection-77
86f95e5 Merge pull request #87 from SimianW/t3/page-reader-a
fd1ab4a Merge pull request #90 from SimianW/t3/page-reader-b
a100fd6 Merge pull request #91 from SimianW/t3/bookmark-session
```

```text
$ git show -s --format=%H%n%P%n%s 0560ae5
0560ae56b3f0d469c12aff3ae1a9ea7fd18774d4
7de8ea083e06c83e7200670bec38f6d244f0fca3 8b802bdcf603d9cc33ce6fba6927a07d9926a151
Merge pull request #24 from SimianW/t3/fix-scrollbar-preview-stuck
```

```text
$ git rev-list --reverse 0560ae5^1..0560ae5^2 -- extension/
527661845c40b62464b4a5e41a0c52afe032f7b6
318cd96e9d9ee00a23b78ff95e2c8576500eaba6
f5d6b9686bcdba1acf741ffe3ae0aaef21b0ee39
b5229ee18de3952777e659255bf67c23ae512e96
4780e17d5f043f9b6a8006f91c244426e7336476
c315410e80bcac8adf11a6572fd72b7e6991c443
d8247816f8a7a699a1a4dfd3c7ea8d512ae60f1a
f977a8868c6e385fa2ed9231e79009669bb145a5
12dd1fc9f3093c818ee2d0bb2db627cf05fc5e45
e61e9e369804196c041e04c5393953bd9a7f26cb
a987b016b587a0ad711193d5e6bde920951bebd0
```

```text
$ git rev-parse 0560ae5^1:extension 482a427:extension
5af9b54d580bb16284cd8797b3db380a31a53955
5af9b54d580bb16284cd8797b3db380a31a53955
```

### Bisect final verification

```text
$ python3 /tmp/replay-blocking-work/bisect/verify.py
{"withinBisectBudget": 1, "fourControls": 1, "chunks189": 1, "expectedAnswer": 1, "zeroWrites": 1, "zeroReplayEscapes": 1, "twoProbes": 1, "activeButter": 1, "interleavedControls": 1, "controlsSeparate": 1, "actualParent": 1, "restoreOk": 1, "releaseOk": 1, "labPerfReleased": 1, "statusUnchanged": 1, "branchUnchanged": 1, "headUnchanged": 1, "allBuildsEqualGitSha": 1, "allSeedsAccepted": 1, "alpha11GitEqualsRelease": 1, "m2.mjsEqualsControl": 1, "selectors.mjsEqualsControl": 1, "control-safety.mjsEqualsControl": 1, "allPass": 1}
removed only task-owned runtime extension copies after successful restore; raw captures retained
```

$ python3 /tmp/replay-blocking-work/bisect/export.py: bisect report, numeric data and actual command outputs exported.

### Bisect privacy scan

```text
$ python3 /tmp/replay-blocking-work/bisect/privacy.py
{"filesScanned": 20, "identifierNeedles": 111, "textFragmentNeedles": 308, "uuid": 0, "chatURL": 0, "email": 0, "privateEndpoint": 0, "challengePathSuffix": 0, "bearerCredential": 0, "tokenCredential": 0, "privateIdentifiers": 0, "capturedTextFragments": 0, "allJsonLeavesNumeric": 1, "passed": 1}
```
