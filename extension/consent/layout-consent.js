// ISOLATED world: consent stays in extension settings; the page receives only off markers.
(() => {
  const T = {
    zh: {
      t: 'Butter 现在可以记住长对话的布局',
      d: '以后拖到之前看过的地方，会快很多。只在你的电脑上保存高度和位置这类数字，不保存聊天文字，也不上传任何东西。',
      link: '隐私政策',
      yes: '好的',
      no: '不用了',
    },
    en: {
      t: 'Butter can now remember long-chat layouts',
      d: 'Jumping back to parts you have read gets much faster. Only numbers such as heights and positions are saved, on this computer. No chat text, and nothing is uploaded.',
      link: 'Privacy policy',
      yes: 'Sounds good',
      no: 'No thanks',
    },
  };
  let settings = ButterStatus.normalize(),
    ready = false,
    loaded = false,
    version = 0,
    choosing = false;
  const card = ButterCard('chatgpt-butter-consent', (e) => {
    if (!e.isTrusted) return;
    const button = e.target.closest('button[data-choice]');
    if (button) choose(button.dataset.choice === 'yes').catch(() => {});
  });
  async function choose(granted) {
    if (choosing) return;
    choosing = true;
    try {
      // Re-read so a simultaneous language/master change in the popup is preserved.
      const { butter } = await chrome.storage.local.get('butter');
      settings = ButterStatus.normalize(butter);
      if (settings.layoutConsent === 'pending') {
        settings = ButterStatus.chooseLayout(settings, granted);
        await chrome.storage.local.set({ butter: settings });
      }
      render();
    } finally {
      choosing = false;
    }
  }
  function render() {
    if (!ready || !loaded || !document.documentElement) return;
    if (!settings.enabled || settings.layoutConsent !== 'pending') {
      card.hide(settings.layoutConsent !== 'pending');
      return;
    }
    const t = T[settings.lang];
    card.fill(
      settings.lang,
      t.t,
      t.d,
      t.link,
      `<button type="button" data-choice="no">${t.no}</button><button type="button" class="yes" data-choice="yes">${t.yes}</button>`,
    );
    card.show();
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.butter) return;
    version++;
    settings = ButterStatus.normalize(changes.butter.newValue);
    render();
  });
  chrome.storage.local.get('butter').then(({ butter }) => {
    if (!version) settings = ButterStatus.normalize(butter);
    loaded = true;
    render();
  });
  const start = () =>
    setTimeout(() => {
      ready = true;
      render();
    }, 1000);
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
})();
