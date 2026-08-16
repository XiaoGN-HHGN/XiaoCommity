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

  /**
   * 【Fix: invalid email format】
   * Supabase Auth 严格要求 RFC 5322 邮箱格式，用户名含中文/空格/特殊字符时
   * `${username}@xiao.local` 会被直接 400。
   * 这里对用户名做稳定转义：ASCII 字母数字保留，其余字符 -> `__u{codepoint}` 或 %xx 形式。
   * 关键：同一个用户名必须稳定生成同一个邮箱 local-part（保证注册/登录对得上）。
   */
  function _encodeUsername(u) {
    if (!u) return 'empty';
    const s = String(u).trim();
    let out = '';
    // 优先走 encodeURIComponent 但把 % 换成 _，@ 符号必须被转义否则邮箱格式非法
    const encoded = encodeURIComponent(s).replace(/%/g, '_').replace(/\./g, '_d').replace(/@/g, '_at_');
    // 再加前缀 u_ 防止以数字/特殊字符开头（. _ 开头也不合规）
    out = 'u_' + encoded;
    // RFC 5322 local-part 限制 64 字节，过长就裁掉加 hash 后缀保证不冲突
    if (out.length > 60) {
      let h = 0; for (let i = 0; i < out.length; i++) h = ((h << 5) - h + out.charCodeAt(i)) | 0;
      out = out.slice(0, 50) + '_h' + Math.abs(h).toString(36);
    }
    return out;
  }

  /** 注册/登录都走同一条合成邮箱逻辑 */
  function _userEmail(username) {
    return `${_encodeUsername(username)}@${X.SUPABASE_CONFIG.EMAIL_DOMAIN}`;
  }

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

      // [FIX: 消除 401 预检] 用户名唯一性预检直接跳过：
      // 1) 匿名访问 profiles 会 401，查不出来且刷屏
      // 2) Supabase Auth 的 email 唯一性本身就能兜底（重复用户名=重复 email → signUp 直接报错 "already registered"）
      //    等用户登录后再预检也不迟。

      const email = _userEmail(username);
      // 带 rawUserMeta，保证 trigger handle_new_user 就算列名对不上，前端也能拿到 username/phone 兜底写
      const { data, error } = await X.db.auth.signUp({
        email,
        password,
        options: {
          data: {
            username, phone, avatar,
            avatar_type: avatarType || 'emoji'
          }
        }
      });
      if (error) {
        // [FIX] 把 Supabase 完整错误对象打到控制台，包含 msg/code/hint，便于定位 500
        console.warn('[Xiao] signUp error →', error);
        const m = error.message || String(error);
        // 常见错误类型归一化提示，其余原样回传，让用户能贴给我
        if (m && (m.indexOf('already') >= 0 || m.indexOf('exist') >= 0)) {
          return { ok: false, msg: X.t('err.userExists') };
        }
        return { ok: false, msg: m };
      }
      const uid = data.user && data.user.id;
      if (!uid) return { ok: false, msg: X.t('err.loginFail') };
      // 写 profile：trigger 可能已经写了，前端用 upsert 避免键冲突
      try {
        await X.store.createProfile({ id: uid, username, phone, avatar, avatarType });
      } catch (e) {
        // profile 写入失败：如果是 23505（唯一键冲突）= trigger 已写过，正常；否则打日志
        const msg = (e && e.message) || '';
        if (msg.indexOf('23505') < 0 && msg.indexOf('duplicate') < 0) {
          console.warn('createProfile fail →', e);
        }
      }
      // 拉 profile 失败不阻止注册成功（至少 _profile 有基本字段，页面不会崩）
      let profile = null;
      try { profile = await X.store.getUser(uid); } catch (_) {}
      this._profile = profile || {
        id: uid, username, phone, avatar, avatar_type: avatarType || 'emoji',
        ttpx_a: 10, role: 'user', realname: false, banned: null, muted: null,
        bio: '', created_at: new Date().toISOString()
      };
      return { ok: true, user: this._profile };
    },

    /** 登录：合成邮箱 + 密码；remember 缓存凭据用于下次预填 */
    async login(username, password, remember) {
      if (!X.supabaseReady) return { ok: false, msg: 'Supabase 未配置' };
      const email = _userEmail(username);
      const { data, error } = await X.db.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        // [FIX] 暴露 Supabase 真实错误信息，便于定位 400 根因（如 Email not confirmed）
        console.warn('[Xiao] signIn error:', error && error.status, error && error.message);
        const m = (error && error.message) || X.t('err.loginFail');
        // "Email not confirmed" 这类直接回传给用户，提示去关 Confirm email
        return { ok: false, msg: m };
      }
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
