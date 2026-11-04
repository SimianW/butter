> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Visual release notes: prior art and examples for Butter

Research date: **2026-11-03**. Scope: research only. No skill was written; no repository, branch, release, or GitHub comment was changed.

## Ranked top 5 things to copy

1. **Bun’s small, concrete before/after benchmark story.** Put the user action in the title, show the previous and current version with exact durations, and keep the result table beside the graphic. Bun 1.2’s cached-install graphic and the `postMessage` article are the closest editorial models for Butter. Copy the clarity, while improving scale labeling and avoiding mixed-unit bars. [E1] [E2]
2. **Basic Memory’s evidence pack before image generation.** Record the source diff, actual outcomes, and a discard list for reverted or unsupported claims. Its Codex skill explicitly covers changelog/release images. Borrow that discipline, rather than its preference for decorative artwork. [A3]
3. **GitHub Awesome Copilot’s Visual PR capture and annotation components.** These already cover Playwright screenshots, precise crops, callout arrows, and annotated GIFs; their README explicitly includes release notes. Add identical fixtures and before/after capture settings from `change-preview`. [A1] [A4]
4. **Astral’s compact, theme-aware benchmark charts, exported as portable images.** Astral’s actual SVGs contain zero-based axes, units, values, and dark-mode label colors. For GitHub releases, borrow the visual design and export separate light/dark PNGs using the documented Playwright screenshot and color-scheme APIs. Keep source data and use version-pinned asset URLs. [E3] [E4] [T12] [T13] [P4]
5. **One featured improvement, then a readable changelog.** Linear explains selected UI changes with tightly cropped screenshots; VS Code places focused demos next to the relevant subsection. Give Butter’s largest user-visible change one graphic, with minor fixes as text. Avoid turning every maintenance change into a slide. [E6] [E8]

## Findings and verification boundaries

**I found several real visual-changelog/release-image skills and plugins, but did not find one implementing Butter’s exact end-to-end workflow:** read the canonical `CHANGELOG.md`, select supported user outcomes, render measured before/after charts or diagrams from HTML through Chromium into matched light/dark PNGs, commit them at the release ref, and embed them in GitHub release bodies with `<picture>`.

That is a search finding, not proof that no such skill exists anywhere. The closest matches are listed below. Important distinction: some produce a visual report *about code changes*, others generate *release artwork*, and others capture *actual UI evidence*. None of those alone establishes that an optimization is faster.

Primary files and pages were opened directly over HTTP and archived under `sources/`; `source-manifest.json` records requested/final URLs, HTTP results, sizes, and, for most fetches, hashes. Repository skill instructions were read as research material, not executed. Tool capabilities below mean “documented in the opened source”; I did not install or run the tools. Search snippets were discovery only. A broken candidate is identified explicitly below.

The supplied Butter/GitHub facts are accepted without re-testing: releases come from `CHANGELOG.md`; `<picture>`, images, and tables survive release-body sanitization; CSS/script/class/style do not; Mermaid fences are not rendered there. Those release-specific claims come from the task’s verified draft-release experiment, not an inference from README rendering.

## 1. Existing skills, prompts, plugins, and automation

### AI-agent prior art

| Prior art and primary source | What it actually does | Visual output? | What Butter could borrow / limit |
|---|---|---|---|
| **Awesome Copilot: Visual PR** [A1], plus its screen-recording skill [A1a] | Bundles `ui-screenshots`, `image-annotations`, `pr-screenshots`, and `screen-recording`; captures UI, adds arrows/labels, embeds before/after images in PR descriptions. Explicitly lists release-note GIF demos as a use case. | **Yes:** cropped screenshots, annotations, animated GIFs. | Strongest reusable capture/annotation components. A PR workflow, not a measured benchmark or release packaging pipeline. Its publishing actions would need separate scope. |
| **Awesome Copilot: Release Notes Showcase** [A2] [A2a] | Interactive release-notes composition/review canvas. Source schema includes hero stats, feature/improvement sections, metric strings, contributors, and other changes. `export_email` returns email-ready HTML/text; `get_release_snapshot` returns state. | **Yes:** designed HTML cards, stats, contributor avatars. **No chart/PNG renderer documented in the inspected schema/export path.** | Structured intermediate data and preview/export separation. Do not assume its HTML/email export can be pasted into GitHub unchanged. This is an actual release-notes extension, not merely an ordinary prose prompt. |
| **Basic Memory `.agents/skills/infographics`** [A3] | Codex-oriented skill explicitly for PR, changelog, release, and weekly images. Requires an evidence pack, impact ledger, discarded misleading/reverted work, and canonical asset paths; uses image-generation helper scripts. | **Yes:** generated WebP illustrations/posters/scenes; charts may appear as props. | Closest release-image skill found. Copy provenance, source selection, file verification. Its own guidance prefers image-first editorial artwork, so it is a poor default for exact quantitative charts. |
| **Steve Harrison `change-preview`** [A4] | Builds a one-page HTML review from a spec, before/after screenshots with arrow callouts, reproduce steps, optional video, and annotated diff sections. Requires matching URL, viewport, scroll, and fixture data. | **Yes:** screenshots, callouts, optional video, standalone HTML. | Best comparison discipline; JSON spec plus deterministic builder. Output targets code review; no release-note PNG/theme/tag workflow is documented. |
| **WebifyServices `visual-changelog` Claude Code plugin** [A5] | Inspects feature-branch diffs/history, discovers and runs tests, writes schema-validated JSON entries, and displays them in a React viewer. Includes KPI cards, change-density treemap, test counts, file reasons, optional Mermaid. | **Yes:** interactive report and diagrams. | Schema validation, stable entry history, and separating collection from presentation. File counts and lines changed are developer metrics, not Butter’s user benefit. Its Mermaid viewer does not solve GitHub release rendering. |
| **Stack Auth/hexclave `pr-visual-writeup`** [A6] | Captures screenshots and scrolling animations across page/theme/viewport combinations; converts recordings to GIFs, hosts assets in a gist, writes a rich PR body. | **Yes:** light/dark screenshots, before/after tables, GIFs. | Theme/viewport matrix, labeling annotations, and asset manifest. Gist hosting and automatic PR mutation are optional workflow decisions, not requirements for Butter. Its stash/checkout recipe should not be copied blindly into a dirty worktree. |
| **nicobailon `visual-explainer`** [A7] | Produces self-contained HTML explanations for systems, code changes, comparisons, data, plans, and other topics; includes diagram/data-visualization guidance and rendering checks. | **Yes:** HTML/SVG figures and charts; other media paths also documented. | Visual grammar and HTML-as-source. It is a general explainer, not an exact release-notes automation. Prefer measured chart data over a blanket “visualize every number” rule. |
| **PlanetScale’s first-party Cursor changelog command** [A8] | Published real command instructions: write a short Markdown changelog entry from existing docs, follow repository conventions, link docs, include screenshots for UI features if available. | **Supports existing screenshots; does not document generating benchmark charts.** | Practical editorial recipe: benefit first, a few paragraphs, UI screenshots, repo-native Markdown. Stronger verified Cursor precedent than the dead search result below. |
| **Composio community `changelog-generator`** [A9] | Converts git history into categorized, customer-facing Markdown; filters internal noise and follows local style. | **Text-first.** No visual capture/chart generation documented. | Selection, grouping, and user language. The illustrative “faster sync” sample is not measurement evidence. |
| **Anthropic official Agent Skills catalog** [A10] [A10a] [A10b] [A10c] | Inspected complete tree at commit `ca45fc496a3436251f191354091d557da31c15b5`. No dedicated visual release-notes skill appears in that catalog. `canvas-design` creates PNG/PDF artwork; `webapp-testing` documents Playwright screenshots; `slack-gif-creator` builds/validates GIFs for Slack. | **Yes, separate building blocks.** | Screenshot mechanics and validation are useful. Slack limits and art-oriented design instructions do not establish GitHub release constraints or benchmark accuracy. |
| **Awesome Copilot Octopus Deploy release-notes MCP agent** [A11] | Reads deployment/release/commit information through Octopus MCP and GitHub, then summarizes relevant commits into Markdown lists. | **Text output documented.** | MCP can supply evidence/context. This recipe does not capture or render visuals. |
| **Microsoft Playwright MCP** [A12] | Browser automation MCP server with screenshot/browser tools, including configurable screenshot output. | **Yes:** screenshot files from browser content. | Rendering/capture access for an agent. It supplies browser operations, not release-note selection, benchmark methodology, or publication policy. |

