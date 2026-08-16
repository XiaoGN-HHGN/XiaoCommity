// ============================================================
// Xiao · 模块 · 公共聊天大厅（Supabase Realtime）
// @用户 / Emoji / 链接自动识别 / 用户交互（私聊/好友/举报）
// 消息通过 Supabase Realtime 订阅 INSERT 事件实时推送；
// 离开页面时 onLeave 清理订阅，避免泄漏。
// ============================================================
(function (X) {
  X.modules = X.modules || {};

  const EMOJIS = ['😀','😂','🤣','😊','😍','🤔','👍','👎','❤️','🔥','✨','🎉','🚀','💡','🔬','📊','🐧','🐬','🦊','❄️','🌊','🧪','⚛️','🛰️','🌟','💯','✅','❌','⚠️','📚','💻','🎯'];
  const URL_RE = /(https?:\/\/[^\s<]+)/g;
  const MENTION_RE = /@([A-Za-z0-9_\u4e00-\u9fa5]{1,20})/g;

  const chat = {
    sub: null,        // Realtime 订阅句柄
    loaded: [],       // 已加载消息
    loading: false,

    render() {
      if (!X.auth.requireLogin()) return;
      const t = X.t;
      return `
        <section class="app-view">
          <div class="chat-wrap">
            <div class="chat-main">
              <div class="chat-head">
                <h3 style="margin:0">${t('chat.title')}</h3>
                <span class="dim" style="font-size:12px" id="ch_stat">${X.supabaseReady ? '' : '⚠ Supabase 未配置'}</span>
              </div>
              <div class="chat-body" id="ch_body"><div class="dim center" style="padding:20px">${t('common.loading') || '加载中...'}</div></div>
              <div class="chat-input">
                <button class="icon-btn" id="ch_emoji" title="${t('chat.emoji')}">😊</button>
                <textarea class="textarea" id="ch_input" data-i18n-ph="chat.placeholder" placeholder="${t('chat.placeholder')}" rows="1"></textarea>
                <button class="btn primary" id="ch_send">${t('chat.send')}</button>
              </div>
            </div>
            <div class="chat-side">
              <div class="card"><div class="card-title">${t('chat.online')}</div><div id="ch_users"><div class="dim center" style="padding:10px">...</div></div></div>
            </div>
          </div>
        </section>`;
    },

    async afterRender() {
      await this.renderMessages();
      this.renderUsers();
      const sendBtn = X.utils.$('#ch_send');
      if (sendBtn) sendBtn.addEventListener('click', () => this.send());
      const input = X.utils.$('#ch_input');
      if (input) {
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
        });
        input.addEventListener('input', e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; });
      }
      const emojiBtn = X.utils.$('#ch_emoji');
      if (emojiBtn) emojiBtn.addEventListener('click', () => this.toggleEmoji());

      // Supabase Realtime：订阅大厅新消息（表名必须对齐真实 T.MESSAGES=public_chat，不能硬编码 'messages'）
      if (X.supabaseReady) {
        const realTable = (X.store && X.store.T && X.store.T.MESSAGES) || 'messages';
        this.sub = X.realtime.onInsert(realTable, null, payload => {
          const m = payload.new;
          if (m && !this.loaded.find(x => x.id === m.id)) {
            const row = this._augment(payload.new);   // Realtime payload 可能缺 sender 快照，补一下
            this.loaded.push(row);
            this.appendMsg(row);
          }
        });
      }
    },

    /** 离开页面：清理 Realtime 订阅 */
    onLeave() {
      if (this.sub) { try { this.sub.unsubscribe(); } catch (e) {} this.sub = null; }
      this.loaded = [];
    },

    /** 渲染全部消息（首次加载） */
    async renderMessages() {
      const body = X.utils.$('#ch_body');
      if (!body) return;
      if (!X.supabaseReady) {
        body.innerHTML = '<div class="dim center" style="padding:20px">⚠ Supabase 未配置</div>';
        return;
      }
      try {
        this.loaded = await X.store.getChat(100);
        body.innerHTML = '';
        const cur = X.auth.currentUser();
        this.loaded.forEach(m => body.appendChild(this.renderMsg(m, cur)));
        body.scrollTop = body.scrollHeight;
        const stat = X.utils.$('#ch_stat');
        if (stat) stat.textContent = this.loaded.length + ' msgs';
      } catch (e) {
        body.innerHTML = '<div class="dim center" style="padding:20px">加载失败</div>';
      }
    },

    /** 增量追加单条新消息 */
    appendMsg(m) {
      const body = X.utils.$('#ch_body');
      if (!body) return;
      const cur = X.auth.currentUser();
      body.appendChild(this.renderMsg(m, cur));
      body.scrollTop = body.scrollHeight;
      const stat = X.utils.$('#ch_stat');
      if (stat) stat.textContent = this.loaded.length + ' msgs';
    },

    renderMsg(m, cur) {
      // 消息行自带作者快照（username/avatar/avatar_type），无需再次查询
      const isMe = cur && m.user_id === cur.id;
      const avatar = m.avatar || '❓';
      const avatarType = m.avatar_type || 'emoji';
      const avEl = avatarType === 'dataurl'
        ? X.utils.h('img', { class: 'avatar sm clickable', src: avatar, onclick: () => this.openUser(m.user_id) })
        : X.utils.h('span', { class: 'avatar sm clickable', style: { display: 'grid', placeItems: 'center', fontSize: '14px' }, onclick: () => this.openUser(m.user_id) }, [avatar]);
      const meta = X.utils.h('div', { class: 'meta-col' });
      const name = X.utils.h('div', { class: 'name' }, [(m.username || '?') + ' · ' + X.utils.relTime(m.created_at)]);
      const bubble = X.utils.h('div', { class: 'bubble' + (isMe ? ' me' : '') });
      bubble.innerHTML = this.format(m.text || '');
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

    /** 补全行渲染需要的字段（兼容 DB 只存基础列 / Realtime payload 缺快照） */
    _augment(raw) {
      if (!raw) return raw;
      const cur = X.auth.currentUser();
      const row = Object.assign({}, raw);
      if (!row.user_id) row.user_id = row.sender_id || raw.user_id;
      if (!row.text)    row.text    = row.content || raw.text || '';
      if (!row.username && cur && cur.id === (row.sender_id || row.user_id)) {
        row.username    = cur.username;
        row.avatar      = cur.avatar;
        row.avatar_type = cur.avatar_type;
      }
      if (!row.created_at) row.created_at = raw.created_at || new Date().toISOString();
      return row;
    },

    async send() {
      if (!X.auth.requireLogin()) return;
      const cur = X.auth.currentUser();
      if (X.auth.isMuted(cur)) { X.ui.toast(X.t('err.noPerm'), 'err'); return; }
      const input = X.utils.$('#ch_input');
      const text = input.value.trim();
      if (!text) return;
      const btn = X.utils.$('#ch_send');
      if (btn) { btn.disabled = true; }
      try {
        // 【Fix: 消息被"虚空吞噬"】之前只 await 结果但不手动 append，
        // 依赖 Realtime 推送，但 Realtime 经常没在 Dashboard 开或表名错订阅不上。
        // 现在拿到 insert 返回的行立刻 append 到列表，100% 显示不依赖推送。
        const inserted = await X.store.addMessage({
          userId: cur.id, username: cur.username, avatar: cur.avatar, avatarType: cur.avatar_type, text
        });
        if (inserted) {
          const row = this._augment(inserted);
          // 去重：Realtime 如果同时推送，防止重复渲染
          if (!this.loaded.find(x => x.id === row.id)) {
            this.loaded.push(row);
            this.appendMsg(row);
          }
        }
      } catch (e) {
        console.debug('[Xiao] chat send fail →', e && e.message);
        X.ui.toast('发送失败', 'err');
      } finally {
        input.value = ''; input.style.height = 'auto';
        if (btn) btn.disabled = false;
        input.focus();
      }
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
    async renderUsers() {
      const box = X.utils.$('#ch_users');
      if (!box) return;
      if (!X.supabaseReady) { box.innerHTML = '<div class="dim center">未配置</div>'; return; }
      try {
        const users = await X.store.getUsers();
        const cur = X.auth.currentUser();
        box.innerHTML = '';
        users.slice(0, 30).forEach(u => {
          const av = u.avatar_type === 'dataurl'
            ? X.utils.h('img', { class: 'avatar sm', src: u.avatar })
            : X.utils.h('span', { class: 'avatar sm', style: { display: 'grid', placeItems: 'center', fontSize: '14px' } }, [u.avatar]);
          const online = Math.random() > 0.5; // 演示在线状态
          const row = X.utils.h('div', { class: 'user-online' + (online ? '' : ' off'), onclick: () => this.openUser(u.id) }, [
            X.utils.h('span', { class: 'dot' }), av,
            X.utils.h('span', { class: 's' }, [u.username + (cur && u.id === cur.id ? ' (me)' : '')])
          ]);
          box.appendChild(row);
        });
      } catch (e) {
        box.innerHTML = '<div class="dim center">加载失败</div>';
      }
    },

    /** 点击用户 → 详情弹窗：发起私聊 / 好友申请 / 举报 */
    openUser(userId) {
      X.modules.social.openUserCard(userId);
    }
  };

  X.modules.chat = chat;
  X.router.register('chat', {
    render: () => chat.render(),
    afterRender: () => chat.afterRender(),
    onLeave: () => chat.onLeave()
  });
})(window.Xiao = window.Xiao || {});
