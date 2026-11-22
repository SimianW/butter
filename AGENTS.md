# Agent notes

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
  enforces the Tier and Verdict items, and the Cap raised items (see File length), and
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
- File length: every linted file stays within `maxLines` (500) in `eslint.config.mjs`; a file
  already over it has a cap in `maxLinesCaps`, which may only come down as the file shrinks
  (`npm run lint` and `test/max-lines-caps.test.mjs`). Split a file along a seam rather than
  raise its cap. A PR that adds or raises a cap carries one item per cap in its body, such as
  ``- **Cap raised:** `extension/seek/preview-main.js` 1546 → 1583: <reason>`` (`new` in place
  of the old cap for an added one); `pr-body` fails without it. A raised cap does not change
  the tier.
- Reviews: every gate review before merge, including when the user asks to review a PR or branch,
  runs `review-loop`. Only `implement` and `implement-spec` work adds a `code-review` pass before
  it (see New features).
- Naming: use the terms in [GLOSSARY.md](GLOSSARY.md) for modules, tests and docs; add a term there
  when you coin one.
- Test seams: [docs/agents/seams.md](docs/agents/seams.md) lists the agreed seams and the skills
  that test at them without asking the user. [docs/development.md](docs/development.md) has the test commands.
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
  Hunt, a lab or browser runner is Drive, an explorer is Chore. A brief for delegated `implement`
  work names the `tdd` skill and the seams file.
- Lab runs: read [lab/README.md](lab/README.md) first; it points to the live lab's locks and
  fixtures.
- Lab-run reports and result data go to `notes/runs/<YYYY-MM-DD>-<slug>/`, never only `/tmp`.
  Strip private data first; the rules are in [notes/runs/README.md](notes/runs/README.md).

## Releases

- Changelog: every PR with a change the user can notice adds a bullet under `## [Unreleased]`
  in `CHANGELOG.md`; read [docs/agents/changelog.md](docs/agents/changelog.md) before you write one.
- Versions: read [docs/agents/releasing.md](docs/agents/releasing.md) before you change the
  version, build a package or test build, or tag a release. The user may name a build by its
  Chrome `version`: `0.1.0.5` is `0.1.0-alpha.5`.
