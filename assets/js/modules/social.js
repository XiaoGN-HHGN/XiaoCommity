// ============================================================
// Xiao · 模块 · 社交
// 用户卡片 / 私聊 / 好友申请 / 拉黑 / 付费建群（20 Ttpx_A）/ 举报入口
// ============================================================
(function (X) {
  X.modules = X.modules || {};

  const social = {
    /** 用户卡片弹窗：私聊 / 好友申请 / 拉黑 / 举报 */
    openUserCard(userId) {
      const u = X.store.getUser(userId);
      if (!u) { X.ui.toast('user not found', 'err'); return; }
      const cur = X.auth.currentUser();
      const isSelf = cur && cur.id === userId;
      const isFriend = cur && X.store.getFriends(cur.id).includes(userId);
      const blocked = cur && X.store.getBlocked(cur.id).includes(userId);
      const av = u.avatarType === 'dataurl'
        ? `<img class="avatar xl" src="${u.avatar}" />`
        : `<div class="avatar xl" style="display:grid;place-items:center;font-size:42px">${u.avatar}</div>`;

      const body = `
        <div style="display:flex;gap:14px;align-items:center">
          ${av}
          <div>
            <h3 style="margin:0">${X.utils.escape(u.username)} ${u.role === 'super' ? '<span class="tag accent">SUPER</span>' : u.role === 'admin' ? '<span class="tag accent">ADMIN</span>' : ''}</h3>
            <p class="dim" style="margin:4px 0;font-size:12px">${u.bio || '—'}</p>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <span class="tag gold">✦ ${X.utils.coin(u.ttpxA)}</span>
              <span class="tag">${u.realname ? '✓ 实名' : '未实名'}</span>
              <span class="tag">加入 ${X.utils.relTime(u.createdAt)}</span>
            </div>
          </div>
        </div>
        <div id="uc_actions" style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"></div>`;

      const inst = X.ui.modal({ title: X.t('profile.title'), body });

      const actBox = X.utils.$('#uc_actions', inst.modal);
      const btns = [];
      if (isSelf) {
        btns.push(X.utils.h('button', { class: 'btn ghost', onclick: () => { inst.close(); X.router.go('profile'); } }, ['编辑我的资料']));
      } else {
        btns.push(X.utils.h('button', { class: 'btn primary', onclick: () => { inst.close(); this.openDM(userId); } }, [X.t('social.privateChat')]));
        if (isFriend) {
          btns.push(X.utils.h('button', { class: 'btn ghost', onclick: () => { X.store.removeFriend(cur.id, userId); X.ui.toast(X.t('social.unfriend'), 'ok'); inst.close(); } }, [X.t('social.unfriend')]));
        } else {
          btns.push(X.utils.h('button', { class: 'btn ghost', onclick: () => {
            const r = X.store.sendFriendReq(cur.id, userId);
            X.ui.toast(r ? X.t('social.friendReq') + ' ✓' : '已申请', r ? 'ok' : 'info');
          } }, [X.t('social.friendReq')]));
        }
        if (blocked) {
          btns.push(X.utils.h('button', { class: 'btn ghost', onclick: () => { X.store.unblock(cur.id, userId); X.ui.toast(X.t('social.unblock'), 'ok'); inst.close(); } }, [X.t('social.unblock')]));
        } else {
          btns.push(X.utils.h('button', { class: 'btn danger', onclick: () => { X.store.block(cur.id, userId); X.ui.toast(X.t('social.block'), 'ok'); inst.close(); } }, [X.t('social.block')]));
        }
        btns.push(X.utils.h('button', { class: 'btn ghost', onclick: () => { inst.close(); this.openReport('user', userId); } }, [X.t('chat.report')]));
      }
      btns.forEach(b => actBox.appendChild(b));
    },

    /** 私聊弹窗 */
    openDM(otherId) {
      if (!X.auth.requireLogin()) return;
      const cur = X.auth.currentUser();
      // 拉黑互检
      if (X.store.getBlocked(cur.id).includes(otherId) || X.store.getBlocked(otherId).includes(cur.id)) {
        X.ui.toast(X.t('social.block'), 'err'); return;
      }
      const other = X.store.getUser(otherId);
      const inst = X.ui.modal({ title: X.t('social.privateChat') + ' · ' + other.username, size: 'wide' });
      inst.bodyEl.innerHTML = `
        <div id="dm_body" style="height:50vh;overflow:auto;display:flex;flex-direction:column;gap:8px;padding:4px"></div>
        <div class="row" style="margin-top:10px">
          <input class="input grow" id="dm_input" placeholder="${X.t('chat.placeholder')}" />
          <button class="btn primary" id="dm_send">${X.t('chat.send')}</button>
        </div>`;
      const render = () => {
        const box = X.utils.$('#dm_body', inst.modal);
        if (!box) return;
        const list = X.store.getDM(cur.id, otherId);
        box.innerHTML = '';
        list.forEach(m => {
          const mine = m.from === cur.id;
          const b = X.utils.h('div', { class: 'msg' + (mine ? ' me' : '') });
          const meta = X.utils.h('div', { class: 'meta-col' });
          meta.appendChild(X.utils.h('div', { class: 'bubble' + (mine ? ' me' : '') }));
          meta.firstChild.innerHTML = X.modules.chat.format(m.text);
          b.appendChild(meta);
          box.appendChild(b);
        });
        box.scrollTop = box.scrollHeight;
      };
      render();
      X.utils.$('#dm_send', inst.modal).addEventListener('click', () => {
        const inp = X.utils.$('#dm_input', inst.modal);
        const text = inp.value.trim();
        if (!text) return;
        X.store.addDM(cur.id, otherId, text);
        inp.value = '';
        render();
      });
      // 轮询新消息
      const timer = setInterval(() => { if (!document.body.contains(inst.modal)) { clearInterval(timer); return; } render(); }, 1500);
    },

    /** 创建群组（消耗 20 Ttpx_A，上限 20 人） */
    async createGroup() {
      if (!X.auth.requireLogin()) return;
      const cur = X.auth.currentUser();
      if (cur.ttpxA < 20) { X.ui.toast(X.t('err.insufficientCoin'), 'err'); return; }
      const name = await X.ui.prompt({
        title: X.t('social.createGroup'),
        label: X.t('social.groupName'),
        placeholder: 'Group name',
        validate: v => v ? null : X.t('err.required')
      });
      if (!name) return;
      X.store.adjustCoin(cur.id, -20);
      const g = X.store.createGroup(cur.id, name);
      X.ui.toast(X.t('social.createGroup') + ' ✓ -20 Ttpx_A', 'ok');
      X.ui.refresh();
      X.router.go('profile');
      return g;
    },

    /** 群聊弹窗（群主/管理员可踢人、禁言；演示本地） */
    openGroupChat(groupId) {
      if (!X.auth.requireLogin()) return;
      const cur = X.auth.currentUser();
      const groups = X.store.getGroups();
      const g = groups.find(x => x.id === groupId);
      if (!g) { X.ui.toast('group not found', 'err'); return; }
      const isOwner = g.ownerId === cur.id;
      const isAdmin = g.admins.includes(cur.id);
      const inst = X.ui.modal({ title: '👥 ' + g.name + ' (' + g.members.length + '/20)', size: 'wide' });
      inst.bodyEl.innerHTML = `
        <div id="gp_body" style="height:46vh;overflow:auto;display:flex;flex-direction:column;gap:8px;padding:4px"></div>
        <div class="row" style="margin-top:10px"><input class="input grow" id="gp_input" placeholder="${X.t('chat.placeholder')}" /><button class="btn primary" id="gp_send">${X.t('chat.send')}</button></div>
        ${(isOwner || isAdmin) ? `<div class="hint" style="margin-top:6px">${X.t('nav.admin')}：可踢人/禁言</div>` : ''}`;
      const render = () => {
        const box = X.utils.$('#gp_body', inst.modal);
        if (!box) return;
        const msgs = X.store.getGroupMessages(g.id);
        box.innerHTML = '';
        msgs.forEach(m => {
          const author = X.store.getUser(m.userId) || { username: '?', avatar: '❓', avatarType: 'emoji' };
          const mine = m.userId === cur.id;
          const av = author.avatarType === 'dataurl' ? `<img class="avatar sm" src="${author.avatar}" />` : `<div class="avatar sm" style="display:grid;place-items:center;font-size:13px">${author.avatar}</div>`;
          const row = X.utils.h('div', { class: 'msg' + (mine ? ' me' : '') });
          row.innerHTML = av;
          const meta = X.utils.h('div', { class: 'meta-col' });
          meta.innerHTML = `<div class="name">${X.utils.escape(author.username)} · ${X.utils.relTime(m.ts)}</div>`;
          const b = X.utils.h('div', { class: 'bubble' + (mine ? ' me' : '') });
          b.innerHTML = X.modules.chat.format(m.text);
          meta.appendChild(b);
          row.appendChild(meta);
          if ((isOwner || isAdmin) && !mine) {
            const menu = X.utils.h('button', { class: 'btn ghost sm', onclick: () => X.store.removeGroupMember(g.id, m.userId) }, ['踢出']);
            row.appendChild(menu);
          }
          box.appendChild(row);
        });
        box.scrollTop = box.scrollHeight;
      };
      render();
      X.utils.$('#gp_send', inst.modal).addEventListener('click', () => {
        const inp = X.utils.$('#gp_input', inst.modal);
        const text = inp.value.trim(); if (!text) return;
        X.store.addGroupMessage(g.id, cur.id, text);
        inp.value = ''; render();
      });
      const timer = setInterval(() => { if (!document.body.contains(inst.modal)) { clearInterval(timer); return; } render(); }, 1500);
    },

    /** 举报弹窗 */
    async openReport(targetType, targetId) {
      if (!X.auth.requireLogin()) return;
      const reason = await X.ui.prompt({
        title: X.t('chat.report'),
        label: X.t('admin.reason'),
        placeholder: 'describe the issue',
        multiline: true,
        validate: v => v ? null : X.t('err.required')
      });
      if (!reason) return;
      const cur = X.auth.currentUser();
      X.store.addReport({ reporterId: cur.id, targetType, targetId, reason });
      X.ui.toast(X.t('ok.reportSent'), 'ok');
    }
  };

  X.modules.social = social;
})(window.Xiao = window.Xiao || {});