**Unverified/dead candidate:** search indexed `kscius/KS-Cursor-Orchestrator/skills/screenshotting-changelog/SKILL.md` with a promising before/after Cursor screenshot workflow, but both its GitHub page and raw file returned **404** during this research. It is not counted as verified usable prior art. Discovery URL: <https://github.com/kscius/KS-Cursor-Orchestrator/blob/main/skills/screenshotting-changelog/SKILL.md>.

**Codex / AGENTS.md / Cursor / Copilot coverage:** Basic Memory is an actual `.agents/skills` Codex example; PlanetScale supplies an actual Cursor command; Awesome Copilot supplies plugins/skills and an MCP-backed agent. I did not find and verify a standalone `AGENTS.md`, Cursor rule, or Copilot instruction that performs the entire Butter pipeline. The explicit skill/plugin precedents are substantially closer than generic “generate a changelog” rules.

### Non-AI release-note automation

Here “no visuals” means **no image capture or chart generation is documented by the opened source**, not “cannot contain a hand-authored image link.”

| Tool / primary source | Function | Visual generation? | What to borrow |
|---|---|---|---|
| **release-please** [T1] | Conventional Commit history → release PRs, version/changelog updates, GitHub releases. | No built-in visual generation documented. | Stable release boundaries and canonical change selection. Butter already has a release source; introducing another versioning engine is unnecessary for the visual goal. |
| **Changesets** [T2] | Contributors declare changes/release intent; tooling updates versions/changelogs and handles publishing. | No built-in visual generation documented. | Human-written intent before final formatting, especially valuable when commits are too technical. |
| **semantic-release release-notes-generator** [T3] | Generates notes from commits since the last release through conventional-changelog; exposes writer options/templates. | Text/template output; not chart/screenshot capture. | A renderer hook can link prebuilt assets, but cannot invent valid performance evidence. |
| **git-cliff** [T4] | Git-history changelog generation with Conventional Commits/custom parsers and configurable templates. | Text templating; no chart renderer documented. | Most flexible lightweight option if an existing release process needs a predictable asset-reference template. |
| **Release Drafter** [T5] | Accumulates draft release notes as PRs merge, using configurable categories, templates, and substitutions. | No image generation documented. | Headline-plus-details template, categories, and pre-authored image links. Do not replace a curated `CHANGELOG.md` accidentally. |
| **GitHub auto-generated notes** [T6] | Merged PR list, contributor list, full-changelog link; configurable labels/categories/exclusions. | No visual generation documented. | Completeness check against omitted PRs; poor source for an unsupported performance claim. |

### Benchmark reporting and visual evidence

| Tool / primary source | Actual capability | Visuals and limitations | What to borrow |
|---|---|---|---|
| **github-action-benchmark** [T7] | Parses benchmark outputs, persists results, compares history, can alert/fail on regression. Supports custom larger/smaller-is-better JSON data. | **Charts on GitHub Pages**, plus reporting/alerts; no ready-made release-note PNG export documented. | Machine-readable numbers, direction of improvement, historical baselines. Good evidence storage; take a deliberately selected release snapshot rather than pointing old notes at a changing chart. |
| **CodSpeed** [T8] [T8a] [T8b] | CI/local performance measurement, base/head comparisons, PR reports/checks, performance metrics. Profiling docs show base/head/diff flamegraphs and execution traces. | **Yes:** report UI and flamegraphs. No automatic themed GitHub release PNG bundle documented. | Baseline identity, per-benchmark comparisons, profiling evidence. Distinguish simulated CPU metrics from browser wall-clock latency; do not equate instruction measurements with ChatGPT send duration. |
| **Bencher** [T9] [T9a] | Historical branch/testbed baselines, regression thresholds, GitHub checks/PR comments. Changelog documents plot capabilities. | **Yes:** performance plots. **Current-source pitfall:** its `v0.6.15` changelog explicitly removes the perf-image endpoint and MCP `perf_image` tool, recommending public perf-page plot embedding instead. | Record testbed, branch/ref and thresholds. Do not design the skill around a stale direct-PNG API; public web embedding also does not imply GitHub supports an iframe. |

