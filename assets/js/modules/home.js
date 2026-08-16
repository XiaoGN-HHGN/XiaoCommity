// ============================================================
// Xiao · 模块 · 首页
// 展示 Xiao 介绍、企海狐释义、社区核心用途
// ============================================================
(function (X) {
  X.modules = X.modules || {};

  X.modules.home = {
    render() {
      const t = X.t;
      return `
        <section class="app-view">
          <div class="hero">
            <div class="hero-glyph">🦊</div>
            <h1>${t('home.title')}</h1>
            <p class="sub">${t('home.subtitle')}</p>
            <div class="meaning">
              <span class="tag accent">🐧</span>
              <span class="tag accent">🐬</span>
              <span class="tag accent">🦊</span>
              <span class="tag">${t('home.meaning')}</span>
            </div>
            <div class="hero-cta">
              <button class="btn primary lg" onclick="Xiao.router.go('${X.auth.isLogin() ? 'chat' : 'register'}')">${t('home.cta.start')}</button>
              <button class="btn ghost lg" onclick="Xiao.router.go('works')">${t('home.cta.explore')}</button>
            </div>
          </div>

          <div class="section-title"><h2>${t('home.feature.title')}</h2><span class="line"></span></div>
          <div class="feature-grid">
            <div class="feature"><div class="ico">💬</div><h3>${t('home.feature.chat')}</h3><p>${t('home.feature.chatDesc')}</p></div>
            <div class="feature"><div class="ico">📦</div><h3>${t('home.feature.works')}</h3><p>${t('home.feature.worksDesc')}</p></div>
            <div class="feature"><div class="ico">⚡</div><h3>${t('home.feature.editor')}</h3><p>${t('home.feature.editorDesc')}</p></div>
            <div class="feature"><div class="ico">🤝</div><h3>${t('home.feature.social')}</h3><p>${t('home.feature.socialDesc')}</p></div>
          </div>

          <div class="section-title"><h2>${t('home.coin.title')}</h2><span class="line"></span></div>
          <div class="card elev" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
            <div style="font-size:46px">✦</div>
            <div style="flex:1;min-width:240px">
              <h3 style="margin:0 0 4px">Ttpx_A · ${t('home.coin.title')}</h3>
              <p class="muted" style="margin:0">${t('home.coin.desc')}</p>
            </div>
            <div style="display:flex;gap:18px">
              <div class="center"><div class="mono" style="font-size:22px;color:var(--gold)">10</div><div class="dim" style="font-size:11px">注册赠送</div></div>
              <div class="center"><div class="mono" style="font-size:22px;color:var(--gold)">0.01</div><div class="dim" style="font-size:11px">点赞/次</div></div>
              <div class="center"><div class="mono" style="font-size:22px;color:var(--gold)">20</div><div class="dim" style="font-size:11px">建群消耗</div></div>
            </div>
          </div>

          <div class="section-title"><h2>${t('nav.video')}</h2><span class="line"></span></div>
          <div class="dev-placeholder">
            <div class="ico">🎬</div>
            <h3>${t('video.dev')}</h3>
            <p class="muted">${t('video.devDesc')}</p>
            <span class="tag warn">${t('video.dev')}</span>
          </div>
        </section>`;
    }
  };

  X.router.register('home', { render: () => X.modules.home.render() });
})(window.Xiao = window.Xiao || {});
