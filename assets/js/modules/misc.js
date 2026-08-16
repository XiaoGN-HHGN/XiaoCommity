// ============================================================
// Xiao · 模块 · 杂项
// 联系我们（跳转 Bilibili）/ 科研长视频占位（功能开发中）
// 兑换码弹窗入口（867899gnhh → 临时管理员）
// ============================================================
(function (X) {
  X.modules = X.modules || {};

  const BILIBILI = 'https://space.bilibili.com/3493292203313399?spm_id_from=333.337.search-card.all.click';

  const misc = {
    /** 联系我们 */
    renderContact() {
      const t = X.t;
      return `
        <section class="app-view">
          <div class="card elev" style="text-align:center;padding:40px">
            <div style="font-size:46px;margin-bottom:10px">📡</div>
            <h2>${t('contact.title')}</h2>
            <p class="muted">Xiao · ${t('common.brand')}</p>
            <div class="divider"></div>
            <p class="dim">${t('contact.bilibili')}</p>
            <a class="btn primary lg" href="${BILIBILI}" target="_blank" rel="noopener">▶ ${t('contact.visit')}</a>
          </div>
        </section>`;
    },

    /** 科研长视频占位 */
    renderVideo() {
      const t = X.t;
      return `
        <section class="app-view">
          <div class="dev-placeholder" style="padding:80px 20px">
            <div class="ico">🎬</div>
            <h2>${t('video.title')}</h2>
            <p class="muted" style="max-width:480px;margin:0 auto">${t('video.devDesc')}</p>
            <span class="tag warn">${t('video.dev')}</span>
          </div>
        </section>`;
    }
  };

  X.modules.misc = misc;

  X.router.register('contact', { render: () => misc.renderContact() });
  X.router.register('video', { render: () => misc.renderVideo() });

  /** 兑换码弹窗（入口由顶栏 ✦ 按钮触发） */
  X.openRedeem = function () {
    const t = X.t;
    const inst = X.ui.modal({ title: t('redeem.title') });
    inst.bodyEl.innerHTML = `
      <p class="dim" style="margin:0 0 12px">${t('admin.redeemPlaceholder')}</p>
      <input class="input" id="rd_input" placeholder="${t('redeem.placeholder')}" />
      <div class="error-text" id="rd_err" style="display:none;margin-top:8px"></div>
      <div class="row" style="margin-top:16px;justify-content:flex-end;gap:8px" id="rd_actions"></div>`;
    const actBox = X.utils.$('#rd_actions', inst.modal);
    actBox.appendChild(X.utils.h('button', { class: 'btn ghost', onclick: () => inst.close() }, [t('common.cancel')]));
    const submit = X.utils.h('button', { class: 'btn primary' }, [t('redeem.submit')]);
    actBox.appendChild(submit);
    const input = X.utils.$('#rd_input', inst.modal);
    input.focus();
    const doRedeem = () => {
      const code = input.value.trim();
      const r = X.auth.redeem(code);
      if (r.ok) {
        X.ui.toast(r.msg, 'ok'); inst.close();
        X.ui.refresh();
        X.router.go('admin');
      } else {
        const err = X.utils.$('#rd_err', inst.modal);
        err.textContent = r.msg; err.style.display = 'block';
        input.style.borderColor = 'var(--danger)';
      }
    };
    submit.addEventListener('click', doRedeem);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doRedeem(); });
  };
})(window.Xiao = window.Xiao || {});