### Screenshot/GIF generation and changelog websites

| Tool / primary source | Actual capability | Visual output? | What to borrow |
|---|---|---|---|
| **Playwright** [T12] [T13] | Page/full-page/element screenshots; screenshots support clipping and format settings; browser emulation supports light/dark color schemes. | **PNG screenshots of rendered HTML/UI.** | Best fit for Butter’s proposed HTML → Chromium → PNG path. Render both themes from one data/source file, wait for fonts/images, capture the chart element. |
| **Charm VHS** [T10] | Script terminal sessions as `.tape` files; control commands, timing, theme, size; output GIF, MP4, WebM, and PNG frame sequences; CI use documented. | **Yes:** deterministic terminal demos. | Demo-as-code, reproducible dimensions/theme, short focused recordings. It records terminals, not the ChatGPT web UI. Artificial typing/sleep/playback timing is not a benchmark. |
| **asciinema + agg** [T11] [T11a] | asciinema records terminal sessions for replay; agg converts recordings to GIFs with timing/theme/font controls. | **Yes, with agg for portable GIF.** An asciicast is not itself an image. | Store editable recording source plus final GIF. External players need a link; a JavaScript player cannot run in a release body. |
| **Terminalizer** [T14] | Records terminal sessions, renders animated GIFs; editable frames/delays and font/color/frame settings. | **Yes:** GIF. | Repeatable short CLI demos; keep playback timing separate from real performance claims. |
| **Mintlify Update/changelogs** [T15] [T15a] | MDX `Update` timeline with dates, tags, images/demos, navigation and RSS. Docs warn RSS excludes components/code/HTML and offers alternate RSS text. | **Displays supplied visual media**, not evidence generation. | One benefit/entry, date, media, concise explanation, text fallback. A website component does not translate into permitted GitHub HTML. |
| **Docusaurus blog** [T16] | Markdown/MDX posts with dates, authors, tags, summaries/truncation, and feeds. | **Can publish authored visual content**; no automatic release chart capture documented. | Versioned, repo-owned editorial source if a separate changelog site becomes useful. Larger website migration is not required for Butter. |
| **Linear, Raycast, Vercel product changelog pages** [E8] [E9] [T17] | First-party editorial examples: media-led feature stories with readable update text. | **Yes, authored visuals on web pages.** No reusable generator established by these pages. | Treat them as presentation references, not tools claiming to automate evidence or render GitHub releases. |

## 2. Nine strong, real visual release-note/changelog examples

All nine main example URLs below were opened successfully (**HTTP 200**). Hosting is based on the actual page markup or fetched asset, not a guess from the product name. “Dark mode” separates the **page theme** from whether the **visual itself changes**. Where a browser behavior was not tested, that is explicit.

### E1. Bun 1.2 — closest simple before/after performance card

- **Opened:** <https://bun.sh/blog/bun-v1.2>.
- **Visual technique:** multiple task-specific performance graphics. The `bun install` section shows cached-install durations for Bun 1.2 and 1.1, alongside other package managers, with a short workload caption. The graphic labels the two Bun results as $46\,\mathrm{ms}$ and $61\,\mathrm{ms}$. [E1]
- **Hosting:** the actual cached-install chart is a GitHub user attachment: <https://github.com/user-attachments/assets/<id>> (fetched and visually inspected). The page also includes other GitHub attachments and a GIF at `bun.sh/bun-s3-node.gif`.
- **Dark mode:** page CSS explicitly defines light/dark variables using `prefers-color-scheme`; the sampled chart is one fixed dark-background PNG, with no alternate `<picture>` source. Page support does not make its pixels theme-aware. [E1css]
- **Copy:** user action as title, old/new version names, large exact numbers, short workload subtitle. For Butter, keep just its two versions when cross-product comparison adds no useful context.
- **Do not copy blindly:** tiny fast bars with large rounded corners/minimum widths can obscure proportionality; a “faster” percentage can mean a throughput increase rather than a duration reduction. State the metric explicitly.
- **GitHub bridge:** I also opened the real Bun 1.2 GitHub release. Its body contains a linked YouTube thumbnail and sends readers to the blog; it does **not** contain all the blog’s benchmark graphics. Do not claim that this blog is the release body. [E1gh] [E1api]

### E2. Bun `postMessage(string)` — result table plus an explanation of the optimization

- **Opened:** <https://bun.sh/blog/how-we-made-postMessage-string-500x-faster>.
- **Visual technique:** a large labeled performance/memory comparison card, followed by an HTML table covering three string sizes and exact versioned timings. The prose explains the conditional fast path and which strings still require serialization. This is a shipped-optimization deep dive, rather than a full changelog. [E2]
- **Hosting:** first-party static WebP: <https://bun.sh/images/bun-postmessage-node.webp> (fetched and visually inspected).
- **Dark mode:** page uses the same theme-aware Bun stylesheet; the card remains a fixed dark raster image. [E1css]
- **Copy:** put scope/conditions and a values table next to a striking headline; explain why the common operation improves in a short follow-up paragraph.
- **Do not copy:** its card places latency bars and memory bars beside each other without separately labeled numeric axes. Butter should use two distinct panels/scales for distinct units. The article does not establish every hardware/sample-size detail required for a new Butter benchmark; do not reuse its headline multiplier as evidence about another workload.

### E3. Astral uv launch — compact zero-based charts that adapt to theme

- **Opened:** <https://astral.sh/blog/uv>.
- **Visual technique:** horizontal bars with directly printed values, seconds on the numeric axis, zero baseline, tool names, and separately explained resolution/installation/cache scenarios. The page adapts layout for different widths. [E3]
- **Hosting:** benchmark figures are **inline SVG markup in the first-party page**, not GitHub attachments or screenshot PNGs. Actual SVG axis labels include `0s`, `1s`, etc. The source link points to uv’s benchmark documentation. [E3] [P3]
- **Dark mode:** **verified in the chart markup**: inline SVG `<style>` has a `prefers-color-scheme: dark` rule switching benchmark-label fill from `#333` to `#fff`. Thus the figures themselves adapt on that website.
- **Copy:** small horizontal charts with explicit numbers and a benchmark-source link; separate cold/warm cases. Export this design to PNG for GitHub rather than copying inline SVG/CSS into a sanitized release body.
- **Caveat:** current `BENCHMARKS.md` documents machine/runtime assumptions, filesystem/caching caveats and reproduction scripts; it is a living document. Its current environment must not be retroactively attributed to every number in the original launch article. [P3]

