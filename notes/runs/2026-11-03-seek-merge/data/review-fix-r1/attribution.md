### Final-build timing probes

One additional base/fixed diagnostic pair per slower scrollbar cell, excluded from the A/B medians. All marks/wrappers live only in lab build copies. The readiness CPU column includes the final swap audit after the readable timestamp; it is an upper bound on the gate callback CPU, not a claim that all of it delays the gate. CDP durations also include 150 ms of post-gate observation.

| Bar | Build | Readable ms | Commit ms | First readiness frame ms after release | Readiness calls | Total readiness CPU ms | Largest frame gap ms | Text lookups |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| classic | base | 1016.9 | 16.4 | 791.5 | 5 | 12.2 | 174.5 | 0 |
| classic | fixed | 1046.5 | 17.2 | 813.6 | 5 | 13.3 | 173.0 | 0 |
| overlay | base | 1155.2 | 14.9 | 929.8 | 5 | 10.4 | 185.2 | 0 |
| overlay | fixed | 1122.1 | 14.3 | 807.6 | 6 | 15.3 | 213.4 | 0 |

| Bar | Build | CDP task ms | Script ms | Layout ms | Style ms |
|---|---|---:|---:|---:|---:|
| classic | base | 1051.1 | 584.0 | 46.6 | 301.1 |
| classic | fixed | 1080.6 | 604.7 | 48.4 | 308.3 |
| overlay | base | 1198.3 | 700.0 | 55.6 | 321.2 |
| overlay | fixed | 1171.7 | 631.6 | 66.2 | 332.6 |

Recorder CPU during the measured window (including post-gate observation):
- classic base: 20.7 ms; fingerprint timing: `{}`.
- classic fixed: 20.1 ms; fingerprint timing: `{'calls': 2, 'ms': 11.999999761581421, 'max': 8.599999904632568}`.
- overlay base: 21.1 ms; fingerprint timing: `{}`.
- overlay fixed: 49.7 ms; fingerprint timing: `{'calls': 2, 'ms': 14.5, 'max': 11.200000047683716}`.

The native destination commit is early; most wall time follows dispatch while the application mounts/typesets the destination and delivers readiness frames. Compare the callback CPU, large frame gaps and CDP layout/style/script totals above. No semantic destination lookup remains on the final aligned warm path. These one-pair timing probes locate elapsed work; they do not establish statistical causation for the small A/B median differences.
