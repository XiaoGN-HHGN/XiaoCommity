// ============================================================
// Xiao · 模块 · 管理员后台（Supabase）
// 用户管理 / 代币查询 / 作品审核（可下载核验）/ 举报审核 / 操作记录
// 所有操作必须手动填写原因，留存操作记录（admin_logs 表）
// 超级管理员可搜索现有用户并授予 admin 角色（纯前端无法直接创建他人 Auth 账号）
// ============================================================
(function (X) {
  X.modules = X.modules || {};

  const admin = {
    tab: 'users',

    render() {
      if (!X.auth.requireAdmin()) return;
      const t = X.t;
      const isTempAdmin = !X.auth.isSuper() && !((X.auth.currentUser() || {}).role === 'admin');
      return `
        <section class="app-view">
          <div class="card elev" style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
            <div style="font-size:26px">🛡️</div>
            <div style="flex:1">
              <h2 style="margin:0">${t('admin.title')}</h2>
              <p class="dim" style="margin:0;font-size:12px">${isTempAdmin ? '临时管理员模式（兑换码激活）' : (X.auth.isSuper() ? t('admin.super') : 'ADMIN')}</p>
            </div>
            ${isTempAdmin ? `<button class="btn ghost sm" onclick="Xiao.auth.clearTempAdmin();Xiao.ui.refresh();Xiao.router.go('home');">退出临时管理员</button>` : ''}
          </div>
          <div class="admin-grid">
            <div class="admin-side">
              <div class="card">
                <a class="${this.tab === 'users' ? 'active' : ''}" data-tab="users">👥 ${t('admin.users')}</a>
                <a class="${this.tab === 'coins' ? 'active' : ''}" data-tab="coins">✦ ${t('admin.coins')}</a>
                <a class="${this.tab === 'works' ? 'active' : ''}" data-tab="works">📦 ${t('admin.worksReview')}</a>
                <a class="${this.tab === 'reports' ? 'active' : ''}" data-tab="reports">⚠️ ${t('admin.reports')}</a>
                <a class="${this.tab === 'logs' ? 'active' : ''}" data-tab="logs">📜 ${t('admin.logs')}</a>
              </div>
            </div>
            <div class="admin-panel card" id="ad_panel"><div class="dim center" style="padding:20px">加载中...</div></div>
          </div>
        </section>`;
    },

    async afterRender() {
      X.utils.$$('.admin-side a').forEach(a => a.addEventListener('click', () => {
        this.tab = a.dataset.tab; this.renderTab();
        X.utils.$$('.admin-side a').forEach(x => x.classList.toggle('active', x.dataset.tab === this.tab));
      }));
      await this.renderTab();
    },

    async renderTab() {
      const panel = X.utils.$('#ad_panel');
      if (!panel) return;
      if (!X.supabaseReady) { panel.innerHTML = '<div class="dim center">⚠ Supabase 未配置</div>'; return; }
      try {
        if (this.tab === 'users') await this.renderUsers(panel);
        else if (this.tab === 'coins') await this.renderCoins(panel);
        else if (this.tab === 'works') await this.renderWorks(panel);
        else if (this.tab === 'reports') await this.renderReports(panel);
        else if (this.tab === 'logs') await this.renderLogs(panel);
      } catch (e) {
        panel.innerHTML = '<div class="dim center">加载失败</div>';
      }
    },

    async renderUsers(panel) {
      const t = X.t;
      const users = await X.store.getUsers();
      const cur = X.auth.currentUser();
      let html = `<div class="row" style="align-items:center;margin-bottom:10px"><div class="card-title" style="margin:0">${t('admin.users')} (${users.length})</div><span class="spacer"></span>`;
      if (X.auth.isSuper()) html += `<button class="btn primary sm" onclick="Xiao.modules.admin.grantAdminUI()">＋ ${t('admin.grant')}</button>`;
      html += `</div>`;
      html += `<div style="overflow:auto"><table class="table"><thead><tr><th>${t('auth.username')}</th><th>${t('admin.coins')}</th><th>角色</th><th>状态</th><th>操作</th></tr></thead><tbody>`;
      users.forEach(u => {
        const banInfo = parseJson(u.banned);
        const muteInfo = parseJson(u.muted);
        const banned = banInfo && (banInfo.perm || (banInfo.until && banInfo.until > Date.now()));
        const muted = muteInfo && (muteInfo.perm || (muteInfo.until && muteInfo.until > Date.now()));
        html += `<tr>
          <td>${X.utils.escape(u.username)} ${u.id === cur.id ? '(me)' : ''}</td>
          <td class="mono gold">✦ ${X.utils.coin(u.ttpx_a)}</td>
          <td>${u.role === 'super' ? '<span class="tag accent">SUPER</span>' : u.role === 'admin' ? '<span class="tag accent">ADMIN</span>' : '<span class="tag">user</span>'}</td>
          <td>${banned ? '<span class="tag danger">BAN</span>' : ''} ${muted ? '<span class="tag warn">MUTE</span>' : ''} ${u.realname ? '<span class="tag accent">实名</span>' : ''}</td>
          <td>
            <button class="btn ghost sm" onclick="Xiao.modules.admin.act('award','${u.id}')">${t('admin.award')}</button>
            <button class="btn ghost sm" onclick="Xiao.modules.admin.act('deduct','${u.id}')">${t('admin.deduct')}</button>
            <button class="btn ghost sm" onclick="Xiao.modules.admin.act('ban','${u.id}')">${t('admin.ban')}</button>
            <button class="btn ghost sm" onclick="Xiao.modules.admin.act('mute','${u.id}')">${t('admin.mute')}</button>
            ${X.auth.isSuper() && u.role === 'user' ? `<button class="btn primary sm" onclick="Xiao.modules.admin.act('grant','${u.id}')">${t('admin.grant')}</button>` : ''}
          </td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
      panel.innerHTML = html;
    },

    async renderCoins(panel) {
      const t = X.t;
      const users = (await X.store.getUsers()).slice().sort((a, b) => (b.ttpx_a || 0) - (a.ttpx_a || 0));
      const total = users.reduce((s, u) => s + (u.ttpx_a || 0), 0);
      panel.innerHTML = `<div class="card-title">${t('admin.coins')}</div>
        <div class="row" style="margin-bottom:10px"><span class="tag gold">总流通 ✦ ${X.utils.coin(total)}</span><span class="tag">${users.length} users</span></div>
        <div style="overflow:auto"><table class="table"><thead><tr><th>#</th><th>${t('auth.username')}</th><th>余额</th></tr></thead><tbody>
        ${users.map((u, i) => `<tr><td>${i + 1}</td><td>${X.utils.escape(u.username)}</td><td class="mono gold">✦ ${X.utils.coin(u.ttpx_a)}</td></tr>`).join('')}
        </tbody></table></div>`;
    },

    async renderWorks(panel) {
      const t = X.t;
      const works = await X.store.getWorks();
      panel.innerHTML = `<div class="card-title">${t('admin.worksReview')} (${works.length})</div>`;
      if (!works.length) { panel.innerHTML += `<div class="empty"><div class="ico">📦</div><p>${t('common.empty')}</p></div>`; return; }
      panel.appendChild(X.utils.h('div', { class: 'col', style: { gap: '8px' } }));
      const authorCache = {};
      for (const w of works) {
        if (!authorCache[w.author_id]) authorCache[w.author_id] = await X.store.getUser(w.author_id);
        const author = authorCache[w.author_id] || { username: '?' };
        const row = X.utils.h('div', { class: 'list-item', style: { flexWrap: 'wrap' } });
        row.innerHTML = `<div class="meta"><div class="t">${X.utils.escape(w.name)}</div><div class="s">${X.utils.escape(author.username || '?')} · ${w.category} · ${w.status}</div></div><span class="spacer"></span>`;
        const grp = X.utils.h('div', { class: 'row' });
        grp.appendChild(X.utils.h('button', { class: 'btn ghost sm', onclick: async () => {
          try {
            const content = await X.dbq.downloadText(X.SUPABASE_CONFIG.STORAGE_BUCKET_WORKS, w.file_path);
            X.utils.downloadText(w.file_name, content, 'text/plain');
          } catch (e) { X.ui.toast('下载失败', 'err'); }
        } }, ['⬇ 下载核验']));
        if (w.status === 'pending') {
          grp.appendChild(X.utils.h('button', { class: 'btn primary sm', onclick: () => this.reviewWork(w.id, true) }, ['通过']));
          grp.appendChild(X.utils.h('button', { class: 'btn danger sm', onclick: () => this.reviewWork(w.id, false) }, ['拒绝']));
        }
        row.appendChild(grp);
        panel.appendChild(row);
      }
    },

    async renderReports(panel) {
      const t = X.t;
      const reports = await X.store.getReports();
      panel.innerHTML = `<div class="card-title">${t('admin.reports')} (${reports.length})</div>`;
      if (!reports.length) { panel.innerHTML += `<div class="empty"><div class="ico">⚠️</div><p>${t('common.empty')}</p></div>`; return; }
      for (const r of reports) {
        const reporter = await X.store.getUser(r.reporter_id) || { username: '?' };
        let target = r.target_id;
        if (r.target_type === 'user') { const tu = await X.store.getUser(r.target_id); if (tu) target = tu.username; }
        else if (r.target_type === 'work') { const tw = await X.store.getWork(r.target_id); if (tw) target = tw.name; }
        const row = X.utils.h('div', { class: 'list-item', style: { flexWrap: 'wrap' } });
        row.innerHTML = `<div class="meta"><div class="t">[${r.target_type}] ${X.utils.escape(target || '')}</div><div class="s">by ${X.utils.escape(reporter.username || '?')} · ${X.utils.escape(r.reason || '')}</div></div><span class="spacer"></span><span class="tag ${r.status === 'pending' ? 'warn' : 'accent'}">${r.status}</span>`;
        if (r.status === 'pending') {
          row.appendChild(X.utils.h('button', { class: 'btn primary sm', onclick: () => this.resolveReport(r.id) }, ['处理']));
        }
        panel.appendChild(row);
      }
    },

    async renderLogs(panel) {
      const t = X.t;
      const logs = await X.store.getLogs();
      panel.innerHTML = `<div class="card-title">${t('admin.logs')} (${logs.length})</div>`;
      if (!logs.length) { panel.innerHTML += `<div class="empty"><div class="ico">📜</div><p>${t('common.empty')}</p></div>`; return; }
      const opCache = {}, tgCache = {};
      const rows = [];
      for (const l of logs) {
        if (l.operator_id && !opCache[l.operator_id]) opCache[l.operator_id] = await X.store.getUser(l.operator_id);
        if (l.target_user_id && !tgCache[l.target_user_id]) tgCache[l.target_user_id] = await X.store.getUser(l.target_user_id);
        const op = opCache[l.operator_id] || { username: '?' };
        const tgt = tgCache[l.target_user_id] || { username: '?' };
        rows.push(`<tr><td>${X.utils.relTime(l.created_at)}</td><td>${X.utils.escape(op.username || '?')} → ${X.utils.escape(l.action || '')}</td><td>${X.utils.escape(tgt.username || '?')}</td><td class="dim">${X.utils.escape(l.reason || '')}</td></tr>`);
      }
      const tbl = document.createElement('div');
      tbl.style.overflow = 'auto';
      tbl.innerHTML = `<table class="table"><thead><tr><th>时间</th><th>操作</th><th>目标</th><th>原因</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
      panel.appendChild(tbl);
    },

    // ===== 操作 =====
    /** 超级管理员搜索用户并授予 admin 角色 */
    async grantAdminUI() {
      if (!X.auth.isSuper()) { X.ui.toast(X.t('err.noPerm'), 'err'); return; }
      const username = await X.ui.prompt({
        title: X.t('admin.grant'), label: X.t('auth.username'),
        placeholder: 'search by username',
        validate: v => v ? null : X.t('err.required')
      });
      if (!username) return;
      const u = await X.store.getUserByName(username);
      if (!u) { X.ui.toast('用户不存在', 'err'); return; }
      const r = await X.auth.grantAdmin(u.id);
      if (r.ok) {
        const cur = X.auth.currentUser();
        await X.store.addLog({ operatorId: cur.id, action: 'grant admin', targetUserId: u.id, reason: 'super grant admin' });
        X.ui.toast(X.t('admin.grant') + ' ✓', 'ok');
        await this.renderTab();
      } else {
        X.ui.toast(r.msg, 'err');
      }
    },

    /** 通用操作入口：必须填写原因 */
    async act(type, userId) {
      const u = await X.store.getUser(userId);
      if (!u) return;
      const cur = X.auth.currentUser();
      const reason = await this.askReason(type);
      if (!reason && type !== 'grant') return;

      try {
        if (type === 'award' || type === 'deduct') {
          const amt = await X.ui.prompt({
            title: X.t('admin.amount'), label: X.t('admin.amount'), placeholder: '0.01', validate: v => (!v || isNaN(+v)) ? X.t('err.required') : null
          });
          if (!amt) return;
          const delta = type === 'award' ? +amt : -amt;
          await X.store.adjustCoin(userId, delta);
          await X.store.addLog({ operatorId: cur.id, action: type + ' ' + Math.abs(delta), targetUserId: userId, reason });
          X.ui.toast(X.t('ok.coinSent'), 'ok');
        } else if (type === 'ban') {
          const perm = await X.ui.confirm(X.t('admin.banPerm') + '?', X.t('admin.ban'));
          const banned = JSON.stringify(perm ? { perm: true } : { until: Date.now() + 7 * 86400000 });
          await X.store.updateProfile(userId, { banned });
          await X.store.addLog({ operatorId: cur.id, action: 'ban ' + (perm ? 'perm' : '7d'), targetUserId: userId, reason });
          X.ui.toast(X.t('ok.banned'), 'ok');
        } else if (type === 'mute') {
          const perm = await X.ui.confirm(X.t('admin.banPerm') + '?', X.t('admin.mute'));
          const muted = JSON.stringify(perm ? { perm: true } : { until: Date.now() + 24 * 3600000 });
          await X.store.updateProfile(userId, { muted });
          await X.store.addLog({ operatorId: cur.id, action: 'mute ' + (perm ? 'perm' : '24h'), targetUserId: userId, reason });
          X.ui.toast(X.t('ok.muted'), 'ok');
        } else if (type === 'grant') {
          const r = await X.auth.grantAdmin(userId);
          if (r.ok) {
            await X.store.addLog({ operatorId: cur.id, action: 'grant admin', targetUserId: userId, reason: 'super grant admin' });
            X.ui.toast(X.t('admin.grant') + ' ✓', 'ok');
          }
        }
        X.ui.refresh();
        await this.renderTab();
      } catch (e) {
        X.ui.toast('操作失败', 'err');
      }
    },

    async askReason(type) {
      return X.ui.prompt({
        title: X.t('admin.' + (type === 'award' ? 'award' : type === 'deduct' ? 'deduct' : type === 'ban' ? 'ban' : type === 'mute' ? 'mute' : 'grant')),
        label: X.t('admin.reason'),
        placeholder: X.t('admin.reason'),
        multiline: true,
        validate: v => v ? null : X.t('err.required')
      });
    },

    async reviewWork(workId, ok) {
      const cur = X.auth.currentUser();
      const w = await X.store.getWork(workId);
      if (!w) return;
      const reason = await X.ui.prompt({ title: ok ? '通过' : '拒绝', label: X.t('admin.reason'), placeholder: X.t('admin.reason'), multiline: true, validate: v => v ? null : X.t('err.required') });
      if (!reason) return;
      await X.store.saveWork({ id: w.id, status: ok ? 'approved' : 'rejected' });
      await X.store.addLog({ operatorId: cur.id, action: 'review ' + (ok ? 'approved' : 'rejected'), targetUserId: w.author_id, reason });
      X.ui.toast(X.t('ok.saved'), 'ok');
      await this.renderTab();
    },

    async resolveReport(reportId) {
      const cur = X.auth.currentUser();
      const reports = await X.store.getReports();
      const r = reports.find(x => x.id === reportId);
      if (!r) return;
      const action = await X.ui.prompt({ title: X.t('admin.reports'), label: '处理动作', placeholder: 'warn/ban/mute/none', validate: v => v ? null : X.t('err.required') });
      if (!action) return;
      await X.store.resolveReport(reportId, action, '');
      await X.store.addLog({ operatorId: cur.id, action: 'report ' + action, targetUserId: r.target_id, reason: r.reason });
      X.ui.toast(X.t('ok.saved'), 'ok');
      await this.renderTab();
    }
  };

  /** 解析 JSON 字符串字段（banned/muted 存为 text） */
  function parseJson(v) {
    if (!v) return null;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch { return null; }
  }

  X.modules.admin = admin;
  X.router.register('admin', { render: () => admin.render(), afterRender: () => admin.afterRender(), requiresAuth: true, requiresAdmin: true });
})(window.Xiao = window.Xiao || {});