### E4. Astral Ruff formatter launch — speed plus compatibility context

- **Opened:** <https://astral.sh/blog/the-ruff-formatter>.
- **Visual technique:** a compact horizontal benchmark chart showing formatter times and a terminal GIF demonstrating formatting real projects. The text names the workload and cache condition and discusses Black compatibility. [E4]
- **Hosting:** chart is **inline SVG**; the GIF is first-party Next.js-served media, visible in HTML as a `/_next/image?...format-workspace...gif...` URL. It is not a GitHub attachment.
- **Dark mode:** chart SVG explicitly changes label color through `prefers-color-scheme`; no alternate light/dark terminal GIF was found in the inspected markup.
- **Copy:** put the performance result beside reassurance about retained behavior. For Butter, a speed improvement can sit beside a short statement of what was tested to remain usable, without turning correctness into an unsupported absolute promise.

### E5. Deno 2 — benchmark panels and reproducibility/correction notes

- **Opened:** <https://deno.com/blog/v2.0>.
- **Visual technique:** package-install timing graphic, short demos, a monorepo illustration, a release-support timeline, and a grid of nine benchmark panels. Panels name the metric, print values, and say whether higher/lower is better. Sources appear underneath individual panels. [E5]
- **Hosting:** first-party static files beneath `/blog/v2.0/`, e.g. <https://deno.com/blog/v2.0/deno-perf-charts-3x3.png> (fetched and inspected), plus `.mp4` demos.
- **Dark mode:** the sampled benchmark grid is a fixed white-background PNG, with no theme-specific alternative in the inspected page. The fetched stylesheet contains a `.dark` rule, but automatic page-level dark-mode behavior was **not verified**. [E5css]
- **Copy:** metric/direction/source per panel and a visible correction policy.
- **Critical caveat:** the live article explicitly corrects its first HTTP benchmark: it used Deno 1.45, and Deno 2.0 is about 20% slower than that plotted figure because pointer compression was disabled. This is not a clean Deno-2 measurement to reproduce as-is. Butter should record version/commit identity and preserve corrections. Also split a large multi-panel image into separate cards for GitHub’s narrow column.

### E6. VS Code 1.95 — focused demos beside feature explanations

- **Opened:** <https://code.visualstudio.com/updates/v1_95>.
- **Visual technique:** screenshot/video immediately after the relevant change; explicitly labeled old/new Chat locations; separate screenshot examples for panel labels on/off; focused recordings for behavior that needs motion. [E6]
- **Hosting:** first-party version-scoped static assets under `/assets/updates/1_95/` (and a deliberately reused older asset under `1_93`). Examples: `chat-new-location.png`, `chat-old-location.png`, `panel-showLabels-on.png`, `panel-showLabels-off.png`, and MP4 demos. The inspected page does not expose a repository/raw hosting URL for these assets.
- **Dark mode:** page script applies `data-theme` based on `prefers-color-scheme`. The sampled screenshots/videos are fixed files; no paired sources were found for them.
- **Copy:** title, one explanatory paragraph, one cropped example; version-scoped asset organization. Use a GIF/static fallback or a linked recording when moving a web demo to GitHub, where the site’s video controls/HTML are a different environment.

### E7. Chrome DevTools 130 — annotated before/after composites

- **Opened:** <https://developer.chrome.com/blog/new-in-devtools-130>.
- **Visual technique:** overlapping old/new UI screenshots with strong blue outlines/arrows that connect moved controls. Several image alt texts explicitly say “Before and after …”, including network filters, HAR export options, and scroll-overflow badges. [E7]
- **Hosting:** first-party versioned article assets under `/static/blog/new-in-devtools-130/image/`, with responsive resolution variants via `srcset`. Sample: <https://developer.chrome.com/static/blog/new-in-devtools-130/image/new-network-filters.png> (fetched and visually inspected).
- **Dark mode:** page includes Google’s `dark-theme.css`; no theme-swapped screenshot assets were observed. Exact runtime selection was not browser-tested.
- **Copy:** one or two arrows pointing to the actual changed element, tight crop, and alt text that explains the before/after relationship. This is the best annotation reference, even though the specific examples are UI rather than performance changes.

### E8. Linear — “Welcome to the new Linear”

- **Opened:** <https://linear.app/changelog/2024-03-20-new-linear-ui>.
- **Visual technique:** a sequence of isolated screenshot compositions for the sidebar, navigation headers, inbox, and new themes. Each image follows a short explanation of hierarchy, density, or contrast. The theme image shows both light and dark product UI. [E8]
- **Hosting:** content-addressed images on the external first-party asset CDN `https://webassets.linear.app/images/ornj730p/production/…`, e.g. the sidebar image has a hash-and-dimensions filename ending `3312x2484.png`, with `q`, `auto=format`, and `dpr` parameters. CDN address is established; underlying storage provider is not inferred.
- **Dark mode:** returned HTML declares `data-theme="dark"` and contains theme-selection script using system preference. The screenshot URLs are fixed; showing both product themes within one composition is distinct from swapping image sources.
- **Copy:** one concrete benefit per crop. A diagram or screenshot should teach the user where to look and what becomes easier, without demanding a full-screen comparison hunt.

### E9. Raycast 1.80.0 — one featured visual, then compact improvements

- **Opened:** <https://www.raycast.com/changelog/1-80-0>.
- **Visual technique:** a large “Window Layout Improvements” header image showing relevant app/target-selection UI, a short explanation, and a few concrete additions, followed by concise area-prefixed improvement/fix entries. [E9]
- **Hosting:** the article’s image is a PNG served by `https://releases.raycast.com/user-attachments/<id>` (fetched and inspected). Despite the path name, the host is Raycast’s release domain, not `github.com/user-attachments`.
- **Dark mode:** fetched page CSS explicitly sets `color-scheme: dark`; the hero is a fixed dark PNG. A light theme or image-switching implementation was **not verified**. [E9css]
- **Copy:** one featured update plus scannable, area-prefixed minor changes. For Butter, make the headline visual an explanatory result rather than just a decorative title card.

