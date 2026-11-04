| Arm | Metric | Runs | Actual values |
|---|---|---:|---|
| control | usedSize MiB | 3 | 176.2, 177.41, 179.46 |
| control | embedderHeapUsedSize MiB | 3 | 187.45, 193.37, 196.24 |
| control | backingStorageSize MiB | 3 | 35.08, 35.1, 35.06 |
| read-hook | usedSize MiB | 3 | 189.2, 188.63, 181.79 |
| read-hook | embedderHeapUsedSize MiB | 3 | 195.05, 202.78, 194.93 |
| read-hook | backingStorageSize MiB | 3 | 35.12, 35.14, 35.07 |
| control | Send question top px | 3 | 315, 315, 272 |
| read-hook | Send question top px | 3 | 292, 292, 272 |
| control | First-question rail | 3 | [{'turnTop': 64, 'questionTop': 116, 'pass': True}, {'turnTop': 64, 'questionTop': 116, 'pass': True}, {'turnTop': 64, 'questionTop': 116, 'pass': True}] |
| read-hook | First-question rail | 3 | [{'turnTop': 64, 'questionTop': 116, 'pass': True}, {'turnTop': 64, 'questionTop': 116, 'pass': True}, {'turnTop': 64, 'questionTop': 116, 'pass': True}] |
| read-hook minus control | Median usedSize delta MiB | 3 each | +11.22 |
| read-hook minus control | Median embedderHeapUsedSize delta MiB | 3 each | +1.68 |
| read-hook minus control | Median backingStorageSize delta MiB | 3 each | +0.04 |
