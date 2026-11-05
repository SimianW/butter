import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const extension = new URL('../extension/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', extension), 'utf8'));
const localeRoot = new URL('_locales/', extension);

async function locales() {
  const entries = await readdir(localeRoot, { withFileTypes: true });
  return Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => [
        entry.name,
        JSON.parse(await readFile(new URL(`${entry.name}/messages.json`, localeRoot), 'utf8')),
      ]),
  );
}

test('Chrome metadata declares English as default and supports Simplified Chinese', async () => {
  assert.equal(manifest.default_locale, 'en');
  assert.equal(manifest.name, '__MSG_appName__');
  assert.equal(manifest.description, '__MSG_appDesc__');
  const names = (await locales()).map(([name]) => name);
  assert.ok(names.includes('en'));
  assert.ok(names.includes('zh_CN'));
});

test('every manifest message resolves in every declared locale', async () => {
  const references = [...JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)].map(
    (match) => match[1],
  );
  assert.ok(references.length > 0);
  for (const [locale, messages] of await locales()) {
    for (const key of references) {
      assert.ok(messages[key]?.message?.trim(), `${locale} is missing ${key}`);
      assert.ok(messages[key]?.description?.trim(), `${locale}.${key} needs translator guidance`);
    }
  }
});

test('localized names and summaries fit Chrome Web Store character limits', async () => {
  for (const [locale, messages] of await locales()) {
    for (const [key, limit] of [
      ['appName', 75],
      ['appDesc', 132],
    ]) {
      assert.equal(typeof messages[key]?.message, 'string', `${locale} is missing ${key}`);
      const length = [...messages[key].message].length;
      assert.ok(
        length > 0 && length <= limit,
        `${locale}.${key}: ${length} characters; limit ${limit}`,
      );
    }
  }
});
