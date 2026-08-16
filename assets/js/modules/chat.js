// ============================================================
// Xiao · 模块 · 公共聊天大厅
// @用户 / Emoji / 链接自动识别 / 用户交互（私聊/好友/举报）
// ============================================================
(function (X) {
  X.modules = X.modules || {};

  const EMOJIS = ['😀','😂','🤣','😊','😍','🤔','👍','👎','❤️','🔥','✨','🎉','🚀','💡','🔬','📊','🐧','🐬','🦊','❄️','🌊','🧪','⚛️','🛰️','🌟','💯','✅','❌','⚠️','📚','💻','🎯'];
  const URL_RE = /(https?:\/\/[^\s<]+)/g;
  const MENTION_RE = /@([A-Za-z0-9_\u4e00-\u9fa5]{1,20})/g;

  const chat = {
    lastLen: 0,
    pollTimer: null,

    render() {
      if (!X.auth.requireLogin()) return;
      const t = X.t;
      return `
        <section class="app-view">
          <div class="chat-wrap">
            <div class="chat-main">
              <div class="chat-head">
                <h3 style="margin:0">${t('chat.title')}</h3>
                <span class="dim" style="font-size:12px" id="ch_stat"></span>
              </div>
              <div class="chat-body" id="ch_body"></div>
              <div class="chat-input">
                <button class="icon-btn" id="ch_emoji" title="${t('chat.emoji')}">😊</button>
                <textarea class="textarea" id="ch_input" data-i18n-ph="chat.placeholder" placeholder="${t('chat.placeholder')}" rows="1"></textarea>
                <button class="btn primary" id="ch_send">${t('chat.send')}</button>
              </div>
            </div>
            <div class="chat-side">
              <div class="card"><div class="card-title">${t('chat.online')}</div><div id="ch_users"></div></div>
            </div>
          </div>
        </section>`;
    },

    afterRender() {
      this.renderMessages();
      this.renderUsers();
      X.utils.$('#ch_send').addEventListener('click', () => this.send());
      X.utils.$('#ch_input').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
      });
      X.utils.$('#ch_input').addEventListener('input', e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; });
      X.utils.$('#ch_emoji').addEventListener('click', () => this.toggleEmoji());

      // 跨标签同步 + 定时轮询（本地模拟实时）
      window.addEventListener('storage', e => { if (e.key === X.store.K.CHAT) this.renderMessages(); });
      this.pollTimer = setInterval(() => this.renderMessages(true), 1500);
    },

    /** 渲染消息（增量追加） */
    renderMessages(appendOnly = false) {
      const body = X.utils.$('#ch_body');
      if (!body) return;
      const msgs = X.store.getChat();
      if (appendOnly && msgs.length === this.lastLen) return;
      const cur = X.auth.currentUser();
      body.innerHTML = '';
      msgs.forEach(m => body.appendChild(this.renderMsg(m, cur)));
      this.lastLen = msgs.length;
      body.scrollTop = body.scrollHeight;
      const stat = X.utils.$('#ch_stat');
      if (stat) stat.textContent = msgs.length + ' msgs';
    },

    renderMsg(m, cur) {
      const author = X.store.getUser(m.userId) || { username: '?', avatar: '❓', avatarType: 'emoji' };
      const isMe = cur && m.userId === cur.id;
      const avEl = author.avatarType === 'dataurl'
        ? X.utils.h('img', { class: 'avatar sm clickable', src: author.avatar, onclick: () => this.openUser(author.id) })
        : X.utils.h('span', { class: 'avatar sm clickable', style: { display: 'grid', placeItems: 'center', fontSize: '14px' }, onclick: () => this.openUser(author.id) }, [author.avatar]);
      const meta = X.utils.h('div', { class: 'meta-col' });
      const name = X.utils.h('div', { class: 'name' }, [author.username + (author.role === 'super' || author.role === 'admin' ? ' ✦' : '') + ' · ' + X.utils.relTime(m.ts)]);
      const bubble = X.utils.h('div', { class: 'bubble' + (isMe ? ' me' : '') });
      bubble.innerHTML = this.format(m.text);
      meta.appendChild(name); meta.appendChild(bubble);
      const row = X.utils.h('div', { class: 'msg' + (isMe ? ' me' : '') }, [avEl, meta]);
      return row;
    },

    /** 格式化消息：转义 → 链接 → @提及 */
    format(text) {
      let s = X.utils.escape(text);
      s = s.replace(URL_RE, '<a href="$1" target="_blank" rel="noopener">$1</a>');
      s = s.replace(MENTION_RE, (full, name) => `<span class="mention">@${name}</span>`);
      return s;
    },

    send() {
      if (!X.auth.requireLogin()) return;
      const cur = X.auth.currentUser();
      if (X.auth.isMuted(cur)) { X.ui.toast(X.t('err.noPerm'), 'err'); return; }
      const input = X.utils.$('#ch_input');
      const text = input.value.trim();
      if (!text) return;
      X.store.addMessage({ userId: cur.id, text });
      input.value = ''; input.style.height = 'auto';
      this.renderMessages();
    },

    /** Emoji 面板 */
    toggleEmoji() {
      const old = X.utils.$('#ch_emojipanel');
      if (old) { old.remove(); return; }
      const panel = X.utils.h('div', { class: 'emoji-panel', id: 'ch_emojipanel' });
      EMOJIS.forEach(e => {
        panel.appendChild(X.utils.h('button', { onclick: () => {
          const inp = X.utils.$('#ch_input');
          inp.value += e; inp.focus();
          panel.remove();
        } }, [e]));
      });
      X.utils.$('.chat-input').insertBefore(panel, X.utils.$('#ch_input'));
    },

    /** 在线用户列表 */
    renderUsers() {
      const box = X.utils.$('#ch_users');
      if (!box) return;
      const users = X.store.getUsers();
      const cur = X.auth.currentUser();
      box.innerHTML = '';
      users.slice(0, 30).forEach(u => {
        const av = u.avatarType === 'dataurl'
          ? X.utils.h('img', { class: 'avatar sm', src: u.avatar })
          : X.utils.h('span', { class: 'avatar sm', style: { display: 'grid', placeItems: 'center', fontSize: '14px' } }, [u.avatar]);
        const online = Math.random() > 0.5; // 演示
        const row = X.utils.h('div', { class: 'user-online' + (online ? '' : ' off'), onclick: () => this.openUser(u.id) }, [
          X.utils.h('span', { class: 'dot' }), av,
          X.utils.h('span', { class: 's' }, [u.username + (u.id === cur.id ? ' (me)' : '')])
        ]);
        box.appendChild(row);
      });
    },

    /** 点击用户 → 详情弹窗：发起私聊 / 好友申请 / 举报 */
    openUser(userId) {
      X.modules.social.openUserCard(userId);
    }
  };

  X.modules.chat = chat;
  X.router.register('chat', { render: () => chat.render(), afterRender: () => chat.afterRender() });
})(window.Xiao = window.Xiao || {});
