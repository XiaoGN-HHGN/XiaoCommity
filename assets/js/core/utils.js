// ============================================================
// Xiao · 核心层 · 工具函数
// DOM/转义/防抖/时间/ID/校验
// ============================================================
(function (X) {
  const utils = {
    /** 简易选择器 */
    $: (sel, root = document) => root.querySelector(sel),
    $$: (sel, root = document) => Array.from(root.querySelectorAll(sel)),

    /** 创建元素 + 属性 + 子节点 */
    h(tag, attrs = {}, children = []) {
      const el = document.createElement(tag);
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else el.setAttribute(k, v);
      }
      const kids = Array.isArray(children) ? children : [children];
      kids.forEach(c => {
        if (c == null || c === false) return;
        el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
      return el;
    },

    /** 转义 HTML，防注入 */
    escape(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    /** 防抖 */
    debounce(fn, wait = 200) {
      let t;
      return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), wait); };
    },

    /** requestAnimationFrame 节流 */
    rafThrottle(fn) {
      let scheduled = false, ctx, args;
      return function (...a) { ctx = this; args = a; if (scheduled) return; scheduled = true; requestAnimationFrame(() => { fn.apply(ctx, args); scheduled = false; }); };
    },

    /** 短ID */
    uid(prefix = 'id') {
      return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },

    /** 格式化时间 */
    time(ts) {
      const d = new Date(ts);
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    /** 相对时间 */
    relTime(ts) {
      const diff = Date.now() - ts;
      const s = Math.floor(diff / 1000);
      if (s < 60) return s + 's';
      const m = Math.floor(s / 60); if (m < 60) return m + 'm';
      const h = Math.floor(m / 60); if (h < 24) return h + 'h';
      const d = Math.floor(h / 24); if (d < 30) return d + 'd';
      return utils.time(ts).slice(0, 10);
    },

    /** 校验手机号（中国/通用） */
    isPhone(s) { return /^[0-9]{6,15}$/.test(String(s).replace(/[\s-]/g, '')); },

    /** 简单密码强度（>=6位） */
    isPassword(s) { return typeof s === 'string' && s.length >= 6; },

    /** 数字限制范围 */
    clamp(n, min, max) { return Math.min(max, Math.max(min, n)); },

    /** 随机默认头像 emoji */
    randAvatar() {
      const list = ['🐧', '🐬', '🦊', '❄️', '🌊', '🔬', '🧪', '⚛️', '🛰️', '📊', '🧬', '🌌'];
      return list[Math.floor(Math.random() * list.length)];
    },

    /** 读取文件为文本 */
    readText(file) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsText(file);
      });
    },

    /** 读取文件为 DataURL（用于头像上传） */
    readDataURL(file) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
    },

    /** 格式化代币数量 */
    coin(n) {
      n = Number(n) || 0;
      return n.toFixed(n >= 1 ? 2 : 4).replace(/\.?0+$/, '') || '0';
    },

    /** 下载文本为文件 */
    downloadText(filename, text, type = 'text/plain') {
      const blob = new Blob([text], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    /** 复制到剪贴板 */
    async copy(text) {
      try { await navigator.clipboard.writeText(text); return true; }
      catch { return false; }
    }
  };

  X.utils = utils;
})(window.Xiao = window.Xiao || {});
