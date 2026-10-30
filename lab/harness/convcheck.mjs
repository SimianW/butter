import { chromium } from 'playwright';
// Lists the user turns the server has for $CHAT (checks that benchmark replays never reached the server).
const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const p = b.contexts()[0].pages().find(x => x.url().startsWith('https://chatgpt.com'));
const r = await p.evaluate(async id => {
  const tok = (await (await fetch('/api/auth/session')).json()).accessToken;
  const c = await (await fetch('/backend-api/conversation/' + id, { headers: { authorization: 'Bearer ' + tok } })).json();
  const users = Object.values(c.mapping || {}).filter(n => n.message?.author?.role === 'user').map(n => (n.message.content.parts?.[0] || '').slice(0, 20));
  return { title: c.title, users };
}, process.env.CHAT.match(/\/c\/([^/?#]+)/)[1]);
console.log(r);
await b.close();
