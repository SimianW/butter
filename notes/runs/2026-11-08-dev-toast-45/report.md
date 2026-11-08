# Dev build toast (#45): every bug save shows a toast on the page

Build: `t3/45-toast` at `dd880dc` (on the #32 integration branch at `b645889`), packaged with
`python3 scripts/package.py --dev` as `0.1.0-alpha.15+dev.8`. The run used Playwright's Chromium
156.0.8078.4 on Linux under Xvfb.

`BUTTER_DEV_MOCKUP=<#32 mockup> OUT=notes/runs/2026-11-08-dev-toast-45 xvfb-run -a node lab/harness/dev-capture-qa.mjs`

The mockup comes from `gh issue artifact download 32 1 -R SimianW/butter`. The harness is the #43
fixture run (see [dev-capture-43](../2026-11-08-dev-capture-43/report.md)): a synthetic nine-turn
chat, real Alt+Shift+B presses through XTest, and no ChatGPT requests. The run recorded no foreign
requests and no page errors.

## Steps and results

| Step | Toast |
|---|---|
| Drag, release, press the shortcut (bug-01) | "Bug 1 saved / last 30 s · round 1" |
| Drag, press the shortcut while holding the thumb (bug-02) | "Bug 2 saved / last 30 s · round 1". It replaced bug-01's toast, which was still showing, so the page held one toast, not two. The pointer was still held under it. |
| Keep dragging, then release | The same seek session, ended by `pointerup`: the toast didn't interrupt the drag |
| Press on `https://other.test/` and on ChatGPT's home page | No toast (nothing saved) |
| Back on the chat, press (bug-03) | "Bug 3 saved / last 30 s · round 1", on the page for 2000 ms, then removed |

Each toast reported `pointer-events: none` on its host. `elementFromPoint` at its centre did not
hit it. `document.activeElement` was the same element before and after the save.

## Against the mockup

With the round state set to round 2, bug 3, one more save shows "Bug 4 saved / last 30 s · round 2",
as in the mockup's panels. That save ran once on the light chat and once with the page's `dark`
class. Each crop is the toast plus 16 px left and above and 8 px right, down to the bottom of the
page. It was compared with the same crop of the `toast-light` and `toast-dark` panels. The panels'
sketched chat and scrollbar were hidden first, because the fixture page is blank behind the toast.
Before that change, the dark panel's sketched chat line (`#3a3a3a` on `#212121`) made up the whole
1.6% difference, while the toast's pixels already matched.

| Panel | Toast box (built / mockup) | Pixels differing by more than 24 |
|---|---|---|
| `toast-light` | 156.61 × 55.73 / 156.61 × 55.73 | 0 |
| `toast-dark` | 156.61 × 55.73 / 156.61 × 55.73 | 0 |

Screenshots: [light built](screenshots/toast-light-built.png),
[light mockup](screenshots/toast-light-mockup.png), [dark built](screenshots/toast-dark-built.png),
[dark mockup](screenshots/toast-dark-mockup.png). The other files are the run's
[bug-01](bug-01_05-29-51.json), [bug-02](bug-02_05-29-53.json) and [summary](summary.json). They
come from a synthetic page and contain no private data.

## Not covered here

- Chinese on a real page. The unit test (`test/dev-toast.test.js`) covers the Chinese text, and
  the mockup is English only.
- A real ChatGPT page, a Mac and the popup's save button (#46). These belong to #47.
