// ============================================================
// Xiao · 模块 · 个人中心（Supabase）
// 头像 / Ttpx_A 资产 / 我的作品 / 好友 / 群组 / 拉黑名单 / 实名认证
// 所有数据从 Supabase 异步加载。
// ============================================================
(function (X) {
  X.modules = X.modules || {};

  const profile = {
    tab: 'works',
    _data: { works: [], friends: [], groups: [], blocked: [], freqs: [] },

    render() {
      if (!X.auth.requireLogin()) return;
      const u = X.auth.currentUser();
      if (!u) return;
      const t = X.t;
      const av = u.avatar_type === 'dataurl'
        ? `<img class="avatar xl" src="${u.avatar}" />`
        : `<div class="avatar xl" style="display:grid;place-items:center;font-size:42px">${u.avatar}</div>`;

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
                <div class="stat"><div class="n mono" style="color:var(--gold)">✦ ${X.utils.coin(u.ttpx_a)}</div><div class="l">${t('profile.coin')}</div></div>
                <div class="stat"><div class="n" id="pr_stat_works">-</div><div class="l">${t('profile.myWorks')}</div></div>
                <div class="stat"><div class="n" id="pr_stat_friends">-</div><div class="l">${t('profile.friends')}</div></div>
                <div class="stat"><div class="n" id="pr_stat_groups">-</div><div class="l">${t('profile.groups')}</div></div>
                <div class="stat"><div class="n">${u.realname ? '✓' : '✗'}</div><div class="l">${t('profile.realname')}</div></div>
              </div>
            </div>
            <div class="col">
              ${u.realname ? `<span class="tag accent">${t('profile.realnameDone')}</span>` : `<button class="btn ghost sm" onclick="Xiao.modules.works.openRealname()">${t('profile.realnameBtn')}</button>`}
              <button class="btn ghost sm" onclick="Xiao.modules.social.createGroup()">${t('social.createGroup')} (20✦)</button>
            </div>
          </div>

          <div class="card" id="pr_freqs_wrap" style="margin-bottom:14px;border-color:rgba(91,157,255,.3);display:none"><div class="card-title">${t('social.friendReq')} (<span id="pr_freqs_count">0</span>)</div><div id="pr_freqs"></div></div>

          <div class="profile-tabs">
            <button class="${this.tab === 'works' ? 'active' : ''}" data-tab="works">${t('profile.myWorks')}</button>
            <button class="${this.tab === 'friends' ? 'active' : ''}" data-tab="friends">${t('profile.friends')}</button>
            <button class="${this.tab === 'groups' ? 'active' : ''}" data-tab="groups">${t('profile.groups')}</button>
            <button class="${this.tab === 'blocked' ? 'active' : ''}" data-tab="blocked">${t('profile.blocked')}</button>
          </div>
          <div id="pr_body"><div class="dim center" style="padding:20px">加载中...</div></div>
        </section>`;
    },

    async afterRender() {
      X.utils.$$('.profile-tabs button').forEach(b => b.addEventListener('click', () => {
        this.tab = b.dataset.tab; this.renderTab();
        X.utils.$$('.profile-tabs button').forEach(x => x.classList.toggle('active', x.dataset.tab === this.tab));
      }));

      const cur = X.auth.currentUser();
      if (!cur) return;
      if (!X.supabaseReady) {
        const box = X.utils.$('#pr_body');
        if (box) box.innerHTML = '<div class="dim center">⚠ Supabase 未配置</div>';
        return;
      }
      try {
        // 并行加载所有数据
        const [works, friends, groups, blocked, freqs] = await Promise.all([
          X.store.getWorksByUser(cur.id),
          X.store.getFriends(cur.id),
          X.store.getGroupsByUser(cur.id),
          X.store.getBlocked(cur.id),
          X.store.getFriendReqs(cur.id)
        ]);
        this._data = { works, friends, groups, blocked, freqs };

        // 更新统计数字
        const sw = X.utils.$('#pr_stat_works'); if (sw) sw.textContent = works.length;
        const sf = X.utils.$('#pr_stat_friends'); if (sf) sf.textContent = friends.length;
        const sg = X.utils.$('#pr_stat_groups'); if (sg) sg.textContent = groups.length;

        // 好友申请
        if (freqs.length) {
          const wrap = X.utils.$('#pr_freqs_wrap');
          const cnt = X.utils.$('#pr_freqs_count');
          const fbox = X.utils.$('#pr_freqs');
          if (wrap) wrap.style.display = '';
          if (cnt) cnt.textContent = freqs.length;
          if (fbox) await this.renderFriendReqs(fbox, freqs);
        }

        await this.renderTab();
      } catch (e) {
        const box = X.utils.$('#pr_body');
        if (box) box.innerHTML = '<div class="dim center">加载失败</div>';
      }
    },

    async renderFriendReqs(box, reqs) {
      const cur = X.auth.currentUser();
      box.innerHTML = '';
      for (const r of reqs) {
        const from = await X.store.getUser(r.from_id) || { username: '?' };
        const row = X.utils.h('div', { class: 'list-item' });
        row.innerHTML = `<span class="dim">${X.utils.escape(from.username || from.from_name || '?')}</span>`;
        row.appendChild(X.utils.h('span', { class: 'spacer' }));
        row.appendChild(X.utils.h('button', { class: 'btn primary sm', onclick: async () => {
          await X.store.resolveFriendReq(r.id, cur.id, true);
          X.ui.toast(X.t('social.accept'), 'ok');
          X.router.render();
        } }, [X.t('social.accept')]));
        row.appendChild(X.utils.h('button', { class: 'btn ghost sm', onclick: async () => {
          await X.store.resolveFriendReq(r.id, cur.id, false);
          X.ui.toast(X.t('social.decline'), 'info');
          X.router.render();
        } }, [X.t('social.decline')]));
        box.appendChild(row);
      }
    },

    async renderTab() {
      const box = X.utils.$('#pr_body');
      if (!box) return;
      const cur = X.auth.currentUser();
      const t = X.t;

      if (this.tab === 'works') {
        const list = this._data.works;
        if (!list.length) { box.innerHTML = `<div class="empty"><div class="ico">📦</div><p>${t('common.empty')}</p></div>`; return; }
        box.innerHTML = `<div class="grid auto">` + list.map(w => `
          <div class="work-card" onclick="Xiao.modules.works.openDetail('${w.id}')">
            <div class="thumb">${w.category === 'game' ? '🎮' : w.category === 'paper' ? '📄' : w.category === 'code' ? '💻' : '🔬'}</div>
            <h4>${X.utils.escape(w.name)}</h4>
            <div class="row-info"><span class="tag ${w.status === 'approved' ? 'accent' : 'warn'}">${w.status}</span><span>❤️ ${w.likes || 0}</span></div>
          </div>`).join('') + `</div>`;
      } else if (this.tab === 'friends') {
        const ids = this._data.friends;
        if (!ids.length) { box.innerHTML = `<div class="empty"><div class="ico">🤝</div><p>${t('common.empty')}</p></div>`; return; }
        box.innerHTML = '';
        for (const fid of ids) {
          const f = await X.store.getUser(fid); if (!f) continue;
          const av = f.avatar_type === 'dataurl' ? `<img class="avatar md clickable" src="${f.avatar}" onclick="Xiao.modules.social.openUserCard('${f.id}')" />` : `<div class="avatar md clickable" style="display:grid;place-items:center;font-size:20px" onclick="Xiao.modules.social.openUserCard('${f.id}')">${f.avatar}</div>`;
          box.insertAdjacentHTML('beforeend', `<div class="list-item">${av}<div class="meta"><div class="t">${X.utils.escape(f.username)}</div><div class="s">✦ ${X.utils.coin(f.ttpx_a)}</div></div><span class="spacer"></span><button class="btn ghost sm" onclick="Xiao.modules.social.openDM('${f.id}')">${t('social.privateChat')}</button></div>`);
        }
      } else if (this.tab === 'groups') {
        const groups = this._data.groups;
        if (!groups.length) { box.innerHTML = `<div class="empty"><div class="ico">👥</div><p>${t('common.empty')}</p><button class="btn primary sm" onclick="Xiao.modules.social.createGroup()">${t('social.createGroup')}</button></div>`; return; }
        box.innerHTML = '';
        for (const g of groups) {
          const members = await X.store.getGroupMembers(g.id);
          const isOwner = g.owner_id === cur.id;
          box.insertAdjacentHTML('beforeend', `<div class="list-item"><div class="avatar md" style="display:grid;place-items:center;font-size:20px">👥</div><div class="meta"><div class="t">${X.utils.escape(g.name)}</div><div class="s">${members.length}/20 · ${isOwner ? t('admin.super') : 'member'}</div></div><span class="spacer"></span><button class="btn ghost sm" onclick="Xiao.modules.social.openGroupChat('${g.id}')">💬</button></div>`);
        }
      } else if (this.tab === 'blocked') {
        const ids = this._data.blocked;
        if (!ids.length) { box.innerHTML = `<div class="empty"><div class="ico">🚫</div><p>${t('common.empty')}</p></div>`; return; }
        box.innerHTML = '';
        for (const bid of ids) {
          const f = await X.store.getUser(bid); if (!f) continue;
          box.insertAdjacentHTML('beforeend', `<div class="list-item"><div class="avatar md" style="display:grid;place-items:center;font-size:20px">🚫</div><div class="meta"><div class="t">${X.utils.escape(f.username)}</div><div class="s">blocked</div></div><span class="spacer"></span><button class="btn ghost sm" onclick="Xiao.store.unblock('${cur.id}','${bid}').then(()=>{Xiao.ui.toast('${t('social.unblock')}','ok');Xiao.router.render();})">${t('social.unblock')}</button></div>`);
        }
      }
    }
  };

  X.modules.profile = profile;
  X.router.register('profile', { render: () => profile.render(), afterRender: () => profile.afterRender(), requiresAuth: true });
})(window.Xiao = window.Xiao || {});
