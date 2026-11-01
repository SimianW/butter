# Agent notes

## Versioning

Versions follow SemVer 2.0.0 pre-release naming. The alpha builds of `X.Y.Z` are `X.Y.Z-alpha`,
`X.Y.Z-alpha.1`, `X.Y.Z-alpha.2`, … Each build handed to the user or released bumps the alpha
number; the user decides when `X.Y.Z` itself moves.

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

GitHub tags and releases are `v<version_name>`; alpha builds are marked as prereleases.

Builds before 0.1.0-alpha.5 were renamed on 2026-11-01. Commit messages from before then still use
the old names: 0.0.1-alpha is now 0.1.0-alpha, 0.0.2-alpha is 0.1.0-alpha.1, and 0.0.2-alpha.N is
0.1.0-alpha.N.
