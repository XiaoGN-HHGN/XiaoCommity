// ============================================================
// Xiao · 核心层 · i18n 国际化引擎
// 提供 t(key)、setLang()、applyDOM()、事件订阅
// ============================================================
(function (X) {
  const STORAGE_KEY = 'xiao.lang';
  const DEFAULT_LANG = 'zh-CN';
  const SUPPORTED = ['zh-CN', 'en', 'ru'];

  const i18n = {
    lang: DEFAULT_LANG,
    listeners: new Set(),

    /** 初始化：读取偏好语言 */
    init() {
      const saved = localStorage.getItem(STORAGE_KEY);
      this.lang = SUPPORTED.includes(saved) ? saved : DEFAULT_LANG;
      // 确保 zh-CN 作为兜底
      this.messages = X.i18n.messages || {};
      this.applyDOM();
      return this.lang;
    },

    /** 取当前语言对应文案，支持 {0} 占位 */
    t(key, ...args) {
      const dict = this.messages[this.lang] || this.messages[DEFAULT_LANG] || {};
      let s = dict[key];
      if (s == null) {
        // 回退到默认语言
        s = (this.messages[DEFAULT_LANG] || {})[key];
      }
      if (s == null) return key;
      if (args.length) {
        args.forEach((a, i) => { s = s.replace('{' + i + '}', String(a)); });
      }
      return s;
    },

    /** 切换语言并广播 */
    setLang(lang) {
      if (!SUPPORTED.includes(lang)) return;
      this.lang = lang;
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
      this.applyDOM();
      this.listeners.forEach(fn => { try { fn(lang); } catch (e) { console.error(e); } });
    },

    /** 遍历 DOM 中 [data-i18n] 节点回填文案 */
    applyDOM(root = document) {
      root.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = this.t(key);
        if (text) el.textContent = text;
      });
      root.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.getAttribute('data-i18n-ph');
        const text = this.t(key);
        if (text) el.setAttribute('placeholder', text);
      });
      root.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const text = this.t(key);
        if (text) el.setAttribute('title', text);
      });
      // 语言切换按钮高亮
      document.querySelectorAll('.lang-switch button').forEach(b => {
        b.classList.toggle('active', b.dataset.lang === this.lang);
      });
      document.documentElement.lang = this.lang;
    },

    /** 订阅语言变更 */
    onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  };

  X.i18n.engine = i18n;
  // 便捷全局函数
  X.t = (key, ...a) => i18n.t(key, ...a);
})(window.Xiao = window.Xiao || {});
