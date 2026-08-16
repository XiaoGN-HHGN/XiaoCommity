// ============================================================
// Xiao · 核心层 · 路由
// 基于 location.hash 的轻量路由（适配 GitHub Pages 静态托管）
// 模块通过 router.register(name, cfg) 注册页面
// ============================================================
(function (X) {
  const router = {
    routes: {},
    current: null,
    listeners: new Set(),

    /** 注册路由 */
    register(name, cfg) {
      this.routes[name] = cfg;
    },

    /** 解析当前 hash */
    parse() {
      const raw = location.hash.replace(/^#\/?/, '') || 'home';
      const [name, ...rest] = raw.split('/');
      return { name: name || 'home', params: rest };
    },

    /** 跳转 */
    go(name, ...params) {
      const hash = '#/' + [name, ...params].filter(Boolean).join('/');
      if (location.hash === hash) { this.render(); }
      else location.hash = hash;
    },

    /** 渲染当前路由 */
    async render() {
      const { name, params } = this.parse();
      const view = X.utils.$('#appView');
      const loader = X.utils.$('.loader-line');
      if (loader) loader.classList.add('active');

      // 路由切换前清理上一页资源（Realtime 订阅 / 定时器等）
      if (this.current && this.current.name !== name) {
        const prevCfg = this.routes[this.current.name];
        if (prevCfg && typeof prevCfg.onLeave === 'function') {
          try { await prevCfg.onLeave(this.current.params, view); }
          catch (e) { console.warn('route onLeave error', this.current.name, e); }
        }
      }

      this.current = { name, params };
      const cfg = this.routes[name];

      // 未找到路由
      if (!cfg) {
        view.innerHTML = '<div class="dev-placeholder"><div class="ico">🧭</div><h2>404</h2><p>' + X.utils.escape(name) + '</p><button class="btn primary" onclick="location.hash=\'#/home\'">回到首页</button></div>';
        this.updateNav();
        if (loader) loader.classList.remove('active');
        return;
      }

      // 权限校验（临时管理员兑换码可绕过 requiresAuth 访问 admin）
      const tempAdmin = localStorage.getItem('xiao.tempAdmin') === '1';
      if (cfg.requiresAuth && !X.auth.isLogin() && !tempAdmin) {
        X.ui.toast(X.t('err.notLogin'), 'err');
        this.go('login');
        return;
      }
      if (cfg.requiresAdmin && !X.auth.isAdmin()) {
        X.ui.toast(X.t('err.noPerm'), 'err');
        this.go('home');
        return;
      }

      try {
        const html = await cfg.render(params, view);
        if (typeof html === 'string') view.innerHTML = html;
        // afterRender 支持 await（异步绑定 / Realtime 订阅）
        if (typeof cfg.afterRender === 'function') {
          await cfg.afterRender(params, view);
        }
        X.i18n.engine.applyDOM(view);
      } catch (e) {
        console.error('route render error', name, e);
        view.innerHTML = '<div class="dev-placeholder"><div class="ico">⚠️</div><p>渲染异常：' + X.utils.escape(e.message) + '</p></div>';
      } finally {
        if (loader) loader.classList.remove('active');
        this.updateNav();
        this.listeners.forEach(fn => { try { fn(name, params); } catch (e) { console.error(e); } });
      }
    },

    /** 更新顶部导航高亮 */
    updateNav() {
      const cur = this.parse().name;
      X.utils.$$('.nav a').forEach(a => {
        a.classList.toggle('active', a.dataset.route === cur);
      });
    },

    /** 订阅路由变化 */
    onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },

    /** 初始化 */
    init() {
      window.addEventListener('hashchange', () => this.render());
      // 首次进入：若无 hash，默认首页
      if (!location.hash) location.hash = '#/home';
      else this.render();
    }
  };

  X.router = router;
})(window.Xiao = window.Xiao || {});
