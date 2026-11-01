# Agent notes

## Versioning

Versions follow SemVer 2.0.0 pre-release naming. The successive alpha builds of `X.Y.Z` are
`X.Y.Z-alpha`, `X.Y.Z-alpha.2`, `X.Y.Z-alpha.3`, … (the bare `-alpha` is build 1). Each build
handed to the user or released bumps the alpha number; the user decides when `X.Y.Z` itself moves.

`extension/manifest.json` carries the version twice, because Chrome accepts only one to four
dot-separated integers in `version` and orders updates by it alone:

| Build | `version_name` | `version` |
|---|---|---|
| first alpha | `0.0.2-alpha` | `0.0.2` |
| alpha N | `0.0.2-alpha.3` | `0.0.2.3` |
| stable after N alphas | `0.0.2` | `0.0.2.<N+1>`, so Chrome still sees it as newer |

The user may refer to a build by its `version` (for example "0.0.2.3"); that is the same build as
`0.0.2-alpha.3`.

On a version change, update together:

- both manifest fields;
- "Current version" in `README.md`;
- a `## <version_name> (YYYY-MM-DD)` entry at the top of `CHANGELOG.md`, describing what changed
  for the user since the previous build;
- the package: `python3 scripts/package.py` names the zip after `version_name`.

GitHub tags and releases are `v<version_name>`; alpha builds are marked as prereleases.

Version names already in `docs/REPORT.md`, `results/` and older changelog entries record which
build was measured or shipped, so they keep their original names.
