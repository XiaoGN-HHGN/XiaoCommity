// ============================================================
// Xiao · 核心层 · 认证 & 权限
// 注册 / 登录 / 记住密码 / 会话 / 兑换码临时管理员
// 兑换码：867899gnhh → 一键临时开启管理员模式
// ============================================================
(function (X) {
  const REDEEM_CODE = '867899gnhh';
  const SESSION_TEMP_ADMIN = 'xiao.tempAdmin';

  const auth = {
    REDEEM_CODE,

    /** 当前登录用户 */
    currentUser() {
      const s = X.store.getSession();
      if (!s) return null;
      return X.store.getUser(s.userId);
    },

    isLogin() { return !!this.currentUser(); },

    /** 注册 */
    register({ username, password, confirm, phone, avatar, avatarType }) {
      if (!username || !password || !phone) return { ok: false, msg: X.t('err.required') };
      if (!X.utils.isPassword(password)) return { ok: false, msg: X.t('err.required') };
      if (password !== confirm) return { ok: false, msg: X.t('err.passwordMismatch') };
      if (!X.utils.isPhone(phone)) return { ok: false, msg: X.t('err.phoneFormat') };
      if (X.store.getUserByName(username)) return { ok: false, msg: X.t('err.userExists') };
      const user = X.store.createUser({ username, password, phone, avatar, avatarType });
      // 自动登录
      X.store.setSession(user.id, false);
      return { ok: true, user };
    },

    /** 登录 */
    login(username, password, remember) {
      const u = X.store.getUserByName(username);
      if (!u || u.password !== password) return { ok: false, msg: X.t('err.loginFail') };
      // 封禁检查
      const b = this.isBanned(u);
      if (b) return { ok: false, msg: b };
      X.store.setSession(u.id, remember);
      // 记住密码：仅本地缓存账号密码（明文，演示用，生产应哈希）
      if (remember) localStorage.setItem('xiao.remember', JSON.stringify({ username, password }));
      else localStorage.removeItem('xiao.remember');
      return { ok: true, user: u };
    },

    /** 读取记住的凭据 */
    getRemembered() {
      try { return JSON.parse(localStorage.getItem('xiao.remember')) || null; }
      catch { return null; }
    },

    logout() {
      X.store.clearSession();
      localStorage.removeItem(SESSION_TEMP_ADMIN);
    },

    /** 封禁状态检查，返回未解除则返回提示串 */
    isBanned(user) {
      if (!user || !user.banned) return null;
      if (user.banned.perm) return X.t('err.noPerm') + ' (BAN)';
      if (user.banned.until && user.banned.until > Date.now()) return X.t('err.noPerm') + ' (BAN)';
      return null; // 已过期
    },

    /** 禁言检查 */
    isMuted(user) {
      if (!user || !user.muted) return null;
      if (user.muted.perm) return true;
      if (user.muted.until && user.muted.until > Date.now()) return true;
      return false;
    },

    /** 是否管理员（含兑换码临时模式） */
    isAdmin() {
      const u = this.currentUser();
      if (u && (u.role === 'admin' || u.role === 'super')) return true;
      return localStorage.getItem(SESSION_TEMP_ADMIN) === '1';
    },
    /** 超级管理员 */
    isSuper() {
      const u = this.currentUser();
      return !!(u && u.role === 'super');
    },

    /** 兑换码：临时开启管理员模式（仅当前会话） */
    redeem(code) {
      if (code !== REDEEM_CODE) return { ok: false, msg: X.t('admin.redeemFail') };
      localStorage.setItem(SESSION_TEMP_ADMIN, '1');
      return { ok: true, msg: X.t('admin.redeemOk') };
    },
    clearTempAdmin() { localStorage.removeItem(SESSION_TEMP_ADMIN); },

    /** 校验当前登录，未登录抛出（返回 false 由调用方处理） */
    requireLogin() {
      if (!this.isLogin()) { X.ui.toast(X.t('err.notLogin'), 'err'); return false; }
      return true;
    },
    requireAdmin() {
      if (!this.requireLogin()) return false;
      if (!this.isAdmin()) { X.ui.toast(X.t('err.noPerm'), 'err'); return false; }
      return true;
    },

    /** 授予管理员身份（仅 super 可用） */
    grantAdmin(targetUserId) {
      if (!this.isSuper()) return { ok: false, msg: X.t('err.noPerm') };
      const u = X.store.getUser(targetUserId);
      if (!u) return { ok: false, msg: 'user not found' };
      u.role = 'admin'; X.store.saveUser(u);
      return { ok: true, user: u };
    }
  };

  X.auth = auth;
})(window.Xiao = window.Xiao || {});
