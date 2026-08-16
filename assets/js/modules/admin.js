// ============================================================
// Xiao · 模块 · 管理员后台
// 用户管理 / 代币查询 / 作品审核（可下载核验）/ 举报审核 / 操作记录
// 所有操作必须手动填写原因，留存操作记录
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
            <div class="admin-panel card" id="ad_panel"></div>
          </div>
        </section>`;
    },

    afterRender() {
      X.utils.$$('.admin-side a').forEach(a => a.addEventListener('click', () => { this.tab = a.dataset.tab; this.renderTab(); X.utils.$$('.admin-side a').forEach(x => x.classList.toggle('active', x.dataset.tab === this.tab)); }));
      this.renderTab();
    },

    renderTab() {
      const panel = X.utils.$('#ad_panel');
      if (!panel) return;
      const t = X.t;
      if (this.tab === 'users') this.renderUsers(panel);
      else if (this.tab === 'coins') this.renderCoins(panel);
      else if (this.tab === 'works') this.renderWorks(panel);
      else if (this.tab === 'reports') this.renderReports(panel);
      else if (this.tab === 'logs') this.renderLogs(panel);
    },

    renderUsers(panel) {
      const t = X.t;
      const users = X.store.getUsers();
      const cur = X.auth.currentUser();
      let html = `<div class="row" style="align-items:center;margin-bottom:10px"><div class="card-title" style="margin:0">${t('admin.users')} (${users.length})</div><span class="spacer"></span>`;
      if (X.auth.isSuper()) html += `<button class="btn primary sm" onclick="Xiao.modules.admin.registerAdmin()">＋ ${t('nav.register')} ${t('nav.admin')}</button>`;
      html += `</div>`;
      html += `<div style="overflow:auto"><table class="table"><thead><tr><th>${t('auth.username')}</th><th>${t('admin.coins')}</th><th>角色</th><th>状态</th><th>操作</th></tr></thead><tbody>`;
      users.forEach(u => {
        const banned = u.banned && (u.banned.perm || (u.banned.until && u.banned.until > Date.now()));
        const muted = u.muted && (u.muted.perm || (u.muted.until && u.muted.until > Date.now()));
        html += `<tr>
          <td>${X.utils.escape(u.username)} ${u.id === cur.id ? '(me)' : ''}</td>
          <td class="mono gold">✦ ${X.utils.coin(u.ttpxA)}</td>
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

    renderCoins(panel) {
      const t = X.t;
      const users = X.store.getUsers().slice().sort((a, b) => (b.ttpxA || 0) - (a.ttpxA || 0));
      const total = users.reduce((s, u) => s + (u.ttpxA || 0), 0);
      panel.innerHTML = `<div class="card-title">${t('admin.coins')}</div>
        <div class="row" style="margin-bottom:10px"><span class="tag gold">总流通 ✦ ${X.utils.coin(total)}</span><span class="tag">${users.length} users</span></div>
        <div style="overflow:auto"><table class="table"><thead><tr><th>#</th><th>${t('auth.username')}</th><th>余额</th></tr></thead><tbody>
        ${users.map((u, i) => `<tr><td>${i + 1}</td><td>${X.utils.escape(u.username)}</td><td class="mono gold">✦ ${X.utils.coin(u.ttpxA)}</td></tr>`).join('')}
        </tbody></table></div>`;
    },

    renderWorks(panel) {
      const t = X.t;
      const works = X.store.getWorks();
      panel.innerHTML = `<div class="card-title">${t('admin.worksReview')} (${works.length})</div>`;
      if (!works.length) { panel.innerHTML += `<div class="empty"><div class="ico">📦</div><p>${t('common.empty')}</p></div>`; return; }
      works.forEach(w => {
        const author = X.store.getUser(w.authorId) || { username: '?' };
        const row = X.utils.h('div', { class: 'list-item', style: { flexWrap: 'wrap' } });
        row.innerHTML = `<div class="meta"><div class="t">${X.utils.escape(w.name)}</div><div class="s">${X.utils.escape(author.username)} · ${w.category} · ${w.status}</div></div><span class="spacer"></span>`;
        const grp = X.utils.h('div', { class: 'row' });
        grp.appendChild(X.utils.h('button', { class: 'btn ghost sm', onclick: () => X.utils.downloadText(w.fileName, w.fileContent, 'text/plain') }, ['⬇ 下载核验']));
        if (w.status === 'pending') {
          grp.appendChild(X.utils.h('button', { class: 'btn primary sm', onclick: () => this.reviewWork(w.id, true) }, ['通过']));
          grp.appendChild(X.utils.h('button', { class: 'btn danger sm', onclick: () => this.reviewWork(w.id, false) }, ['拒绝']));
        }
        row.appendChild(grp);
        panel.appendChild(row);
      });
    },

    renderReports(panel) {
      const t = X.t;
      const reports = X.store.getReports();
      panel.innerHTML = `<div class="card-title">${t('admin.reports')} (${reports.length})</div>`;
      if (!reports.length) { panel.innerHTML += `<div class="empty"><div class="ico">⚠️</div><p>${t('common.empty')}</p></div>`; return; }
      reports.forEach(r => {
        const reporter = X.store.getUser(r.reporterId) || { username: '?' };
        let target = r.targetType === 'user' ? (X.store.getUser(r.targetId) || {}).username
          : r.targetType === 'work' ? (X.store.getWork(r.targetId) || {}).name
          : r.targetId;
        const row = X.utils.h('div', { class: 'list-item', style: { flexWrap: 'wrap' } });
        row.innerHTML = `<div class="meta"><div class="t">[${r.targetType}] ${X.utils.escape(target || '')}</div><div class="s">by ${X.utils.escape(reporter.username)} · ${X.utils.escape(r.reason)}</div></div><span class="spacer"></span><span class="tag ${r.status === 'pending' ? 'warn' : 'accent'}">${r.status}</span>`;
        if (r.status === 'pending') {
          row.appendChild(X.utils.h('button', { class: 'btn primary sm', onclick: () => this.resolveReport(r.id) }, ['处理']));
        }
        panel.appendChild(row);
      });
    },

    renderLogs(panel) {
      const t = X.t;
      const logs = X.store.getLogs();
      panel.innerHTML = `<div class="card-title">${t('admin.logs')} (${logs.length})</div>`;
      if (!logs.length) { panel.innerHTML += `<div class="empty"><div class="ico">📜</div><p>${t('common.empty')}</p></div>`; return; }
      const tbl = document.createElement('div');
      tbl.style.overflow = 'auto';
      tbl.innerHTML = `<table class="table"><thead><tr><th>时间</th><th>操作</th><th>目标</th><th>原因</th></tr></thead><tbody>${
        logs.map(l => {
          const op = X.store.getUser(l.operatorId) || { username: '?' };
          const tgt = X.store.getUser(l.targetUserId) || { username: '?' };
          return `<tr><td>${X.utils.relTime(l.ts)}</td><td>${X.utils.escape(op.username)} → ${X.utils.escape(l.action)}</td><td>${X.utils.escape(tgt.username)}</td><td class="dim">${X.utils.escape(l.reason || '')}</td></tr>`;
        }).join('')
      }</tbody></table>`;
      panel.appendChild(tbl);
    },

    // ===== 操作 =====
    /** 超级管理员手动注册管理员账号 */
    async registerAdmin() {
      if (!X.auth.isSuper()) { X.ui.toast(X.t('err.noPerm'), 'err'); return; }
      const cur = X.auth.currentUser();
      const username = await X.ui.prompt({ title: X.t('nav.register') + ' ' + X.t('nav.admin'), label: X.t('auth.username'), placeholder: 'admin name', validate: v => v ? (X.store.getUserByName(v) ? X.t('err.userExists') : null) : X.t('err.required') });
      if (!username) return;
      const password = await X.ui.prompt({ title: X.t('auth.password'), label: X.t('auth.password'), placeholder: '≥6', validate: v => X.utils.isPassword(v) ? null : X.t('err.required') });
      if (!password) return;
      const phone = await X.ui.prompt({ title: X.t('auth.phone'), label: X.t('auth.phone'), placeholder: 'phone', validate: v => X.utils.isPhone(v) ? null : X.t('err.phoneFormat') });
      if (!phone) return;
      const u = X.store.createUser({ username, password, phone, avatar: X.utils.randAvatar(), avatarType: 'emoji' });
      u.role = 'admin'; X.store.saveUser(u);
      X.store.addLog({ operatorId: cur.id, action: 'register admin', targetUserId: u.id, reason: 'super create admin' });
      X.ui.toast(X.t('ok.registered'), 'ok');
      this.renderTab();
    },

    /** 通用操作入口：必须填写原因 */
    async act(type, userId) {
      const u = X.store.getUser(userId);
      if (!u) return;
      const cur = X.auth.currentUser();
      const reason = await this.askReason(type);
      if (!reason && type !== 'grant') return;

      if (type === 'award' || type === 'deduct') {
        const amt = await X.ui.prompt({
          title: X.t('admin.amount'), label: X.t('admin.amount'), placeholder: '0.01', validate: v => (!v || isNaN(+v)) ? X.t('err.required') : null
        });
        if (!amt) return;
        const delta = type === 'award' ? +amt : -amt;
        X.store.adjustCoin(userId, delta);
        X.store.addLog({ operatorId: cur.id, action: type + ' ' + Math.abs(delta), targetUserId: userId, reason });
        X.ui.toast(X.t('ok.coinSent'), 'ok');
      } else if (type === 'ban') {
        const dur = await X.ui.confirm(X.t('admin.banPerm') + '?', X.t('admin.ban'));
        u.banned = dur ? { perm: true } : { until: Date.now() + 7 * 86400000 };
        X.store.saveUser(u);
        X.store.addLog({ operatorId: cur.id, action: 'ban ' + (dur ? 'perm' : '7d'), targetUserId: userId, reason });
        X.ui.toast(X.t('ok.banned'), 'ok');
      } else if (type === 'mute') {
        const dur = await X.ui.confirm(X.t('admin.banPerm') + '?', X.t('admin.mute'));
        u.muted = dur ? { perm: true } : { until: Date.now() + 24 * 3600000 };
        X.store.saveUser(u);
        X.store.addLog({ operatorId: cur.id, action: 'mute ' + (dur ? 'perm' : '24h'), targetUserId: userId, reason });
        X.ui.toast(X.t('ok.muted'), 'ok');
      } else if (type === 'grant') {
        const r = X.auth.grantAdmin(userId);
        if (r.ok) {
          X.store.addLog({ operatorId: cur.id, action: 'grant admin', targetUserId: userId, reason: 'super grant' });
          X.ui.toast(X.t('admin.grant') + ' ✓', 'ok');
        }
      }
      X.ui.refresh();
      this.renderTab();
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
      const w = X.store.getWork(workId);
      if (!w) return;
      const reason = await X.ui.prompt({ title: ok ? '通过' : '拒绝', label: X.t('admin.reason'), placeholder: X.t('admin.reason'), multiline: true, validate: v => v ? null : X.t('err.required') });
      if (!reason) return;
      w.status = ok ? 'approved' : 'rejected';
      X.store.saveWork(w);
      X.store.addLog({ operatorId: cur.id, action: 'review ' + w.status, targetUserId: w.authorId, reason });
      X.ui.toast(X.t('ok.saved'), 'ok');
      this.renderTab();
    },

    async resolveReport(reportId) {
      const cur = X.auth.currentUser();
      const r = X.store.getReports().find(x => x.id === reportId);
      if (!r) return;
      const action = await X.ui.prompt({ title: X.t('admin.reports'), label: '处理动作', placeholder: 'warn/ban/mute/none', validate: v => v ? null : X.t('err.required') });
      if (!action) return;
      X.store.resolveReport(reportId, action, '');
      X.store.addLog({ operatorId: cur.id, action: 'report ' + action, targetUserId: r.targetId, reason: r.reason });
      X.ui.toast(X.t('ok.saved'), 'ok');
      this.renderTab();
    }
  };

  X.modules.admin = admin;
  X.router.register('admin', { render: () => admin.render(), afterRender: () => admin.afterRender(), requiresAuth: true, requiresAdmin: true });
})(window.Xiao = window.Xiao || {});
