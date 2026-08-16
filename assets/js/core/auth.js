// ============================================================
// Xiao · 认证 & 权限（Supabase Auth）
// 账号名登录：将 username 合成邮箱 `${username}@${EMAIL_DOMAIN}`，
// 由 Supabase Auth 管理密码（安全、会话持久化=记住登录态）。
// profile（角色/代币/封禁/实名）存于 profiles 表，RLS 保护。
// 兑换码 867899gnhh → 临时管理员（客户端标记，仅当前会话）。
// 为减少渲染层异步改造，currentUser() 返回同步缓存 _profile，
// 由 restoreSession/register/login 时刷新。
// ============================================================
(function (X) {
  const REDEEM_CODE = '867899gnhh';
  const SESSION_TEMP_ADMIN = 'xiao.tempAdmin';
  const REMEMBER_KEY = 'xiao.remember';

  const auth = {
    REDEEM_CODE,
    _profile: null,   // 同步缓存当前用户 profile

    /** Supabase Auth 客户端 */
    sb() { return X.db; },

    /** 当前登录用户（同步返回缓存 profile） */
    currentUser() { return this._profile; },

    isLogin() { return !!this._profile; },

    /** 应用启动时恢复会话：读 Supabase session → 拉 profile 缓存 */
    async restoreSession() {
      if (!X.supabaseReady) { this._profile = null; return null; }
      try {
        const { data } = await X.db.auth.getSession();
        const uid = data.session && data.session.user && data.session.user.id;
        if (!uid) { this._profile = null; return null; }
        this._profile = await X.store.getUser(uid);
        return this._profile;
      } catch (e) { console.warn('restoreSession fail', e); this._profile = null; return null; }
    },

    /** 同步刷新缓存 profile（代币/角色变更后调用） */
    async refresh() {
      if (!this._profile) return null;
      this._profile = await X.store.getUser(this._profile.id);
      return this._profile;
    },

    /** 注册：先建 Auth 账号，再写 profile（初始 Ttpx_A=10） */
    async register({ username, password, confirm, phone, avatar, avatarType }) {
      if (!X.supabaseReady) return { ok: false, msg: 'Supabase 未配置' };
      if (!username || !password || !phone) return { ok: false, msg: X.t('err.required') };
      if (!X.utils.isPassword(password)) return { ok: false, msg: X.t('err.required') };
      if (password !== confirm) return { ok: false, msg: X.t('err.passwordMismatch') };
      if (!X.utils.isPhone(phone)) return { ok: false, msg: X.t('err.phoneFormat') };
      // 用户名唯一性预检
      const exist = await X.store.getUserByName(username);
      if (exist) return { ok: false, msg: X.t('err.userExists') };

      const email = `${username}@${X.SUPABASE_CONFIG.EMAIL_DOMAIN}`;
      const { data, error } = await X.db.auth.signUp({ email, password });
      if (error) {
        // 用户名已占用（合成邮箱重复）等
        return { ok: false, msg: X.t('err.userExists') };
      }
      const uid = data.user && data.user.id;
      if (!uid) return { ok: false, msg: X.t('err.loginFail') };
      // 写 profile
      try {
        await X.store.createProfile({ id: uid, username, phone, avatar, avatarType });
      } catch (e) {
        // profile 写入失败（极少见，RLS），回退提示
        console.warn('createProfile fail', e);
      }
      this._profile = await X.store.getUser(uid);
      return { ok: true, user: this._profile };
    },

    /** 登录：合成邮箱 + 密码；remember 缓存凭据用于下次预填 */
    async login(username, password, remember) {
      if (!X.supabaseReady) return { ok: false, msg: 'Supabase 未配置' };
      const email = `${username}@${X.SUPABASE_CONFIG.EMAIL_DOMAIN}`;
      const { data, error } = await X.db.auth.signInWithPassword({ email, password });
      if (error || !data.user) return { ok: false, msg: X.t('err.loginFail') };
      const uid = data.user.id;
      this._profile = await X.store.getUser(uid);
      if (!this._profile) return { ok: false, msg: X.t('err.loginFail') };
      // 封禁检查
      const b = this.isBanned(this._profile);
      if (b) { await X.db.auth.signOut(); this._profile = null; return { ok: false, msg: b }; }
      if (remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username, password }));
      else localStorage.removeItem(REMEMBER_KEY);
      return { ok: true, user: this._profile };
    },

    getRemembered() {
      try { return JSON.parse(localStorage.getItem(REMEMBER_KEY)) || null; } catch { return null; }
    },

    async logout() {
      if (X.supabaseReady) { try { await X.db.auth.signOut(); } catch (e) {} }
      this._profile = null;
      localStorage.removeItem(SESSION_TEMP_ADMIN);
    },

    /** 封禁检查，已封禁返回提示串 */
    isBanned(user) {
      if (!user || !user.banned) return null;
      const b = typeof user.banned === 'string' ? JSON.parse(user.banned) : user.banned;
      if (b && b.perm) return X.t('err.noPerm') + ' (BAN)';
      if (b && b.until && b.until > Date.now()) return X.t('err.noPerm') + ' (BAN)';
      return null;
    },
    /** 禁言检查 */
    isMuted(user) {
      if (!user || !user.muted) return false;
      const m = typeof user.muted === 'string' ? JSON.parse(user.muted) : user.muted;
      if (m && m.perm) return true;
      if (m && m.until && m.until > Date.now()) return true;
      return false;
    },

    /** 管理员：profile 角色或临时兑换码模式 */
    isAdmin() {
      const u = this._profile;
      if (u && (u.role === 'admin' || u.role === 'super')) return true;
      return localStorage.getItem(SESSION_TEMP_ADMIN) === '1';
    },
    isSuper() {
      const u = this._profile;
      return !!(u && u.role === 'super');
    },

    redeem(code) {
      if (code !== REDEEM_CODE) return { ok: false, msg: X.t('admin.redeemFail') };
      localStorage.setItem(SESSION_TEMP_ADMIN, '1');
      return { ok: true, msg: X.t('admin.redeemOk') };
    },
    clearTempAdmin() { localStorage.removeItem(SESSION_TEMP_ADMIN); },

    requireLogin() {
      // 临时管理员（兑换码模式）可绕过登录态访问受保护页面
      if (localStorage.getItem(SESSION_TEMP_ADMIN) === '1') return true;
      if (!this.isLogin()) { X.ui.toast(X.t('err.notLogin'), 'err'); return false; }
      return true;
    },
    requireAdmin() {
      // 临时管理员（兑换码模式）允许无登录访问 admin 页面
      if (localStorage.getItem(SESSION_TEMP_ADMIN) === '1') return true;
      if (!this.requireLogin()) return false;
      if (!this.isAdmin()) { X.ui.toast(X.t('err.noPerm'), 'err'); return false; }
      return true;
    },

    /** 授予管理员（仅 super） */
    async grantAdmin(targetUserId) {
      if (!this.isSuper()) return { ok: false, msg: X.t('err.noPerm') };
      const u = await X.store.getUser(targetUserId);
      if (!u) return { ok: false, msg: 'user not found' };
      await X.store.updateProfile(targetUserId, { role: 'admin' });
      return { ok: true };
    }
  };

  X.auth = auth;
})(window.Xiao = window.Xiao || {});