### Candidates investigated but not promoted as chart examples

- **Vite 8 announcement:** <https://vite.dev/blog/announcing-vite8> opened successfully. It has clear before/after build-time outcomes and architecture explanation, but the inspected article’s image list contains only a release cover. It is good source material for a chart, not an example of a benchmark chart already on that page. [N1]
- **Biome v2 announcement:** <https://biomejs.dev/blog/biome-v2/> opened successfully. Useful caveats about type-inference coverage and scanner overhead; the inspected article has themed banners, logos, avatars, and a celebratory GIF, rather than the benchmark comparison chart this task seeks. [N2]
- **Vercel changelog:** <https://vercel.com/changelog> opened successfully as a website-layout reference. A changing index is less useful than the specific, durable entries above for teaching a future skill. [T17]

## 3. Best practices for a Butter visual-release skill

These are **recommendations derived from the verified examples and guidance**, not a claim that an off-the-shelf tool already enforces them. This section is not a skill implementation.

### Choose the visual by the user question

| User question / change | Appropriate visual | Keep as text |
|---|---|---|
| “How much less time do I wait after pressing Send?” | Two horizontal duration bars with exact old/new values, scenario title, and “lower is better.” | Minor fixes unrelated to the timing. |
| “Why does sending from far up the chat improve?” | Small before/after flow or timeline, using only verified stages; distinguish a conceptual explanation from measured time. | Internal function names unless needed to explain a user-visible condition. |
| “Did the visible behavior change?” | Matching cropped screenshots; short annotated GIF only when motion/sequence matters. | Version bump, dependency maintenance, or an invisible refactor with no established user impact. |
| “How does it scale as chats grow?” | Line/scatter chart across defined conversation sizes, with repeated-run summaries and uncertainty. | A trend claim based on only one chat length. |
| “Which users benefit, and under what conditions?” | Usually a one-sentence scope statement; a small table if several scenarios differ. | Decorative art that does not answer a question. |

The useful precedents are Bun’s task-specific result cards, Astral’s compact graphs, DevTools’ callouts, and `change-preview`’s matching-fixture rules. [E1] [E2] [E3] [E4] [E7] [A4]

### Chart honesty and benchmark provenance

- **For bars, start the quantitative axis at zero.** Use one scale for before/after; print units and precise values, and say “lower is better” for durations. The UK Analysis Function guidance explicitly warns against broken bar-chart baselines. A line chart may use a clearly labeled nonzero range if that is necessary to show a trend; that is a different encoding. [P1]
- **Keep metrics separate.** Duration, memory, and frame rate need separate panels/scales. Avoid unlabeled, visually comparable bars for unlike units. Direct labels usually beat a legend in a two-bar chart.
- **Publish the measurement contract.** Name the action, start/end events, prior/current tag or commit, conversation size (messages plus a useful DOM/content-size measure), starting scroll position, cache state, Chrome/OS/Butter versions, hardware, viewport, other extensions, and relevant settings. Record whether network/model response time is excluded. Do not call a local UI measurement “total ChatGPT response speed.”
- **Use repeated runs, and disclose them.** Record $n$, warm-up policy, run order, aggregation (median/mean), spread or confidence interval where useful, and handling of failures/outliers. Prefer paired runs on the same machine/fixture with alternating or randomized order. There is no verified universal minimum sample count in the inspected sources; choose a count that resolves the observed variation rather than claiming a magic standard.
- **Do not manufacture error bars or precision.** One observation supports one observation; label it as such. Preserve raw timings and benchmark commands as source data. A model should not infer timing from prose, a GIF, a code diff, or an optimization’s theoretical cost.
- **Distinguish speed ratio from time reduction.** For the supplied illustrative $9.6\,\mathrm{s}$ and $2.6\,\mathrm{s}$, the speed ratio is $9.6/2.6\approx3.69$, while the duration reduction is $(9.6-2.6)/9.6\approx72.9\%$. Safe labels are “about $3.7\times$ as fast in this benchmark” or “about 73% less waiting time.” These arithmetic results are **not new measurements** and do not validate Butter’s numbers. Avoid the ambiguous “270% faster.”
- **Make the baseline durable.** Save exact versions/ref identities alongside data and chart source, following the baseline discipline of benchmark-action/CodSpeed/Bencher. Do not silently compare a new release to whatever `main` happens to mean later. [T7] [T8] [T9]
- **Show limitations and correct errors.** Include regressions and applicability limits rather than choosing only favorable cases. Deno’s correction demonstrates why chart version identity and a visible correction note matter. uv’s benchmark docs explain OS/filesystem/workload differences and provide reproduction commands. [E5] [P3]

### Accessibility and useful fallback text

- Every graphic needs **meaningful alt text** and an adjacent plain-language takeaway. For example, if verified: “Sending from far up a long chat took 9.6 seconds before and 2.6 seconds after; lower is better.” For a flow diagram, describe the skipped/reordered work and resulting behavior.
- Repeat the essential **numbers in a Markdown table**, including versions and units, so a reader need not read pixels. Link detailed methodology/raw results separately. W3C guidance for complex images calls for a short identification plus an appropriate longer text alternative covering values, scales, relationships, and trends. [P2]
- Do not encode “before” and “after” only in red/green. Add text labels and preserve contrast in both themes. WCAG non-text contrast guidance provides the relevant basis for essential graphical objects; text contrast also needs checking. [P5]
- Prefer static images. If a GIF teaches a sequence, keep it short, crop tightly, avoid flashing, and provide a static/text alternative. WCAG guidance on automatically moving content is relevant when animation loops alongside text; do not claim a looping GIF is accessible merely because it has alt text. [P6]
- Redact account names, prompts, tokens, and personal conversation content before committing screenshots. Prefer a reproducible synthetic fixture. This follows the practical need for consistent capture, rather than making screenshots depend on private chats. [A4]

