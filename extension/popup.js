// Translations and Lucide SVG paths from the approved popup mockup (lucide-static 1.66.0).
const ICON = "icons/icon-128.png";
const IC = {"sparkles":"<path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\"/> <path d=\"M20 2v4\"/> <path d=\"M22 4h-4\"/> <circle cx=\"4\" cy=\"20\" r=\"2\"/>","alert":"<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"/> <path d=\"M12 9v4\"/> <path d=\"M12 17h.01\"/>","pause":"<circle cx=\"12\" cy=\"12\" r=\"10\"/> <line x1=\"10\" x2=\"10\" y1=\"15\" y2=\"9\"/> <line x1=\"14\" x2=\"14\" y1=\"15\" y2=\"9\"/>","chat":"<path d=\"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z\"/> <path d=\"M7 11h10\"/> <path d=\"M7 15h6\"/> <path d=\"M7 7h8\"/>","right":"<path d=\"m9 18 6-6-6-6\"/>","left":"<path d=\"m15 18-6-6 6-6\"/>","log":"<path d=\"M15 12h-5\"/> <path d=\"M15 8h-5\"/> <path d=\"M19 17V5a2 2 0 0 0-2-2H4\"/> <path d=\"M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3\"/>","ext":"<path d=\"M15 3h6v6\"/> <path d=\"M10 14 21 3\"/> <path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\"/>","lang":"<path d=\"m5 8 6 6\"/> <path d=\"m4 14 6-6 2-3\"/> <path d=\"M2 5h12\"/> <path d=\"M7 2h1\"/> <path d=\"m22 22-5-10-5 10\"/> <path d=\"M14 18h6\"/>","ok":"<circle cx=\"12\" cy=\"12\" r=\"10\"/> <path d=\"m16 9-5.5 5.5L8 12\"/>","fail":"<circle cx=\"12\" cy=\"12\" r=\"10\"/> <path d=\"m15 9-6 6\"/> <path d=\"m9 9 6 6\"/>","wait":"<path d=\"M10.1 2.182a10 10 0 0 1 3.8 0\"/> <path d=\"M13.9 21.818a10 10 0 0 1-3.8 0\"/> <path d=\"M17.609 3.721a10 10 0 0 1 2.69 2.7\"/> <path d=\"M2.182 13.9a10 10 0 0 1 0-3.8\"/> <path d=\"M20.279 17.609a10 10 0 0 1-2.7 2.69\"/> <path d=\"M21.818 10.1a10 10 0 0 1 0 3.8\"/> <path d=\"M3.721 6.391a10 10 0 0 1 2.7-2.69\"/> <path d=\"M6.391 20.279a10 10 0 0 1-2.69-2.7\"/>","off":"<path d=\"m2 2 20 20\"/> <path d=\"M8.35 2.69A10 10 0 0 1 21.3 15.65\"/> <path d=\"M19.08 19.08A10 10 0 1 1 4.92 4.92\"/>"};
const svg = k => `<svg class="i" viewBox="0 0 24 24">${IC[k]}</svg>`;

