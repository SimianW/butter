# Recordings

A recording is a GIF that shows a behaviour happening on the page. A harness script makes it, so
the same steps run again on another build. Two cases need one.

## A bug claim

Before you tell the user that you found or reproduced a bug they can see, record the bug happening
and show them the GIF. Without a recording the claim is "not reproduced": say that, and say what
you have instead (the user's capture, a red test).

## A PR with a visible change

A new feature, a changed look, or a fixed bug the user could see. The PR body's Evidence section
shows the same steps on both builds:

```markdown
| Before (`main` at `<sha>`) | After (`<sha>`) |
|---|---|
| ![before](https://raw.githubusercontent.com/SimianW/butter/<sha>/notes/runs/<date>-<slug>/before.gif) | ![after](https://raw.githubusercontent.com/SimianW/butter/<sha>/notes/runs/<date>-<slug>/after.gif) |
```

For a bug fix, `before.gif` is the bug claim's recording. For a new feature, it shows the page
without the feature. A PR with nothing to see writes `No visible change` in Evidence.

Done when: both GIFs play in the PR's preview and show the same steps.

## Making one

Record at the first seam in [seams.md](seams.md) that shows the behaviour:

- Fixture harness: Playwright's `recordVideo` on the script's own Chromium.
- Live lab: `ffmpeg -f x11grab` on the lab's display, as `lab/harness/rail-demo.mjs` does. Keep its
  `CROP` (the chat column and the rail: no URL bar, sidebar or account) and load a fixture chat
  from the lab's README.

Convert to a GIF of at most 10 s, 800 px wide and 3 MB. When the behaviour needs longer, save the
`.mp4` beside it and link it under the GIF.

Save both in `notes/runs/<date>-<slug>/` beside the run report. Link them by the commit SHA that
holds them, so the link works after the branch is deleted.

## Privacy

This repo is public. Watch each GIF before you commit it: it shows no account name, chat title,
URL or real chat text. The user's own screen recordings and bug files stay out of the repo and the
PR; describe them in words.