### Light/dark rendering and GitHub’s column

- Render **both theme variants from the same data and layout**. Only colors should differ; dimensions, content, axes, numbers, and crop must match. Use Playwright color-scheme emulation and screenshots, or explicitly controlled HTML theme attributes if needed. Wait for fonts and images; disable decorative animation; capture a stable element instead of a tall whole page. These capabilities are documented by Playwright. [T12] [T13]
- Use opaque backgrounds appropriate to each theme. Transparent backgrounds can make fixed text colors illegible after GitHub changes the surrounding page color. Inspect labels, gridlines, arrows, and anti-aliased edges against both backgrounds.
- Embed the two assets using the task’s **already-verified release-body `<picture>` behavior**, with dark `<source media="(prefers-color-scheme: dark)">` and a light fallback `<img>`. Put alt text on the fallback image. Generic GitHub formatting docs also document `<picture>`, but do not substitute that README/general documentation for the task’s release-body experiment. [P7]
- **Recommended starting dimensions, not an official GitHub limit:** design around 640–800 CSS pixels wide, then export at double pixel density. A practical initial target is 720 CSS pixels and a 1440-pixel-wide PNG. Keep a single chart fairly short; split a long infographic into several independently readable figures. Neither a fixed GitHub release-column width nor a universal image-width requirement was verified.
- Inspect legibility at the intended display width **and at mobile width**. Use fewer labels rather than shrinking text. Do not put a pair of full-screen screenshots side-by-side if the meaningful part becomes tiny. The UK chart guidance specifically warns that publication resizing changes the readable font-size requirement. [P1]
- An HTML `width` attribute may be useful, but its exact release-body handling was not part of the supplied verified facts and was not re-tested here. Do not make correct sizing depend on custom CSS, classes, inline styles, or release-body JavaScript.
- Suggested budget: a few hundred KB for an ordinary static chart, with a deliberate review for larger screenshots; this is an editorial target, not a GitHub service limit. A large raw screenshot should usually be cropped and optimized before inclusion.

### Asset organization, filenames, and pinning

Recommended repository layout for a future implementation:

```text
docs/releases/0.1.0-alpha.N/
  send-from-history.html
  send-from-history.data.json
  send-from-history.light.png
  send-from-history.dark.png
  benchmark-method.md
```

- Use a **release-scoped folder plus scenario/metric/theme names**, so the file itself says what it represents. `alpha.N` above is a placeholder; a real release path must contain the actual version. Keep reusable templates elsewhere and preserve the release-specific source/data for auditability.
- Use **absolute public image URLs** in release bodies. Generic repository-file relative-link rules do not establish the same base path for release descriptions; do not depend on a relative link silently resolving the way README links do. [P7]
- Prefer an asset URL that resolves through the exact released tag, e.g. the *pattern* `https://raw.githubusercontent.com/<account>/butter/v<version_name>/docs/releases/<version_name>/send-from-history.light.png`. This is a recommended pattern, **not an existing image URL verified here**.
- Ensure the files are present in the commit the tag points to **before** writing the final tagged URLs. Otherwise a release can point at images that exist only on a later branch commit. Check every light/dark URL and content type before publication.
- **A tag is more stable than `main`, but can still be moved.** For truly immutable content identity use a full commit SHA in raw URLs; retain the release-tag context in captions/source records. GitHub’s permalink docs distinguish mutable branch views from commit-specific links. [P4]
- Save a small asset manifest with ref, metric/source file, scenario, theme, dimensions and checksum. Do not overwrite an old release’s image to describe a later result. If correcting a released chart, update the source/text together and disclose the correction.
- Repo images are reviewable and versionable but grow git history. GitHub user attachments are convenient but less tightly coupled to the source tag; external CDNs introduce another asset lifecycle. A live benchmark dashboard is valuable evidence, but an old release should retain the snapshot it originally described.

### Main pitfalls to encode in the eventual workflow

1. **Mermaid/HTML report confusion:** pre-render diagrams; a tool’s local Mermaid viewer or MDX component is not a supported release-body widget.
2. **Unmeasured claims:** do not transform a generic “optimized” changelog entry into numeric bars. Ask for evidence or use a conceptual diagram with no invented timing.
3. **Overstated tool coverage:** visual-changelog, release artwork, screenshots, benchmark measurement and release publication are different capabilities. The sources above provide pieces, not a verified exact solution.
4. **Misleading playback:** VHS/GIF delays, accelerated demos, and edited screen recordings do not establish latency. Clearly label changed playback speed.
5. **Stale endpoints and themes:** Bencher’s removed perf-image endpoint and fixed dark screenshots on theme-aware sites are concrete examples of misleading assumptions. [T9a]
6. **Generic architecture pictures:** focus on the action the user performs. Only include internal mechanisms needed to explain its improvement.
7. **Huge composite images:** Deno’s nine-panel layout is informative on a full web page but too dense to copy wholesale into a narrow release column.
8. **Unrequested publication or checkout changes:** a research/presentation step should not execute another skill’s instructions to stash work, push gists, edit PRs, or create releases. This research did none of those things.

## Deliverable audit

- Nine selected example pages opened successfully; tool claims cite original docs, skill files, or implementation source.
- Original illustrative image files were downloaded and inspected under `sources/`. **No browser screenshots of complete example pages were captured**; the optional screenshot deliverable was skipped. Downloaded source graphics are not being passed off as page screenshots.
- `source-manifest.json` includes failed candidates as well as successful opens. Broken discovery URLs are not treated as verified prior art.
- `commands.md` records executed shell commands and their actual output excerpts, including the missing dependency and failed `rg` search. Reusable fetch scripts are saved beside this report.

## Full primary-source links

