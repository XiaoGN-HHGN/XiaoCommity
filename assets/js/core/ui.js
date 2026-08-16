// ============================================================
// Xiao · 核心层 · UI 工具
// Toast / Modal / 导航渲染 / 用户胶囊 / 确认弹窗
// ============================================================
(function (X) {
  const ui = {
    /** Toast 提示 */
    toast(msg, type = 'info', ms = 2400) {
      const root = X.utils.$('#toastRoot');
      if (!root) return;
      const el = X.utils.h('div', { class: 'toast ' + type }, [
        X.utils.h('span', { class: 'dot' }),
        X.utils.h('span', { text: msg })
      ]);
      root.appendChild(el);
      setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => el.remove(), 260);
      }, ms);
    },

    /** 弹窗：返回控制句柄 { close, update } */
    modal({ title = '', body = '', footer = null, onClose, size }) {
      const root = X.utils.$('#modalRoot');
      const backdrop = X.utils.h('div', { class: 'modal-backdrop' });
      const modal = X.utils.h('div', { class: 'modal' + (size ? ' modal-' + size : '') });
      modal.innerHTML =
        '<div class="modal-head"><div class="modal-title">' + X.utils.escape(title) + '</div>' +
        '<button class="modal-close">×</button></div>' +
        '<div class="modal-body"></div>' +
        '<div class="modal-foot"' + (footer ? '' : ' style="display:none"') + '></div>';
      const bodyEl = X.utils.$('.modal-body', modal);
      if (typeof body === 'string') bodyEl.innerHTML = body;
      else if (body instanceof Node) bodyEl.appendChild(body);
      else if (typeof body === 'function') body(bodyEl);

      const footEl = X.utils.$('.modal-foot', modal);
      if (footer && footEl) {
        footEl.style.display = '';
        if (typeof footer === 'string') footEl.innerHTML = footer;
        else if (Array.isArray(footer)) footer.forEach(b => footEl.appendChild(b));
      }

      const close = () => {
        backdrop.classList.remove('show');
        modal.classList.remove('show');
        root.setAttribute('aria-hidden', 'true');
        setTimeout(() => { backdrop.remove(); modal.remove(); }, 240);
        if (typeof onClose === 'function') onClose();
      };
      X.utils.$('.modal-close', modal).addEventListener('click', close);
      backdrop.addEventListener('click', close);
      root.appendChild(backdrop);
      root.appendChild(modal);
      root.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => {
        backdrop.classList.add('show');
        modal.classList.add('show');
      });
      return { close, modal, bodyEl, footEl };
    },

    /** 确认弹窗（Promise<boolean>） */
    confirm(message, title = '') {
      return new Promise(resolve => {
        const ok = X.utils.h('button', { class: 'btn primary', onclick: () => { inst.close(); resolve(true); } }, [X.t('common.confirm')]);
        const cancel = X.utils.h('button', { class: 'btn ghost', onclick: () => { inst.close(); resolve(false); } }, [X.t('common.cancel')]);
        const inst = this.modal({ title, body: '<p style="margin:0">' + X.utils.escape(message) + '</p>', footer: [cancel, ok] });
      });
    },

    /** 输入弹窗（带原因必填等） */
    prompt({ title, label, placeholder = '', multiline = false, confirmText, validate }) {
      return new Promise(resolve => {
        const ta = multiline
          ? X.utils.h('textarea', { class: 'textarea', placeholder, rows: 3 })
          : X.utils.h('input', { class: 'input', placeholder });
        const err = X.utils.h('div', { class: 'error-text', style: { display: 'none' } });
        const ok = X.utils.h('button', { class: 'btn primary' }, [confirmText || X.t('common.confirm')]);
        const cancel = X.utils.h('button', { class: 'btn ghost' }, [X.t('common.cancel')]);
        ok.addEventListener('click', () => {
          const v = ta.value.trim();
          if (validate) { const r = validate(v); if (r) { err.textContent = r; err.style.display = 'block'; return; } }
          inst.close(); resolve(v);
        });
        cancel.addEventListener('click', () => { inst.close(); resolve(null); });
        const field = X.utils.h('div', { class: 'field' }, [X.utils.h('label', { class: 'label', text: label }), ta, err]);
        const inst = this.modal({ title, body: field, footer: [cancel, ok] });
        setTimeout(() => ta.focus(), 50);
      });
    },

    /** 渲染顶部导航 */
    renderNav() {
      const nav = X.utils.$('#mainNav');
      if (!nav) return;
      const items = [
        { route: 'home', key: 'nav.home' },
        { route: 'chat', key: 'nav.chat' },
        { route: 'works', key: 'nav.works' },
        { route: 'editor', key: 'nav.editor' },
        { route: 'profile', key: 'nav.profile', auth: true },
        { route: 'video', key: 'nav.video', dev: true },
        { route: 'contact', key: 'nav.contact' }
      ];
      // 管理员可见
      if (X.auth.isAdmin()) items.splice(items.length - 2, 0, { route: 'admin', key: 'nav.admin' });
      nav.innerHTML = '';
      items.forEach(it => {
        const a = X.utils.h('a', {
          href: '#/' + it.route,
          'data-route': it.route,
          class: (it.dev ? 'dev ' : '') ,
          onclick: (e) => { e.preventDefault(); X.router.go(it.route); }
        }, [X.t(it.key)]);
        if (it.auth && !X.auth.isLogin()) { a.style.display = 'none'; }
        nav.appendChild(a);
      });
      X.router.updateNav();
    },

    /** 渲染用户胶囊 */
    renderUserChip() {
      const chip = X.utils.$('#userChip');
      if (!chip) return;
      const u = X.auth.currentUser();
      if (!u) {
        const login = X.utils.h('button', { class: 'btn primary sm', onclick: () => X.router.go('login') }, [X.t('nav.login')]);
        const reg = X.utils.h('button', { class: 'btn ghost sm', onclick: () => X.router.go('register') }, [X.t('nav.register')]);
        chip.innerHTML = ''; chip.appendChild(reg); chip.appendChild(login);
        return;
      }
      const av = u.avatarType === 'dataurl'
        ? X.utils.h('img', { class: 'avatar sm', src: u.avatar, alt: u.username })
        : X.utils.h('span', { class: 'avatar sm', style: { display: 'grid', placeItems: 'center', fontSize: '16px' } }, [u.avatar]);
      const coin = X.utils.h('span', { class: 'coin', title: 'Ttpx_A' }, ['✦ ' + X.utils.coin(u.ttpxA)]);
      const name = X.utils.h('span', { class: 'dim', style: { fontSize: '12px' } }, [u.username + (X.auth.isAdmin() ? ' ✦' : '')]);
      const logout = X.utils.h('button', { class: 'btn ghost sm', onclick: () => { X.auth.logout(); this.refresh(); X.router.go('home'); X.ui.toast(X.t('ok.loggedOut'), 'ok'); } }, [X.t('nav.logout')]);
      const chipBtn = X.utils.h('button', { class: 'btn ghost sm', style: { padding: '4px 6px' }, onclick: () => X.router.go('profile') }, [av, name]);
      chip.innerHTML = ''; chip.appendChild(coin); chip.appendChild(chipBtn); chip.appendChild(logout);
    },

    /** 刷新导航 + 用户胶囊 */
    refresh() {
      this.renderNav();
      this.renderUserChip();
    }
  };

  X.ui = ui;
})(window.Xiao = window.Xiao || {});
