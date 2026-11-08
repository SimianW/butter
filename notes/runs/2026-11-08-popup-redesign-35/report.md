# Popup and consent card redesign (#35): built states against the approved mockup

Build: `t3/popup-redesign-35` at `bbfcc74` (0.1.0-alpha.15 plus the #35 tickets). The mockup is the
`Mockup` artifact on issue #35 (`gh issue artifact download 35 1 -R SimianW/butter`). Both harnesses
start their own headless Chromium on a synthetic page and send no ChatGPT requests.

## Popup

`BUTTER_REDESIGN_MOCKUP=<mockup> BUTTER_REDESIGN_SIDE=after node lab/harness/popup-qa.mjs`

A panel passes when its height equals the built popup's and fewer than 0.1% of its pixels differ by
more than 24 in any channel. The version label and the storage line are masked.

| Panel | Built state | Height built/panel | Pixels differing | Built | Mockup |
|---|---|---|---|---|---|
| default | 13-en-branch-on-light | 522/522 | 0.004% | [png](popup/13-en-branch-on-light.png) | [png](popup/mockup-default.png) |
| paused | 10-en-paused-light | 522/522 | 0.000% | [png](popup/10-en-paused-light.png) | [png](popup/mockup-paused.png) |
| rail fault | 19-en-rail-fault-light | 554/554 | 0.003% | [png](popup/19-en-rail-fault-light.png) | [png](popup/mockup-rail-fault.png) |
| layouts pending | 20-en-layouts-pending-light | 551/551 | 0.004% | [png](popup/20-en-layouts-pending-light.png) | [png](popup/mockup-layouts-pending.png) |
| clear confirm | 21-en-clear-confirm-light | 522/522 | 0.003% | [png](popup/21-en-clear-confirm-light.png) | [png](popup/mockup-clear-confirm.png) |
| branch off | 14-en-branch-off-light | 522/522 | 0.003% | [png](popup/14-en-branch-off-light.png) | [png](popup/mockup-branch-off.png) |
| branch fault | 15-en-branch-failed-light | 554/554 | 0.004% | [png](popup/15-en-branch-failed-light.png) | [png](popup/mockup-branch-fault.png) |
| dark | 13-en-branch-on-dark | 522/522 | 0.000% | [png](popup/13-en-branch-on-dark.png) | [png](popup/mockup-dark.png) |
| Chinese | 16-zh-branch-on-light | 522/522 | 0.003% | [png](popup/16-zh-branch-on-light.png) | [png](popup/mockup-zh.png) |

The same run builds all 24 states in both themes, and every one is at most 600 px tall. The worst case has four groups
failing plus the consent note: 551 px in English ([png](popup/23-en-all-faults-pending-light.png)) and 535 px in
Chinese ([png](popup/24-zh-all-faults-pending-dark.png)). With two or more faults, each failing row shows the one-line
text "Unavailable; resumes on its own." / "暂时不可用，Butter 会自动恢复。", a decision taken in review because the
full text pushed this state to 681 px. The mockup has no panel for it.

## Consent card

`BUTTER_CONSENT_MOCKUP=<mockup> node lab/harness/consent-qa.mjs`

| Panel | Pixels differing | Built | Mockup |
|---|---|---|---|
| light, English | 0 | [png](consent/consent-light-en-built.png) | [png](consent/consent-light-en-after.png) |
| dark, Chinese | 0 | [png](consent/consent-dark-zh-built.png) | [png](consent/consent-dark-zh-after.png) |

## Limits

- Light and dark tokens follow #35's token list where the mockup disagrees with it: the dark line is `.14`, not `.16`, and the light track is
  `#e3dac3`, not `#efe8d6`. Neither difference reaches the pixel threshold.
- Linux headless Chromium only; no live ChatGPT page and no Windows or macOS font rendering.
