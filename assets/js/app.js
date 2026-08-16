// ============================================================
// Xiao · 应用入口
// 职责：i18n 初始化 / 会话恢复 / 导航渲染 / 语言切换 / 兑换码按钮 / 路由启动
// 纯前端对接 Supabase：无种子数据，所有数据从 Supabase 异步加载。
// ============================================================
(function (X) {
  // 1. 初始化 i18n（应用偏好语言）
  X.i18n.engine.init();

  // 2. 渲染导航 + 用户胶囊
  X.ui.refresh();

  // 3. 语言切换按钮
  X.utils.$$('.lang-switch button').forEach(b => {
    b.addEventListener('click', () => {
      X.i18n.engine.setLang(b.dataset.lang);
      X.ui.refresh();
      X.router.render();
    });
  });

  // 4. 兑换码入口（顶栏 ✦）
  X.utils.$('#redeemBtn').addEventListener('click', () => X.openRedeem());

  // 5. 语言变更订阅：刷新导航/胶囊
  X.i18n.engine.onChange(() => { X.ui.refresh(); });

  // 6. 路由变化订阅：刷新胶囊（登录态变化）
  X.router.onChange(() => { X.ui.renderUserChip(); });

  // 7. 启动：先恢复 Supabase 会话，再启动路由
  (async () => {
    if (X.supabaseReady) {
      await X.auth.restoreSession();
      X.ui.refresh();
    }
    X.router.init();
  })();

  // 8. 页面卸载时清理（可选：Supabase Realtime 会自动断开）
  window.addEventListener('beforeunload', () => {
    // Realtime 订阅由各模块 onLeave / 弹窗 close 负责清理
  });

  // 性能提示：减少意外滚动
  window.addEventListener('wheel', () => {}, { passive: true });

  console.log('%c Xiao · 企海狐协会 ', 'background:#2fe3c4;color:#062018;font-weight:bold;padding:2px 8px;border-radius:4px', X.supabaseReady ? 'ready (Supabase connected)' : 'ready (Supabase NOT configured)');
})(window.Xiao = window.Xiao || {});