const T = {
  en: {
    items: [
      ["Faster long-chat rendering", "Streamed updates no longer restyle the whole chat"],
      ["Skip off-screen content", "Messages out of view aren't laid out"],
      ["Stream throttle", "Answers redraw every 250 ms, not every frame"],
      ["Load history in small batches", "2 turns per request, so typing doesn't stall"],
      ["Question rail", "Slim rail on the right: hover to preview, click to jump"],
    ],
    chip: { ok: "Working", fail: "Broken", wait: "Not yet checked", off: "Off", paused: "Paused" },
    cards: {
      ok: ["All 5 working", "This chat is running smooth"],
      warn: ["1 of 5 broken", "ChatGPT may have changed · Details"],
      paused: ["Butter is paused", "ChatGPT runs as is"],
      away: ["Open a ChatGPT chat", "Butter checks each one on chatgpt.com"],
    },
    enable: "Enable on ChatGPT", hintOn: "Turn off to restore ChatGPT instantly", hintOff: "Takes effect immediately",
    settings: "Status & settings", changelog: "Changelog", opt: "Optimizations", general: "General", language: "Language",
    note: "Checked live on the current ChatGPT tab. Not yet checked: nothing has exercised it yet, e.g. the stream throttle waits for an answer to stream.",
    banner: "Butter is paused. Switch changes apply when you resume.",
  },
  zh: {
    items: [
      ["长对话渲染加速", "避免每次输出时重算整段对话的样式"],
      ["屏幕外内容跳过渲染", "看不见的消息不参与排版"],
      ["流式输出限频", "回答每 250 ms 刷新一次，而不是每帧"],
      ["分批加载历史消息", "每次只加载 2 轮，加载时不卡输入"],
      ["问题导航条", "右侧细条，悬停预览、点击跳转"],
    ],
    chip: { ok: "正常", fail: "已失效", wait: "待验证", off: "已关闭", paused: "已暂停" },
    cards: {
      ok: ["5 项优化全部正常", "当前 ChatGPT 对话很顺滑"],
      warn: ["1 项优化已失效", "ChatGPT 可能更新了页面 · 查看详情"],
      paused: ["Butter 已暂停", "ChatGPT 按原样运行"],
      away: ["打开 ChatGPT 对话", "在 chatgpt.com 上即可检测各项优化"],
    },
    enable: "在 ChatGPT 上启用", hintOn: "关闭后 ChatGPT 立即恢复原样", hintOff: "打开后立即生效",
    settings: "检测与设置", changelog: "更新日志", opt: "优化项", general: "通用", language: "语言",
    note: "实时检测当前 ChatGPT 标签页。待验证：还没遇到能确认它的场景，比如流式限频要等一次回答输出。",
    banner: "Butter 已暂停。可以先调整单项开关，恢复后生效。",
  },
};
const CHIP_ICON = { ok: "ok", fail: "fail", wait: "wait", off: "off", paused: "pause" };
const chip = (t, k, text) => `<span class="chip ${k}">${svg(CHIP_ICON[k])}${text ?? t.chip[k]}</span>`;

const head = () => `<div class="hd"><img src="${ICON}" alt=""><div><div class="name">Butter</div><div class="ver">${chrome.runtime.getManifest().version_name}</div></div></div>`;
const foot = t => `<div class="ft"><a href="#" data-page="settings">${t.settings}${svg("right")}</a>
  <span class="links"><a target="_blank" rel="noopener" href="https://github.com/SimianW/butter/blob/main/CHANGELOG.md">${svg("log")}${t.changelog}</a><a target="_blank" rel="noopener" href="https://github.com/SimianW/butter">${svg("ext")}GitHub</a></span></div>`;

function home(t, kind) {
  const cls = { ok: "", warn: "warn", paused: "muted", away: "muted" }[kind];
  const ic = { ok: "sparkles", warn: "alert", paused: "pause", away: "chat" }[kind];
  let [big, sub] = t.cards[kind];
  if (kind === "warn") big = prefs.lang === "zh" ? `${broken} 项优化已失效` : `${broken} of 5 broken`;
  if (kind === "ok" && counts.ok !== 5) {
    // Nothing broken, but not every item is confirmed: say so instead of "All 5 working".
    const zh = prefs.lang === "zh";
    big = zh ? "未发现失效项" : "Nothing broken";
    sub = ["ok", "wait", "off"].filter(k => counts[k]).map(k => zh ? `${counts[k]} 项${t.chip[k]}` : `${counts[k]} ${t.chip[k].toLowerCase()}`).join(" · ");
  }
  const on = prefs.enabled;
  return `${head()}<button class="card ${cls}" data-page="settings"><span class="badge">${svg(ic)}</span><div><div class="big">${big}</div><div class="sub">${sub}</div></div><span class="chev">${svg("right")}</span></button>
    <div class="sw-row"><div><div class="lbl">${t.enable}</div><div class="hint">${on ? t.hintOn : t.hintOff}</div></div>
    <button class="switch ${on ? "on" : ""}" role="switch" aria-checked="${on}" aria-label="${t.enable}" data-switch="master"></button></div>${foot(t)}`;
}

