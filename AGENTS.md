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
- a `## <version_name> (YYYY-MM-DD)` entry at the top of `CHANGELOG.md`, describing what changed
  for the user since the previous build;
- the package: `python3 scripts/package.py` names the zip after `version_name`.

`python3 scripts/check-version.py` verifies the manifest, README, and changelog version sites.
For test commands, see [docs/development.md](docs/development.md).

GitHub tags and releases are `v<version_name>`; alpha builds are marked as prereleases.

Builds before 0.1.0-alpha.5 were renamed on 2026-11-01. Commit messages from before then still use
the old names: 0.0.1-alpha is now 0.1.0-alpha, 0.0.2-alpha is 0.1.0-alpha.1, and 0.0.2-alpha.N is
0.1.0-alpha.N.

## Workflow

- Every change reaches `main` through a PR. Before merging, run
  `python3 scripts/review-tier.py origin/main` and put its `Review tier: N` line in the PR
  body (the `pr` skill); CI's `pr-body` check enforces the tier and review lines. Tier 0 merges
  on green CI; tiers 1 and 2 merge after `review-loop` returns APPROVE on the final diff, at
  the round budget the tier sets. Every review in this repo, including when the user asks to
  review a PR or branch, runs `review-loop`.
- Bug fixes: follow [docs/bugfix.md](docs/bugfix.md).
- Features: `to-spec` publishes the spec as a GitHub issue in `SimianW/butter` (`gh`) labelled
  `ready-for-agent`; `implement` or `implement-spec` builds it. In Butter their test seams are
  the ones in docs/bugfix.md step 2, their review step is `review-loop`, and the work ends in a
  PR whose body carries `Closes #<issue>` and the `Review tier` line.
- Lab runs: read [lab/README.md](lab/README.md) first; it points to the live lab's locks and
  fixtures.
- Lab-run reports and result data go to `notes/runs/<YYYY-MM-DD>-<slug>/`, never only `/tmp`.
  Strip private data first; the rules are in [notes/runs/README.md](notes/runs/README.md).
