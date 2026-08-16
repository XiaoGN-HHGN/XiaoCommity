// ============================================================
// Xiao · 模块 · 登录 / 注册
// 必填：账号名 / 密码 / 二次密码 / 手机号；头像本地上传或默认
// 记住密码勾选；注册即发放 10 枚 Ttpx_A
// ============================================================
(function (X) {
  X.modules = X.modules || {};

  const DEFAULT_AVATARS = ['🐧', '🐬', '🦊', '❄️', '🌊', '🔬', '🧪', '⚛️', '🛰️', '📊', '🧬', '🌌'];

  const authView = {
    mode: 'login',
    pickedAvatar: '🦊',
    avatarType: 'emoji',
    avatarDataUrl: null,

    render() {
      const t = X.t;
      this.pickedAvatar = DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
      return `
        <section class="app-view auth-wrap">
          <div class="auth-tabs">
            <button class="${this.mode === 'login' ? 'active' : ''}" data-mode="login">${t('auth.login')}</button>
            <button class="${this.mode === 'register' ? 'active' : ''}" data-mode="register">${t('auth.register')}</button>
          </div>
          <div class="card elev" id="authCard"></div>
        </section>`;
    },

    afterRender() {
      const card = X.utils.$('#authCard');
      X.utils.$$('.auth-tabs button').forEach(b => {
        b.addEventListener('click', () => { this.mode = b.dataset.mode; this.renderForm(); });
      });
      this.renderForm();
    },

    renderForm() {
      const card = X.utils.$('#authCard');
      const t = X.t;
      X.utils.$$('.auth-tabs button').forEach(b => b.classList.toggle('active', b.dataset.mode === this.mode));
      const remembered = X.auth.getRemembered();

      if (this.mode === 'login') {
        card.innerHTML = `
          <h2 style="margin:0 0 4px">${t('auth.welcome')}</h2>
          <p class="dim" style="font-size:13px;margin:0 0 14px">${t('common.brand')}</p>
          <div class="field"><label class="label">${t('auth.username')}</label><input class="input" id="lg_un" value="${remembered ? X.utils.escape(remembered.username) : ''}" /></div>
          <div class="field"><label class="label">${t('auth.password')}</label><input class="input" id="lg_pw" type="password" value="${remembered ? X.utils.escape(remembered.password) : ''}" /></div>
          <label class="checkbox"><input type="checkbox" id="lg_remember" ${remembered ? 'checked' : ''} /> ${t('auth.remember')}</label>
          <button class="btn primary block" style="margin-top:14px" id="lg_btn">${t('auth.login')}</button>
          <p class="center dim" style="margin-top:10px"><a onclick="Xiao.modules.authView.switchMode('register')">${t('auth.toRegister')}</a></p>`;
        X.utils.$('#lg_btn').addEventListener('click', () => this.doLogin());
        X.utils.$('#lg_pw').addEventListener('keydown', e => { if (e.key === 'Enter') this.doLogin(); });
      } else {
        const opts = DEFAULT_AVATARS.map(a =>
          `<button class="opt ${a === this.pickedAvatar ? 'active' : ''}" data-av="${a}">${a}</button>`
        ).join('');
        card.innerHTML = `
          <h2 style="margin:0 0 4px">${t('auth.welcomeNew')}</h2>
          <p class="dim" style="font-size:13px;margin:0 0 14px">${t('auth.hint.coin')}</p>
          <div class="field"><label class="label">${t('auth.username')}</label><input class="input" id="rg_un" /></div>
          <div class="field"><label class="label">${t('auth.password')}</label><input class="input" id="rg_pw" type="password" /></div>
          <div class="field"><label class="label">${t('auth.passwordConfirm')}</label><input class="input" id="rg_pw2" type="password" /></div>
          <div class="field"><label class="label">${t('auth.phone')}</label><input class="input" id="rg_phone" /></div>
          <div class="field">
            <label class="label">${t('auth.avatar')}</label>
            <div class="avatar-picker">
              <div class="avatar-preview" id="rg_avprev">${this.pickedAvatar}</div>
              <div class="col grow">
                <div class="avatar-options" id="rg_avopts">${opts}</div>
                <label class="btn ghost sm" style="margin-top:6px;cursor:pointer">
                  📷 ${t('auth.avatarUpload')}
                  <input type="file" accept="image/*" id="rg_file" style="display:none" />
                </label>
              </div>
            </div>
          </div>
          <button class="btn primary block" style="margin-top:6px" id="rg_btn">${t('auth.register')}</button>
          <p class="center dim" style="margin-top:10px"><a onclick="Xiao.modules.authView.switchMode('login')">${t('auth.toLogin')}</a></p>`;
        X.utils.$$('#rg_avopts .opt').forEach(b => b.addEventListener('click', () => this.pickAvatar(b.dataset.av)));
        X.utils.$('#rg_file').addEventListener('change', e => this.uploadAvatar(e));
        X.utils.$('#rg_btn').addEventListener('click', () => this.doRegister());
      }
    },

    switchMode(m) { this.mode = m; this.avatarType = 'emoji'; this.avatarDataUrl = null; this.renderForm(); },

    pickAvatar(a) {
      this.pickedAvatar = a; this.avatarType = 'emoji'; this.avatarDataUrl = null;
      X.utils.$('#rg_avprev').textContent = a;
      X.utils.$$('#rg_avopts .opt').forEach(b => b.classList.toggle('active', b.dataset.av === a));
    },

    async uploadAvatar(e) {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 1.5 * 1024 * 1024) { X.ui.toast(X.t('err.required') + ' ≤1.5MB', 'err'); return; }
      const url = await X.utils.readDataURL(file);
      this.avatarDataUrl = url; this.avatarType = 'dataurl';
      X.utils.$('#rg_avprev').innerHTML = `<img src="${url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`;
      X.utils.$$('#rg_avopts .opt').forEach(b => b.classList.remove('active'));
    },

    doLogin() {
      const username = X.utils.$('#lg_un').value.trim();
      const password = X.utils.$('#lg_pw').value;
      const remember = X.utils.$('#lg_remember').checked;
      const r = X.auth.login(username, password, remember);
      if (!r.ok) { X.ui.toast(r.msg, 'err'); return; }
      X.ui.toast(X.t('ok.loggedIn'), 'ok');
      X.ui.refresh();
      X.router.go('home');
    },

    doRegister() {
      const username = X.utils.$('#rg_un').value.trim();
      const password = X.utils.$('#rg_pw').value;
      const confirm = X.utils.$('#rg_pw2').value;
      const phone = X.utils.$('#rg_phone').value.trim();
      const avatar = this.avatarType === 'dataurl' ? this.avatarDataUrl : this.pickedAvatar;
      const r = X.auth.register({ username, password, confirm, phone, avatar, avatarType: this.avatarType });
      if (!r.ok) { X.ui.toast(r.msg, 'err'); return; }
      X.ui.toast(X.t('ok.registered'), 'ok');
      X.ui.refresh();
      X.router.go('home');
    }
  };

  X.modules.authView = authView;
  X.router.register('login', { render: () => authView.render(), afterRender: () => authView.afterRender() });
  X.router.register('register', {
    render: () => { authView.mode = 'register'; return authView.render(); },
    afterRender: () => authView.afterRender()
  });
})(window.Xiao = window.Xiao || {});