function settings(t, lang, states, paused) {
  const counts = {};
  states.forEach(s => counts[s] = (counts[s] || 0) + 1);
  const tally = paused ? "" : `<div class="tally">${["ok","wait","fail","off"].filter(k => counts[k])
    .map(k => chip(t, k, `${counts[k]} ${t.chip[k]}`)).join("")}</div>`;
  const banner = paused ? `<div class="banner">${svg("pause")}<span>${t.banner}</span></div>` : "";
  const rows = t.items.map(([n, d], i) => {
    const s = paused ? "paused" : states[i];
    const on = prefs.opts[ButterStatus.keys[i]];
    return `<div class="item"><div class="txt"><div class="n">${n}</div><div class="d">${d}</div>
      <div class="stat">${chip(t, s)}</div></div>
      <button class="switch sm ${on ? "on" : ""} ${paused ? "dim" : ""}" role="switch" aria-checked="${on}" aria-label="${n}" data-switch="${ButterStatus.keys[i]}"></button></div>`;
  }).join("");
  return `<div class="bar"><button class="back" data-page="home" aria-label="${lang === "zh" ? "返回" : "Back"}">${svg("left")}</button><span class="title">${t.settings}</span></div>
    ${tally}${banner}<div class="list">${rows}</div>
    ${paused ? "" : `<div class="note">${t.note}</div>`}
    <div class="sec">${t.general}</div>
    <div class="lang">${svg("lang")}<span class="lbl">${t.language}</span>
      <span class="seg"><button data-lang="en" aria-pressed="${lang === "en"}" class="${lang === "en" ? "on" : ""}">English</button><button data-lang="zh" aria-pressed="${lang === "zh"}" class="${lang === "zh" ? "on" : ""}">中文</button></span></div>`;
}


let prefs = ButterStatus.normalize(), page = 'home', states = {}, connected = false, broken = 0, counts = {};
const root = document.getElementById('popup');
const scheme = matchMedia('(prefers-color-scheme: dark)');
const theme = () => root.classList.toggle('dark', scheme.matches);
scheme.addEventListener('change', theme); theme();

// Preserve switch nodes, focus and transitions when a live status changes.
function patch(old, next) {
  if (!old || old.nodeType !== next.nodeType || old.nodeName !== next.nodeName) {
    old?.replaceWith(next.cloneNode(true)); return;
  }
  if (old.nodeType === Node.TEXT_NODE) { if (old.data !== next.data) old.data = next.data; return; }
  for (const a of [...old.attributes]) if (!next.hasAttribute(a.name)) old.removeAttribute(a.name);
  for (const a of next.attributes) if (old.getAttribute(a.name) !== a.value) old.setAttribute(a.name, a.value);
  const before = [...old.childNodes], after = [...next.childNodes];
  after.forEach((n, i) => before[i] ? patch(before[i], n) : old.append(n.cloneNode(true)));
  before.slice(after.length).forEach(n => n.remove());
}
function render() {
  const t = T[prefs.lang];
  document.documentElement.lang = prefs.lang === 'zh' ? 'zh-CN' : 'en';
  const values = ButterStatus.keys.map(k => !prefs.opts[k] ? 'off' : states[k] === 'off' ? 'wait' : states[k] || 'wait');
  broken = values.filter(s => s === 'fail').length;
  counts = {}; values.forEach(s => counts[s] = (counts[s] || 0) + 1);
  const kind = !prefs.enabled ? 'paused' : !connected ? 'away' : broken ? 'warn' : 'ok';
  const template = document.createElement('template');
  template.innerHTML = page === 'home' ? home(t, kind) : settings(t, prefs.lang, values, !prefs.enabled);
  const wrapper = document.createElement('div'); wrapper.append(template.content);
  patch(root.firstElementChild, wrapper);
  if (!root.firstElementChild) root.append(wrapper);
}
async function save() { render(); await chrome.storage.local.set({ butter: prefs }); }
root.addEventListener('click', e => {
  const target = e.target.closest('[data-page], [data-switch], [data-lang]');
  if (!target) return;
  e.preventDefault();
  if (target.dataset.page) {
    page = target.dataset.page; render(); root.scrollTop = 0;
    root.querySelector(page === 'settings' ? '.back' : '.card')?.focus({ preventScroll: true });
  } else if (target.dataset.switch) {
    const key = target.dataset.switch;
    if (key === 'master') prefs.enabled = !prefs.enabled;
    else prefs.opts[key] = !prefs.opts[key];
    save();
  } else { prefs.lang = target.dataset.lang; save(); }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.butter) { prefs = ButterStatus.normalize(changes.butter.newValue); render(); }
});
let polling = false;
async function poll() {
  if (polling) return;
  polling = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'butter-status' });
    if (!response?.states) throw new Error('No Butter receiver');
    states = response.states; connected = true;
  } catch { states = {}; connected = false; }
  finally { polling = false; render(); }
}
chrome.storage.local.get('butter').then(value => { prefs = ButterStatus.normalize(value.butter); render(); poll(); });
const timer = setInterval(poll, 1000);
addEventListener('pagehide', () => clearInterval(timer), { once: true });
render();