- **A1 — copilot-visual-pr:** <https://raw.githubusercontent.com/github/awesome-copilot/8178d1939a203f691067073dcab2a3f1e14072d3/plugins/visual-pr/README.md>
- **A1a — copilot-screen-recording:** <https://raw.githubusercontent.com/github/awesome-copilot/8178d1939a203f691067073dcab2a3f1e14072d3/skills/screen-recording/SKILL.md>
- **A2 — copilot-release-showcase:** <https://raw.githubusercontent.com/github/awesome-copilot/8178d1939a203f691067073dcab2a3f1e14072d3/extensions/release-notes-showcase/README.md>
- **A2a — copilot-showcase-code:** <https://raw.githubusercontent.com/github/awesome-copilot/8178d1939a203f691067073dcab2a3f1e14072d3/extensions/release-notes-showcase/releaseNotesShowcase.mjs>
- **A3 — basic-memory-images:** <https://raw.githubusercontent.com/basicmachines-co/basic-memory/main/.agents/skills/infographics/SKILL.md>
- **A4 — change-preview:** <https://raw.githubusercontent.com/steveharrison/change-preview/main/SKILL.md>
- **A5 — visual-changelog:** <https://raw.githubusercontent.com/WebifyServices/visual-changelog/main/README.md>
- **A6 — pr-visual-writeup:** <https://raw.githubusercontent.com/hexclave/stack-auth/dev/.agents/skills/pr-visual-writeup/SKILL.md>
- **A7 — visual-explainer:** <https://raw.githubusercontent.com/nicobailon/visual-explainer/3d592addcc1689ea2251ee67991f12f8a30fd2d9/plugins/visual-explainer/SKILL.md>
- **A8 — cursor-commands:** <https://planetscale.com/blog/automating-with-cursor-commands>
- **A9 — changelog-generator:** <https://raw.githubusercontent.com/ComposioHQ/awesome-claude-skills/master/changelog-generator/SKILL.md>
- **A10 — anthropic-skills:** <https://api.github.com/repos/anthropics/skills/git/trees/main?recursive=1>
- **A10a — anthropic-canvas:** <https://raw.githubusercontent.com/anthropics/skills/ca45fc496a3436251f191354091d557da31c15b5/skills/canvas-design/SKILL.md>
- **A10b — anthropic-webtest:** <https://raw.githubusercontent.com/anthropics/skills/ca45fc496a3436251f191354091d557da31c15b5/skills/webapp-testing/SKILL.md>
- **A10c — anthropic-gif:** <https://raw.githubusercontent.com/anthropics/skills/ca45fc496a3436251f191354091d557da31c15b5/skills/slack-gif-creator/SKILL.md>
- **A11 — copilot-octopus:** <https://raw.githubusercontent.com/github/awesome-copilot/8178d1939a203f691067073dcab2a3f1e14072d3/agents/octopus-deploy-release-notes-mcp.agent.md>
- **A12 — playwright-mcp:** <https://raw.githubusercontent.com/microsoft/playwright-mcp/main/README.md>
- **T1 — release-please:** <https://raw.githubusercontent.com/googleapis/release-please/main/README.md>
- **T2 — changesets:** <https://raw.githubusercontent.com/changesets/changesets/main/README.md>
- **T3 — semantic-release:** <https://raw.githubusercontent.com/semantic-release/release-notes-generator/master/README.md>
- **T4 — git-cliff:** <https://raw.githubusercontent.com/orhun/git-cliff/main/README.md>
- **T5 — release-drafter:** <https://raw.githubusercontent.com/release-drafter/release-drafter/master/README.md>
- **T6 — github-auto-notes:** <https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes>
- **T7 — benchmark-action:** <https://raw.githubusercontent.com/benchmark-action/github-action-benchmark/master/README.md>
- **T8 — codspeed:** <https://codspeed.io/docs>
- **T8a — codspeed-profiling:** <https://codspeed.io/docs/features/profiling>
- **T8b — codspeed-metrics:** <https://codspeed.io/docs/features/understanding-the-metrics>
- **T9 — bencher:** <https://bencher.dev/docs/how-to/github-actions/>
- **T9a — bencher-changelog:** <https://bencher.dev/docs/reference/changelog/>
- **T10 — vhs:** <https://raw.githubusercontent.com/charmbracelet/vhs/main/README.md>
- **T11 — asciinema:** <https://docs.asciinema.org/manual/>
- **T11a — agg:** <https://raw.githubusercontent.com/asciinema/agg/main/README.md>
- **T12 — playwright:** <https://playwright.dev/docs/screenshots>
- **T13 — playwright-emulation:** <https://playwright.dev/docs/emulation>
- **T14 — terminalizer:** <https://raw.githubusercontent.com/faressoft/terminalizer/master/README.md>
- **T15 — mintlify-update:** <https://www.mintlify.com/docs/components/update>
- **T15a — mintlify-changelogs-correct:** <https://www.mintlify.com/docs/create/changelogs>
- **T16 — docusaurus:** <https://docusaurus.io/docs/blog>
- **T17 — vercel:** <https://vercel.com/changelog>
- **E1 — bun12:** <https://bun.sh/blog/bun-v1.2>
- **E1css — bun-css:** <https://bun.sh/_assets/site-0911bc8f.css>
- **E1gh — bun-release-page:** <https://github.com/oven-sh/bun/releases/tag/bun-v1.2.0>
- **E1api — bun-release:** <https://api.github.com/repos/oven-sh/bun/releases/tags/bun-v1.2.0>
- **E2 — bun-postmessage:** <https://bun.sh/blog/how-we-made-postMessage-string-500x-faster>
- **E3 — uv:** <https://astral.sh/blog/uv>
- **E4 — ruff:** <https://astral.sh/blog/the-ruff-formatter>
- **E5 — deno2:** <https://deno.com/blog/v2.0>
- **E5css — deno-css:** <https://deno.com/styles/app.css?__frsh_c=ba3bc66b1456a2a2caff15a7f9da8773ea6ae3fc>
- **E6 — vscode:** <https://code.visualstudio.com/updates/v1_95>
- **E7 — devtools:** <https://developer.chrome.com/blog/new-in-devtools-130>
- **E8 — linear:** <https://linear.app/changelog/2024-03-20-new-linear-ui>
- **E9 — raycast:** <https://www.raycast.com/changelog/1-80-0>
- **E9css — raycast-css-2:** <https://www.raycast.com/_next/static/immutable/chunks/0ceirt5pnc9gd.css>
- **N1 — vite8:** <https://vite.dev/blog/announcing-vite8>
- **N2 — biome2:** <https://biomejs.dev/blog/biome-v2/>
- **P1 — uk-charts:** <https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-charts/>
- **P2 — w3c-complex-images:** <https://www.w3.org/WAI/tutorials/images/complex/>
- **P3 — uv-benchmarks:** <https://raw.githubusercontent.com/astral-sh/uv/main/BENCHMARKS.md>
- **P4 — github-permalinks:** <https://docs.github.com/en/repositories/working-with-files/using-files/getting-permanent-links-to-files>
- **P5 — w3c-contrast:** <https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html>
- **P6 — w3c-motion:** <https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html>
- **P7 — github-basic-images:** <https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax>

