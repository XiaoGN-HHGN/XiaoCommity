// ============================================================
// Xiao · 应用入口
// 职责：i18n 初始化 / 数据种子 / 导航渲染 / 语言切换 / 兑换码按钮 / 路由启动
// ============================================================
(function (X) {
  // 1. 初始化 i18n（应用偏好语言）
  X.i18n.engine.init();

  // 2. 种子数据（首次访问）
  X.store.seedIfEmpty();

  // 3. 渲染导航 + 用户胶囊
  X.ui.refresh();

  // 4. 语言切换按钮
  X.utils.$$('.lang-switch button').forEach(b => {
    b.addEventListener('click', () => {
      X.i18n.engine.setLang(b.dataset.lang);
      // 重渲染当前路由 + 导航 + 用户胶囊
      X.ui.refresh();
      X.router.render();
    });
  });

  // 5. 兑换码入口（顶栏 ✦）
  X.utils.$('#redeemBtn').addEventListener('click', () => X.openRedeem());

  // 6. 语言变更订阅：刷新导航/胶囊
  X.i18n.engine.onChange(() => { X.ui.refresh(); });

  // 7. 路由变化订阅：刷新胶囊（登录态变化）
  X.router.onChange(() => { X.ui.renderUserChip(); });

  // 8. 启动路由
  X.router.init();

  // 9. 暴露便捷全局（供 onclick 内联使用）
  X.utils.$('#userChip'); // 触发一次引用，确保已渲染

  // 性能提示：减少意外滚动
  window.addEventListener('wheel', () => {}, { passive: true });

  console.log('%c Xiao · 企海狐协会 ', 'background:#2fe3c4;color:#062018;font-weight:bold;padding:2px 8px;border-radius:4px', 'ready');
})(window.Xiao = window.Xiao || {});
