// ============================================================
// Xiao · 模块 · 在线代码编辑器
// JS / HTML / CSS 实时预览；Python 占位（需 Pyodide 后续接入）
// 协同创作入口：邀请好友加入同一项目（本地多标签演示）
// ============================================================
(function (X) {
  X.modules = X.modules || {};

  const editor = {
    tab: 'html',
    code: {
      html: '<h1 style="font-family:sans-serif;color:#2fe3c4">Hello Xiao 🦊</h1>\n<p>编辑左侧代码，右侧实时预览</p>',
      css: 'body{font-family:sans-serif;background:#0b1220;color:#e8f1ff;padding:20px;margin:0}\nh1{color:#2fe3c4}',
      js: 'document.addEventListener("click", e => console.log("click", e.target));\nconsole.log("Xiao editor ready");',
      python: 'print("Xiao Python (demo)\\nPython 运行需接入 Pyodide，敬请期待")'
    },

    render() {
      const t = X.t;
      return `
        <section class="app-view">
          <div class="editor-toolbar">
            <h3 style="margin:0;flex:1">${t('editor.title')}</h3>
            <div class="collab-list" id="ed_collab" title="${t('editor.collabHint')}"></div>
            <button class="btn ghost sm" id="ed_share" title="${t('editor.collab')}">🔗 ${t('editor.collab')}</button>
            <button class="btn primary sm" id="ed_run">▶ ${t('editor.run')}</button>
          </div>
          <div class="editor-wrap">
            <div class="editor-left">
              <div class="editor-tabs" id="ed_tabs">
                <button class="editor-tab active" data-lang="html">${t('editor.lang.html')}</button>
                <button class="editor-tab" data-lang="css">${t('editor.lang.css')}</button>
                <button class="editor-tab" data-lang="js">${t('editor.lang.js')}</button>
                <button class="editor-tab" data-lang="python">${t('editor.lang.python')}</button>
              </div>
              <div class="editor-host">
                <textarea id="ed_code" spellcheck="false"></textarea>
              </div>
            </div>
            <div class="editor-right">
              <div class="editor-tabs">
                <button class="editor-tab active">${t('editor.preview')}</button>
              </div>
              <div class="editor-host">
                <iframe class="editor-preview" id="ed_preview" sandbox="allow-scripts"></iframe>
              </div>
            </div>
          </div>
          <p class="hint" style="margin-top:8px">${t('editor.collabHint')} · Python 运行需接入 Pyodide（接口已预留）</p>
        </section>`;
    },

    afterRender() {
      X.utils.$$('#ed_tabs .editor-tab').forEach(b => b.addEventListener('click', () => this.switchTab(b.dataset.lang)));
      X.utils.$('#ed_code').addEventListener('input', X.utils.debounce(() => this.runPreview(), 300));
      X.utils.$('#ed_run').addEventListener('click', () => this.runPreview());
      X.utils.$('#ed_share').addEventListener('click', () => this.shareLink());
      this.loadTab();
      this.renderCollab();
    },

    switchTab(lang) {
      // 保存当前
      this.code[this.tab] = X.utils.$('#ed_code').value;
      this.tab = lang;
      X.utils.$$('#ed_tabs .editor-tab').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
      this.loadTab();
      if (lang !== 'python') this.runPreview();
    },

    loadTab() {
      const ta = X.utils.$('#ed_code');
      ta.value = this.code[this.tab] || '';
      ta.focus();
    },

    /** 组合 HTML+CSS+JS 运行预览；Python 给出提示 */
    runPreview() {
      const html = this.code.html || '';
      const css = this.code.css || '';
      const js = this.code.js || '';
      const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}<script>try{${js}}catch(e){document.body.insertAdjacentHTML('beforeend','<pre style="color:#ff6b6b;font-size:12px">'+e+'</pre>')}<\/script></body></html>`;
      const iframe = X.utils.$('#ed_preview');
      if (this.tab === 'python') {
        iframe.srcdoc = `<pre style="font-family:monospace;color:#aab8d0;padding:12px;white-space:pre-wrap">${X.utils.escape(this.code.python || '')}\n\n[Xiao] Python 运行需接入 Pyodide 后端，接口已预留</pre>`;
        return;
      }
      iframe.srcdoc = doc;
    },

    renderCollab() {
      const box = X.utils.$('#ed_collab');
      if (!box) return;
      const cur = X.auth.currentUser();
      const friends = cur ? X.store.getFriends(cur.id).slice(0, 4) : [];
      box.innerHTML = '';
      // 自己
      if (cur) box.appendChild(this.collabAvatar(cur));
      friends.forEach(fid => { const f = X.store.getUser(fid); if (f) box.appendChild(this.collabAvatar(f)); });
    },

    collabAvatar(u) {
      return u.avatarType === 'dataurl'
        ? X.utils.h('img', { class: 'collab-av', src: u.avatar, title: u.username })
        : X.utils.h('div', { class: 'collab-av', title: u.username, style: { background: 'var(--bg-3)', display: 'grid', placeItems: 'center', fontSize: '11px' } }, [u.avatar]);
    },

    async shareLink() {
      if (!X.auth.requireLogin()) return;
      // 协同：通过 URL 携带项目快照（演示多标签协同）
      const snap = btoa(unescape(encodeURIComponent(JSON.stringify(this.code))));
      const url = location.origin + location.pathname + '#/editor?s=' + snap;
      const ok = await X.utils.copy(url);
      X.ui.toast(ok ? X.t('editor.collab') + ' ✓ 链接已复制' : '复制失败，请手动复制', ok ? 'ok' : 'err');
    }
  };

  X.modules.editor = editor;
  X.router.register('editor', {
    render: () => editor.render(),
    afterRender: () => editor.afterRender()
  });
})(window.Xiao = window.Xiao || {});
