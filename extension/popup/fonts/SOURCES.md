# Bundled popup fonts

- Bagel Fat One Regular, subset to the word “Butter”: `bagel-wordmark.woff2` (3,152 bytes).
- Nunito variable, Latin/punctuation subset: `nunito-latin.woff2` (33,140 bytes).
- Original OFL notices: `Bagel-Fat-One-OFL.txt` and `Nunito-OFL.txt` (8,870 bytes combined).

Font payload: 36,292 bytes. Fonts plus licenses: 45,162 bytes.
Chinese uses PingFang SC, Microsoft YaHei or the system fallback. No remote font loading.

Sources: <https://github.com/google/fonts/tree/main/ofl/bagelfatone> and
<https://github.com/google/fonts/tree/main/ofl/nunito>. Subsets were made with fontTools and Brotli:
Bagel uses `Subsetter.populate(text='Butter')`; Nunito includes U+0020–U+00FF, U+2013,
U+2014, U+2018, U+2019, U+201C, U+201D and U+2026. Both save with `font.flavor = 'woff2'`.