[A1]: https://raw.githubusercontent.com/github/awesome-copilot/8178d1939a203f691067073dcab2a3f1e14072d3/plugins/visual-pr/README.md
[A1a]: https://raw.githubusercontent.com/github/awesome-copilot/8178d1939a203f691067073dcab2a3f1e14072d3/skills/screen-recording/SKILL.md
[A2]: https://raw.githubusercontent.com/github/awesome-copilot/8178d1939a203f691067073dcab2a3f1e14072d3/extensions/release-notes-showcase/README.md
[A2a]: https://raw.githubusercontent.com/github/awesome-copilot/8178d1939a203f691067073dcab2a3f1e14072d3/extensions/release-notes-showcase/releaseNotesShowcase.mjs
[A3]: https://raw.githubusercontent.com/basicmachines-co/basic-memory/main/.agents/skills/infographics/SKILL.md
[A4]: https://raw.githubusercontent.com/steveharrison/change-preview/main/SKILL.md
[A5]: https://raw.githubusercontent.com/WebifyServices/visual-changelog/main/README.md
[A6]: https://raw.githubusercontent.com/hexclave/stack-auth/dev/.agents/skills/pr-visual-writeup/SKILL.md
[A7]: https://raw.githubusercontent.com/nicobailon/visual-explainer/3d592addcc1689ea2251ee67991f12f8a30fd2d9/plugins/visual-explainer/SKILL.md
[A8]: https://planetscale.com/blog/automating-with-cursor-commands
[A9]: https://raw.githubusercontent.com/ComposioHQ/awesome-claude-skills/master/changelog-generator/SKILL.md
[A10]: https://api.github.com/repos/anthropics/skills/git/trees/main?recursive=1
[A10a]: https://raw.githubusercontent.com/anthropics/skills/ca45fc496a3436251f191354091d557da31c15b5/skills/canvas-design/SKILL.md
[A10b]: https://raw.githubusercontent.com/anthropics/skills/ca45fc496a3436251f191354091d557da31c15b5/skills/webapp-testing/SKILL.md
[A10c]: https://raw.githubusercontent.com/anthropics/skills/ca45fc496a3436251f191354091d557da31c15b5/skills/slack-gif-creator/SKILL.md
[A11]: https://raw.githubusercontent.com/github/awesome-copilot/8178d1939a203f691067073dcab2a3f1e14072d3/agents/octopus-deploy-release-notes-mcp.agent.md
[A12]: https://raw.githubusercontent.com/microsoft/playwright-mcp/main/README.md
[T1]: https://raw.githubusercontent.com/googleapis/release-please/main/README.md
[T2]: https://raw.githubusercontent.com/changesets/changesets/main/README.md
[T3]: https://raw.githubusercontent.com/semantic-release/release-notes-generator/master/README.md
[T4]: https://raw.githubusercontent.com/orhun/git-cliff/main/README.md
[T5]: https://raw.githubusercontent.com/release-drafter/release-drafter/master/README.md
[T6]: https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes
[T7]: https://raw.githubusercontent.com/benchmark-action/github-action-benchmark/master/README.md
[T8]: https://codspeed.io/docs
[T8a]: https://codspeed.io/docs/features/profiling
[T8b]: https://codspeed.io/docs/features/understanding-the-metrics
[T9]: https://bencher.dev/docs/how-to/github-actions/
[T9a]: https://bencher.dev/docs/reference/changelog/
[T10]: https://raw.githubusercontent.com/charmbracelet/vhs/main/README.md
[T11]: https://docs.asciinema.org/manual/
[T11a]: https://raw.githubusercontent.com/asciinema/agg/main/README.md
[T12]: https://playwright.dev/docs/screenshots
[T13]: https://playwright.dev/docs/emulation
[T14]: https://raw.githubusercontent.com/faressoft/terminalizer/master/README.md
[T15]: https://www.mintlify.com/docs/components/update
[T15a]: https://www.mintlify.com/docs/create/changelogs
[T16]: https://docusaurus.io/docs/blog
[T17]: https://vercel.com/changelog
[E1]: https://bun.sh/blog/bun-v1.2
[E1css]: https://bun.sh/_assets/site-0911bc8f.css
[E1gh]: https://github.com/oven-sh/bun/releases/tag/bun-v1.2.0
[E1api]: https://api.github.com/repos/oven-sh/bun/releases/tags/bun-v1.2.0
[E2]: https://bun.sh/blog/how-we-made-postMessage-string-500x-faster
[E3]: https://astral.sh/blog/uv
[E4]: https://astral.sh/blog/the-ruff-formatter
[E5]: https://deno.com/blog/v2.0
[E5css]: https://deno.com/styles/app.css?__frsh_c=ba3bc66b1456a2a2caff15a7f9da8773ea6ae3fc
[E6]: https://code.visualstudio.com/updates/v1_95
[E7]: https://developer.chrome.com/blog/new-in-devtools-130
[E8]: https://linear.app/changelog/2024-03-20-new-linear-ui
[E9]: https://www.raycast.com/changelog/1-80-0
[E9css]: https://www.raycast.com/_next/static/immutable/chunks/0ceirt5pnc9gd.css
[N1]: https://vite.dev/blog/announcing-vite8
[N2]: https://biomejs.dev/blog/biome-v2/
[P1]: https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-charts/
[P2]: https://www.w3.org/WAI/tutorials/images/complex/
[P3]: https://raw.githubusercontent.com/astral-sh/uv/main/BENCHMARKS.md
[P4]: https://docs.github.com/en/repositories/working-with-files/using-files/getting-permanent-links-to-files
[P5]: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
[P6]: https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
[P7]: https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax
