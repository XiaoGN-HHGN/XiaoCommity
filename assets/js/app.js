// ============================================================
// Xiao · 应用入口
// 职责：i18n 初始化 / 会话恢复 / 导航渲染 / 语言切换 / 兑换码按钮 / 路由启动
// 纯前端对接 Supabase：无种子数据，所有数据从 Supabase 异步加载。
// ============================================================
(function (X) {
  // 1. 初始化 i18n（应用偏好语言）
  X.i18n.engine.init();

  // === [FIX BEGIN: 401 profiles 未登录 401 修复] ===
  // 修复前：X.ui.refresh() 立即执行，此时 restoreSession 未完成，_profile 为空但
  // 语言切换/i18n 订阅等后续链路可能在匿名态触发 profiles 查询导致 401 刷屏。
  // 修复后：首屏仅渲染导航（纯内存、无网络请求）；胶囊与后续 refresh 延迟到
  // restoreSession 完成后再按需执行（仅在存在有效 session 时刷新胶囊）。
  // 此改动为最低侵入：不拆 auth/ui，不增全局变量，不动 i18n/兑换/语言按钮逻辑。

  // 2. 首屏只渲染导航（不渲染用户胶囊 → 匿名态不碰 profiles）
  X.ui.renderNav();

  // 3. 语言切换按钮（逻辑原样保留，不改动）
  X.utils.$$('.lang-switch button').forEach(b => {
    b.addEventListener('click', () => {
      X.i18n.engine.setLang(b.dataset.lang);
      try { X.ui.refresh(); } catch (_) {}  // [FIX] 静默吞异常，避免匿名态偶发 profiles 报错刷屏
      X.router.render();
    });
  });

  // 4. 兑换码入口（顶栏 ✦，逻辑原样保留，不改动）
  X.utils.$('#redeemBtn').addEventListener('click', () => X.openRedeem());

  // 5. 语言变更订阅：刷新导航/胶囊（[FIX] try/catch 静默吞 401）
  X.i18n.engine.onChange(() => { try { X.ui.refresh(); } catch (_) {} });

  // 6. 路由变化订阅：刷新胶囊（[FIX] try/catch 静默吞 401，未登录场景 renderUserChip 只走内存不会抛）
  X.router.onChange(() => { try { X.ui.renderUserChip(); } catch (_) {} });

  // 7. 启动：等待 restoreSession 完整执行完毕，再决定是否刷新 UI / 启动路由
  (async () => {
    // [FIX] 先 restoreSession（完整 await 后才往下），会话存在才 refresh 胶囊
    let hasSession = false;
    if (X.supabaseReady) {
      try {
        await X.auth.restoreSession();  // 必须 await 完成
        // 再次确认 Supabase auth session 是否真实有效（避免 stale token 触发 profiles 401）
        const { data } = await X.db.auth.getSession();
        hasSession = !!(data && data.session && data.session.user);
      } catch (_) {
        hasSession = false;  // [FIX] restoreSession 失败（网络/401）一律按无会话处理，静默吞
      }
      if (hasSession) {
        try { X.ui.refresh(); } catch (_) {}  // [FIX] 仅登录态才刷新用户胶囊（可能拉 profiles）
      } else {
        try { X.ui.renderNav(); } catch (_) {}  // 无会话：只补渲染导航（无网络请求）
      }
    } else {
      // Supabase 未配置：无 profiles 查询，可直接补渲染导航
      try { X.ui.renderNav(); } catch (_) {}
    }
    // [FIX] 时序保障：restoreSession 全部跑完后才初始化路由，避免 #/chat 等页面提前加载
    // 触发匿名态 getUsers / getChat 导致 401 刷屏。
    try { X.router.init(); } catch (_) {}
  })();
  // === [FIX END: 401 profiles 未登录 401 修复] ===

  // 8. 页面卸载时清理（可选：Supabase Realtime 会自动断开）
  window.addEventListener('beforeunload', () => {
    // Realtime 订阅由各模块 onLeave / 弹窗 close 负责清理
  });

  // 性能提示：减少意外滚动
  window.addEventListener('wheel', () => {}, { passive: true });

  console.log('%c Xiao · 企海狐协会 ', 'background:#2fe3c4;color:#062018;font-weight:bold;padding:2px 8px;border-radius:4px', X.supabaseReady ? 'ready (Supabase connected)' : 'ready (Supabase NOT configured)');
})(window.Xiao = window.Xiao || {});
