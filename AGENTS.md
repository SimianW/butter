# Agent notes

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in `SimianW/butter` (`gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels, each named after its role. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` at the repo root, ADRs in `docs/adr/`. See `docs/agents/domain.md`.

## Workflow

- PRs & size: every change reaches `main` through a PR. Before opening, updating or merging a PR,
  read [docs/agents/workflow.md](docs/agents/workflow.md): the review gate, the size label, and
  what to do after an approval and after the merge.
- File length: every linted file stays within `maxLines` (500) in `eslint.config.mjs`, which
  `npm run lint` checks. Split a file along a seam rather than raise its cap; the cap rules are in
  [docs/agents/workflow.md](docs/agents/workflow.md).
- Reviews: every gate review before merge, including when the user asks to review a PR or branch,
  runs `review-loop` at the tier `python3 scripts/review-tier.py origin/main` prints. Only
  `implement` and `implement-spec` work adds a `code-review` pass before it.
- Naming: use the terms in [GLOSSARY.md](GLOSSARY.md) for modules, tests and docs; add a term there
  when you coin one.
- Testing & bugs: test at the seams in [docs/agents/seams.md](docs/agents/seams.md), which also
  lists the skills that test at them without asking the user; fix bugs by
  [docs/bugfix.md](docs/bugfix.md).
- Recordings: a visible bug claim carries a GIF of the bug, and a PR with a visible change a before
  and an after GIF; see [docs/agents/recordings.md](docs/agents/recordings.md).
- Dev docs: put each module's and test's role in its header comment.
  [docs/development.md](docs/development.md) has the setup and test commands, and links out per
  topic (runtime API, releasing). `npm run check` runs every CI check locally.
  `test/agent-doc-size.test.mjs` holds docs/development.md within 46,000 bytes and this file
  within 100 lines.
- Frontend: before any visible frontend change, use the `mockup-first` skill: show the user a
  mockup and wait for approval. Mockups are saved in `mockups/`. The UI's default language is
  English (`extension/_locales/en/`; `zh_CN` is the second locale), and its fonts, colours and
  tokens are in `extension/popup/popup.css`, described in [design/palette.md](design/palette.md).
- New features: before a step of `to-spec`, `to-tickets`, `implement` or `implement-spec`, read
  [docs/agents/workflow.md](docs/agents/workflow.md). These four skills are user-only: when the
  work reaches one, tell the user it is time and give the command to type, such as `/to-spec`.
- Subagents: when a skill calls for a subagent, choose its model by the work it does, from the
  delegation table in your global instructions: an implementer or merger is Build, a reviewer is
  Hunt, a lab or browser runner is Drive, an explorer is Chore. A brief for delegated `implement`
  work names the `tdd` skill and the seams file.
- Lab runs: read [lab/README.md](lab/README.md) first; it points to the live lab's locks and
  fixtures.
- Main checkout: the lab runs its harness from the main checkout (`~/.local/share/chatgpt-lab/harness`
  links to its `lab/harness`), so that checkout stays on `main`. Never switch branches there, even
  when a brief says to: do branch work in a worktree, or stop and report.
- Lab-run reports and result data go to `notes/runs/<YYYY-MM-DD>-<slug>/`, never only `/tmp`.
  Strip private data first; the rules are in [notes/runs/README.md](notes/runs/README.md).

## Releases

- Changelog: every PR with a change the user can notice adds a bullet under `## [Unreleased]`
  in `CHANGELOG.md`; read [docs/agents/changelog.md](docs/agents/changelog.md) before you write one.
- Versions: read [docs/agents/releasing.md](docs/agents/releasing.md) before you change the
  version, build a package or test build, or tag a release. The user may name a build by its
  Chrome `version`: `0.1.0.5` is `0.1.0-alpha.5`.
