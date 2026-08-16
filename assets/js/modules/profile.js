// ============================================================
// Xiao · 模块 · 个人中心
// 头像 / Ttpx_A 资产 / 我的作品 / 好友 / 群组 / 拉黑名单 / 实名认证
// ============================================================
(function (X) {
  X.modules = X.modules || {};

  const profile = {
    tab: 'works',

    render() {
      if (!X.auth.requireLogin()) return;
      const u = X.auth.currentUser();
      if (!u) return;
      const t = X.t;
      const av = u.avatarType === 'dataurl'
        ? `<img class="avatar xl" src="${u.avatar}" />`
        : `<div class="avatar xl" style="display:grid;place-items:center;font-size:42px">${u.avatar}</div>`;
      const myWorks = X.store.getWorksByUser(u.id);
      const friends = X.store.getFriends(u.id);
      const groups = X.store.getGroupsByUser(u.id);
      const blocked = X.store.getBlocked(u.id);
      const freqs = X.store.getFriendReqs(u.id);

      return `
        <section class="app-view">
          <div class="profile-head">
            ${av}
            <div style="flex:1">
              <h2 style="margin:0">${X.utils.escape(u.username)}
                ${u.role === 'super' ? '<span class="tag accent">SUPER</span>' : u.role === 'admin' ? '<span class="tag accent">ADMIN</span>' : ''}
                ${X.auth.isAdmin() && u.role !== 'super' && u.role !== 'admin' ? '<span class="tag warn">TEMP ADMIN</span>' : ''}
              </h2>
              <p class="dim" style="margin:2px 0;font-size:13px">${X.utils.escape(u.bio || '—')}</p>
              <div class="profile-stats">
                <div class="stat"><div class="n mono" style="color:var(--gold)">✦ ${X.utils.coin(u.ttpxA)}</div><div class="l">${t('profile.coin')}</div></div>
                <div class="stat"><div class="n">${myWorks.length}</div><div class="l">${t('profile.myWorks')}</div></div>
                <div class="stat"><div class="n">${friends.length}</div><div class="l">${t('profile.friends')}</div></div>
                <div class="stat"><div class="n">${groups.length}</div><div class="l">${t('profile.groups')}</div></div>
                <div class="stat"><div class="n">${u.realname ? '✓' : '✗'}</div><div class="l">${t('profile.realname')}</div></div>
              </div>
            </div>
            <div class="col">
              ${u.realname ? `<span class="tag accent">${t('profile.realnameDone')}</span>` : `<button class="btn ghost sm" onclick="Xiao.modules.works.openRealname()">${t('profile.realnameBtn')}</button>`}
              <button class="btn ghost sm" onclick="Xiao.modules.social.createGroup()">${t('social.createGroup')} (20✦)</button>
            </div>
          </div>

          ${freqs.length ? `<div class="card" style="margin-bottom:14px;border-color:rgba(91,157,255,.3)"><div class="card-title">${t('social.friendReq')} (${freqs.length})</div><div id="pr_freqs"></div></div>` : ''}

          <div class="profile-tabs">
            <button class="${this.tab === 'works' ? 'active' : ''}" data-tab="works">${t('profile.myWorks')}</button>
            <button class="${this.tab === 'friends' ? 'active' : ''}" data-tab="friends">${t('profile.friends')}</button>
            <button class="${this.tab === 'groups' ? 'active' : ''}" data-tab="groups">${t('profile.groups')}</button>
            <button class="${this.tab === 'blocked' ? 'active' : ''}" data-tab="blocked">${t('profile.blocked')}</button>
          </div>
          <div id="pr_body"></div>
        </section>`;
    },

    afterRender() {
      X.utils.$$('.profile-tabs button').forEach(b => b.addEventListener('click', () => { this.tab = b.dataset.tab; this.renderTab(); X.utils.$$('.profile-tabs button').forEach(x => x.classList.toggle('active', x.dataset.tab === this.tab)); }));
      // 好友申请处理
      const freqBox = X.utils.$('#pr_freqs');
      if (freqBox) this.renderFriendReqs(freqBox);
      this.renderTab();
    },

    renderFriendReqs(box) {
      const cur = X.auth.currentUser();
      const reqs = X.store.getFriendReqs(cur.id);
      box.innerHTML = '';
      reqs.forEach(r => {
        const from = X.store.getUser(r.from) || { username: '?' };
        const row = X.utils.h('div', { class: 'list-item' });
        row.innerHTML = `<span class="dim">${X.utils.escape(from.username)}</span>`;
        row.appendChild(X.utils.h('span', { class: 'spacer' }));
        row.appendChild(X.utils.h('button', { class: 'btn primary sm', onclick: () => { X.store.resolveFriendReq(r.id, cur.id, true); X.ui.toast(X.t('social.accept'), 'ok'); X.router.render(); } }, [X.t('social.accept')]));
        row.appendChild(X.utils.h('button', { class: 'btn ghost sm', onclick: () => { X.store.resolveFriendReq(r.id, cur.id, false); X.ui.toast(X.t('social.decline'), 'info'); X.router.render(); } }, [X.t('social.decline')]));
        box.appendChild(row);
      });
    },

    renderTab() {
      const box = X.utils.$('#pr_body');
      if (!box) return;
      const cur = X.auth.currentUser();
      const t = X.t;
      if (this.tab === 'works') {
        const list = X.store.getWorksByUser(cur.id);
        if (!list.length) { box.innerHTML = `<div class="empty"><div class="ico">📦</div><p>${t('common.empty')}</p></div>`; return; }
        box.innerHTML = `<div class="grid auto">` + list.map(w => `
          <div class="work-card" onclick="Xiao.modules.works.openDetail('${w.id}')">
            <div class="thumb">${w.category === 'game' ? '🎮' : w.category === 'paper' ? '📄' : w.category === 'code' ? '💻' : '🔬'}</div>
            <h4>${X.utils.escape(w.name)}</h4>
            <div class="row-info"><span class="tag ${w.status === 'approved' ? 'accent' : 'warn'}">${w.status}</span><span>❤️ ${w.likes}</span></div>
          </div>`).join('') + `</div>`;
      } else if (this.tab === 'friends') {
        const ids = X.store.getFriends(cur.id);
        if (!ids.length) { box.innerHTML = `<div class="empty"><div class="ico">🤝</div><p>${t('common.empty')}</p></div>`; return; }
        box.innerHTML = '';
        ids.forEach(fid => {
          const f = X.store.getUser(fid); if (!f) return;
          const av = f.avatarType === 'dataurl' ? `<img class="avatar md clickable" src="${f.avatar}" onclick="Xiao.modules.social.openUserCard('${f.id}')" />` : `<div class="avatar md clickable" style="display:grid;place-items:center;font-size:20px" onclick="Xiao.modules.social.openUserCard('${f.id}')">${f.avatar}</div>`;
          box.insertAdjacentHTML('beforeend', `<div class="list-item">${av}<div class="meta"><div class="t">${X.utils.escape(f.username)}</div><div class="s">✦ ${X.utils.coin(f.ttpxA)}</div></div><span class="spacer"></span><button class="btn ghost sm" onclick="Xiao.modules.social.openDM('${f.id}')">${t('social.privateChat')}</button></div>`);
        });
      } else if (this.tab === 'groups') {
        const groups = X.store.getGroupsByUser(cur.id);
        if (!groups.length) { box.innerHTML = `<div class="empty"><div class="ico">👥</div><p>${t('common.empty')}</p><button class="btn primary sm" onclick="Xiao.modules.social.createGroup()">${t('social.createGroup')}</button></div>`; return; }
        box.innerHTML = '';
        groups.forEach(g => {
          box.insertAdjacentHTML('beforeend', `<div class="list-item"><div class="avatar md" style="display:grid;place-items:center;font-size:20px">👥</div><div class="meta"><div class="t">${X.utils.escape(g.name)}</div><div class="s">${g.members.length}/20 · ${g.ownerId === cur.id ? t('admin.super') : 'member'}</div></div><span class="spacer"></span><button class="btn ghost sm" onclick="Xiao.modules.social.openGroupChat('${g.id}')">💬</button></div>`);
        });
      } else if (this.tab === 'blocked') {
        const ids = X.store.getBlocked(cur.id);
        if (!ids.length) { box.innerHTML = `<div class="empty"><div class="ico">🚫</div><p>${t('common.empty')}</p></div>`; return; }
        box.innerHTML = '';
        ids.forEach(bid => {
          const f = X.store.getUser(bid); if (!f) return;
          box.insertAdjacentHTML('beforeend', `<div class="list-item"><div class="avatar md" style="display:grid;place-items:center;font-size:20px">🚫</div><div class="meta"><div class="t">${X.utils.escape(f.username)}</div><div class="s">blocked</div></div><span class="spacer"></span><button class="btn ghost sm" onclick="Xiao.store.unblock('${cur.id}','${bid}');Xiao.ui.toast('${t('social.unblock')}','ok');Xiao.router.render();">${t('social.unblock')}</button></div>`);
        });
      }
    }
  };

  X.modules.profile = profile;
  X.router.register('profile', { render: () => profile.render(), afterRender: () => profile.afterRender(), requiresAuth: true });
})(window.Xiao = window.Xiao || {});
