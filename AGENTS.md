# Agent notes

## Versioning

Versions follow SemVer 2.0.0 pre-release naming. The alpha builds of `X.Y.Z` are `X.Y.Z-alpha`,
`X.Y.Z-alpha.1`, `X.Y.Z-alpha.2`, … Each released build bumps the alpha number; the user decides
when `X.Y.Z` itself moves.

A test build (a package handed to the user to try, not released) takes no alpha number: build it
with `python3 scripts/package.py --test <tag>`, which names it `<version_name>+<tag>.<N>` inside
the zip only. `extension/manifest.json` never carries a `+` version.

`extension/manifest.json` carries the version twice, because Chrome accepts only one to four
dot-separated integers in `version` and orders updates by it alone:

| Build | `version_name` | `version` |
|---|---|---|
| first alpha | `0.1.0-alpha` | `0.1.0` |
| alpha N | `0.1.0-alpha.5` | `0.1.0.5` |
| stable after alpha N | `0.1.0` | `0.1.0.<N+1>`, so Chrome still sees it as newer |

The user may refer to a build by its `version` (for example "0.1.0.5"); that is the same build as
`0.1.0-alpha.5`.

On a version change, update together:

- both manifest fields;
- "Current version" in `README.md` and "当前版本" in `README.zh-CN.md`;
- `CHANGELOG.md`: rename `## [Unreleased]` to `## [<version_name>] - YYYY-MM-DD` and leave a new,
  empty `## [Unreleased]` above it (see [Changelog](#changelog));
- the package: `python3 scripts/package.py` names the zip after `version_name`.

`python3 scripts/check-version.py` verifies the manifest, README, and changelog version sites.
For test commands, see [docs/development.md](docs/development.md).

GitHub tags and releases are `v<version_name>`; alpha builds are marked as prereleases. A release's
notes are its changelog entry without the `##` heading.

Builds before 0.1.0-alpha.5 were renamed on 2026-11-01. Commit messages from before then still use
the old names: 0.0.1-alpha is now 0.1.0-alpha, 0.0.2-alpha is 0.1.0-alpha.1, and 0.0.2-alpha.N is
0.1.0-alpha.N.

## Changelog

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/): one entry per
build, newest first, below a standing `## [Unreleased]` heading; changes are grouped under `###`
category headings.

Every PR with a change the user can notice adds its bullet under `## [Unreleased]`, in that same
PR. The PR that changes the version renames that heading to the version and date, and leaves a
new, empty `## [Unreleased]` above it.

```markdown
## [Unreleased]

### Fixed

- Fixed a crash when opening settings.

## [0.1.0-alpha.16] - 2026-11-08

### Changed

- Redesigned the popup: ...

### Fixed

- Fixed Ask in branch failing after you open a chat from ChatGPT's sidebar.
```

Use these categories, in this order, and only the ones the build has:

| Category | For | Example |
|---|---|---|
| Added | new features | Added dark mode support. |
| Changed | changes to existing features | Improved the settings UI. |
| Fixed | bug fixes | Fixed a crash when opening settings. |
| Removed | removed features | Removed legacy API support. |
| Deprecated | features to be removed later | Deprecated the old authentication API. |
| Security | security fixes | Fixed an XSS vulnerability. |
| Performance | speed and resource use | Reduced startup time by 30%. |

A problem the build ships with goes last, under `### Known issues`.

Each bullet is one change the user can notice, opening with a past-tense verb ("Added",
"Fixed", "Reduced"); a known issue instead describes the problem. Name what the user sees, keep
the bullet short, and give the measured number for a performance change when there is one. Leave
out changes only developers see (tests, dev build, CI, tooling).

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in `SimianW/butter` (`gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels, each named after its role. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` at the repo root, ADRs in `docs/adr/`. See `docs/agents/domain.md`.

## Workflow

- PRs: every change reaches `main` through a PR. Before merging, run
  `python3 scripts/review-tier.py origin/main` and put the tier it prints in the PR body's
  `## Review` section as `- **Tier:** N` (the `pr` skill); after an APPROVE, `review-loop` adds
  the `- **Verdict:** approved at <sha>` and `- **Reviewers:**` items (the Verdict reads
  `overridden by <user> at <sha>` when the user ships a stuck loop). CI's `pr-body` check
  enforces the Tier and Verdict items, and
  `PR_BODY="$(cat body.md)" python3 scripts/check-pr-body.py` runs it locally. Open the PR as a
  draft and mark it ready once that local check passes; `pr-body` runs only on ready PRs.
  Tier 0 merges on green CI; tiers 1 and 2 merge after `review-loop` returns APPROVE on the
  final diff, at the round budget the tier sets. Do not wait for the Codex GitHub bot's review
  before merging: if it has already posted when CI is green, handle its comments first; comments
  that arrive after the merge become a follow-up issue.
- PR size: CI labels each PR from `size/XS` to `size/XXL` by the lines of code it changes; prose,
  lock files, binary files and the folders in the script's `SKIP_PREFIXES` (docs, assets and
  `lab/variants/`) do not count. `python3 scripts/pr-size.py` prints the label locally. The label
  is CI's to set.
- Reviews: every gate review before merge, including when the user asks to review a PR or branch,
  runs `review-loop`. Only `implement` and `implement-spec` work adds a `code-review` pass before
  it (see New features).
- Naming: use the terms in [GLOSSARY.md](GLOSSARY.md) for modules, tests and docs; add a term there
  when you coin one.
- Test seams: [docs/agents/seams.md](docs/agents/seams.md) lists the agreed seams and the skills
  that test at them without asking the user.
- Bug fixes: follow [docs/bugfix.md](docs/bugfix.md).
- Frontend: before any visible frontend change, use the `mockup-first` skill: show the user a
  mockup and wait for approval. Mockups are saved in `mockups/`. The UI's default language is
  English (`extension/_locales/en/`; `zh_CN` is the second locale), and its fonts, colours and
  tokens are in `extension/popup/popup.css`, described in [design/palette.md](design/palette.md).
- New features: `to-spec` publishes the spec as a GitHub issue in `SimianW/butter` (`gh`) labelled
  `ready-for-agent`. Then either `implement <spec>` builds it directly, or `to-tickets` splits it
  into tickets and `implement-spec <spec>` builds them. Their review runs `code-review` against
  the spec issue; sort its findings into fix now / follow-up issue / drop, one line of reason
  each, and stop for the user to choose. File each follow-up as a `ready-for-agent` issue in `SimianW/butter`. After the
  fixes, `review-loop` gates the final diff at its tier, with the approved refactors listed in
  its Intent. The work ends in a PR whose body carries `Closes #<issue>` and the Review section's
  `- **Tier:** N` item. These four skills are user-only, so the user starts each one: when the work reaches a
  step, tell the user it is time and give the command to type, such as `/to-spec`.
- Subagents: when a skill calls for a subagent, choose its model by the work it does, from the
  delegation table in your global instructions: an implementer or merger is Build, a reviewer is
  Hunt, an explorer is Chore. A brief for delegated `implement` work names the `tdd` skill and the
  seams file.
- Lab runs: read [lab/README.md](lab/README.md) first; it points to the live lab's locks and
  fixtures.
- Lab-run reports and result data go to `notes/runs/<YYYY-MM-DD>-<slug>/`, never only `/tmp`.
  Strip private data first; the rules are in [notes/runs/README.md](notes/runs/README.md).
