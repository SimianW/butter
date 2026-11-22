# Releasing

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
  empty `## [Unreleased]` above it (see [Changelog](changelog.md));
- the package: `python3 scripts/package.py` names the zip after `version_name`.

`python3 scripts/check-version.py` verifies the manifest, README, and changelog version sites.

GitHub tags and releases are `v<version_name>`; alpha builds are marked as prereleases. A release's
notes are its changelog entry without the `##` heading.

Builds before 0.1.0-alpha.5 were renamed on 2026-11-01. Commit messages from before then still use
the old names: 0.0.1-alpha is now 0.1.0-alpha, 0.0.2-alpha is 0.1.0-alpha.1, and 0.0.2-alpha.N is
0.1.0-alpha.N.

## Packages

`python3 scripts/package.py` builds the zip.
For testing, `python3 scripts/package.py --test <tag>` builds `dist/butter-<version_name>+<tag>.<N>.zip` without changing the source manifest or consuming an alpha number (tag: `[a-z0-9-]+`; numbering starts at 1 per base version and tag).
Test zips retain the base Chrome numeric version; remove the previous install before loading one unpacked.
`python3 scripts/package.py --dev` builds the dev build, `dist/butter-<version_name>+dev.<N>.zip`: a test build
that also contains `extension/dev/`, whose popup.html loads the popup's dev card, and whose manifest adds the dev scripts, the `save-bug` command (suggested
key Alt+Shift+B, Option+Shift+B on a Mac) and the `downloads` permission. The shortcut saves a privacy-safe
snapshot of the last 30 s on a ChatGPT chat to `Downloads/butter-diag/round-<N>/bug-<NN>_<HH-MM-SS>.json`.
On Windows and Linux, Alt+Shift+B is Chrome's own "focus bookmarks bar" key, so Chrome does not assign it
automatically; set it in `chrome://extensions/shortcuts`. Until then the popup's save button shows only its
camera icon. Only `--dev` zips carry the dev files.
