// ============================================================
// Xiao · 模块 · 社交（Supabase）
// 用户卡片 / 私聊 / 好友申请 / 拉黑 / 付费建群（20 Ttpx_A）/ 举报入口
// 私聊 & 群聊通过 Supabase Realtime 订阅 INSERT 事件实时推送。
// ============================================================
(function (X) {
  X.modules = X.modules || {};

  const social = {
    /** 用户卡片弹窗：私聊 / 好友申请 / 拉黑 / 举报 */
    async openUserCard(userId) {
      if (!X.supabaseReady) { X.ui.toast('Supabase 未配置', 'err'); return; }
      const u = await X.store.getUser(userId);
      if (!u) { X.ui.toast('user not found', 'err'); return; }
      const cur = X.auth.currentUser();
      const isSelf = cur && cur.id === userId;
      let isFriend = false, blocked = false;
      if (cur && !isSelf) {
        const friends = await X.store.getFriends(cur.id);
        isFriend = friends.includes(userId);
        const blocks = await X.store.getBlocked(cur.id);
        blocked = blocks.includes(userId);
      }
      const av = u.avatar_type === 'dataurl'
        ? `<img class="avatar xl" src="${u.avatar}" />`
        : `<div class="avatar xl" style="display:grid;place-items:center;font-size:42px">${u.avatar || '❓'}</div>`;

      const body = `
        <div style="display:flex;gap:14px;align-items:center">
          ${av}
          <div>
            <h3 style="margin:0">${X.utils.escape(u.username)} ${u.role === 'super' ? '<span class="tag accent">SUPER</span>' : u.role === 'admin' ? '<span class="tag accent">ADMIN</span>' : ''}</h3>
            <p class="dim" style="margin:4px 0;font-size:12px">${X.utils.escape(u.bio || '—')}</p>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <span class="tag gold">✦ ${X.utils.coin(u.ttpx_a)}</span>
              <span class="tag">${u.realname ? '✓ 实名' : '未实名'}</span>
              <span class="tag">加入 ${X.utils.relTime(u.created_at)}</span>
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
          btns.push(X.utils.h('button', { class: 'btn ghost', onclick: async () => { await X.store.removeFriend(cur.id, userId); X.ui.toast(X.t('social.unfriend'), 'ok'); inst.close(); } }, [X.t('social.unfriend')]));
        } else {
          btns.push(X.utils.h('button', { class: 'btn ghost', onclick: async () => {
            const r = await X.store.sendFriendReq(cur.id, cur.username, userId);
            X.ui.toast(r ? X.t('social.friendReq') + ' ✓' : '已申请', r ? 'ok' : 'info');
          } }, [X.t('social.friendReq')]));
        }
        if (blocked) {
          btns.push(X.utils.h('button', { class: 'btn ghost', onclick: async () => { await X.store.unblock(cur.id, userId); X.ui.toast(X.t('social.unblock'), 'ok'); inst.close(); } }, [X.t('social.unblock')]));
        } else {
          btns.push(X.utils.h('button', { class: 'btn danger', onclick: async () => { await X.store.block(cur.id, userId); X.ui.toast(X.t('social.block'), 'ok'); inst.close(); } }, [X.t('social.block')]));
        }
        btns.push(X.utils.h('button', { class: 'btn ghost', onclick: () => { inst.close(); this.openReport('user', userId); } }, [X.t('chat.report')]));
      }
      btns.forEach(b => actBox.appendChild(b));
    },

    /** 私聊弹窗（Realtime 订阅） */
    async openDM(otherId) {
      if (!X.auth.requireLogin()) return;
      if (!X.supabaseReady) { X.ui.toast('Supabase 未配置', 'err'); return; }
      const cur = X.auth.currentUser();
      // 拉黑互检
      const myBlocks = await X.store.getBlocked(cur.id);
      const otherBlocks = await X.store.getBlocked(otherId);
      if (myBlocks.includes(otherId) || otherBlocks.includes(cur.id)) {
        X.ui.toast(X.t('social.block'), 'err'); return;
      }
      const other = await X.store.getUser(otherId);
      if (!other) { X.ui.toast('user not found', 'err'); return; }
      const inst = X.ui.modal({ title: X.t('social.privateChat') + ' · ' + X.utils.escape(other.username), size: 'wide' });
      inst.bodyEl.innerHTML = `
        <div id="dm_body" style="height:50vh;overflow:auto;display:flex;flex-direction:column;gap:8px;padding:4px"><div class="dim center" style="padding:20px">加载中...</div></div>
        <div class="row" style="margin-top:10px">
          <input class="input grow" id="dm_input" placeholder="${X.t('chat.placeholder')}" />
          <button class="btn primary" id="dm_send">${X.t('chat.send')}</button>
        </div>`;

      const pairKey = X.store.dmKey(cur.id, otherId);
      let dmSub = null;

      const render = async () => {
        const box = X.utils.$('#dm_body', inst.modal);
        if (!box) return;
        try {
          const list = await X.store.getDM(cur.id, otherId);
          box.innerHTML = '';
          list.forEach(m => {
            const mine = m.from_id === cur.id;
            const b = X.utils.h('div', { class: 'msg' + (mine ? ' me' : '') });
            const meta = X.utils.h('div', { class: 'meta-col' });
            const name = X.utils.h('div', { class: 'name', style: { fontSize: '11px' } }, [(m.from_name || '?') + ' · ' + X.utils.relTime(m.created_at)]);
            const bubble = X.utils.h('div', { class: 'bubble' + (mine ? ' me' : '') });
            bubble.innerHTML = X.modules.chat.format(m.text || '');
            meta.appendChild(name); meta.appendChild(bubble);
            b.appendChild(meta);
            box.appendChild(b);
          });
          box.scrollTop = box.scrollHeight;
        } catch (e) {
          box.innerHTML = '<div class="dim center">加载失败</div>';
        }
      };

      await render();

      X.utils.$('#dm_send', inst.modal).addEventListener('click', async () => {
        const inp = X.utils.$('#dm_input', inst.modal);
        const text = inp.value.trim();
        if (!text) return;
        const btn = X.utils.$('#dm_send', inst.modal);
        if (btn) btn.disabled = true;
        try {
          await X.store.addDM(cur.id, cur.username, otherId, text);
          inp.value = '';
          // Realtime 会推送；兜底刷新
          if (!dmSub) await render();
        } catch (e) {
          X.ui.toast('发送失败', 'err');
        } finally {
          if (btn) btn.disabled = false;
        }
      });

      // Realtime 订阅私聊新消息
      dmSub = X.realtime.onInsert('dm_messages', { filter: `pair_key=eq.${pairKey}` }, async () => {
        await render();
      });

      // 弹窗关闭时清理订阅
      const origClose = inst.close;
      inst.close = function () {
        if (dmSub) { try { dmSub.unsubscribe(); } catch (e) {} dmSub = null; }
        origClose();
      };
    },

    /** 创建群组（消耗 20 Ttpx_A，上限 20 人） */
    async createGroup() {
      if (!X.auth.requireLogin()) return;
      if (!X.supabaseReady) { X.ui.toast('Supabase 未配置', 'err'); return; }
      const cur = X.auth.currentUser();
      if ((cur.ttpx_a || 0) < 20) { X.ui.toast(X.t('err.insufficientCoin'), 'err'); return; }
      const name = await X.ui.prompt({
        title: X.t('social.createGroup'),
        label: X.t('social.groupName'),
        placeholder: 'Group name',
        validate: v => v ? null : X.t('err.required')
      });
      if (!name) return;
      try {
        await X.store.adjustCoin(cur.id, -20);
        await X.store.createGroup(cur.id, cur.username, name);
        await X.auth.refresh();
        X.ui.toast(X.t('social.createGroup') + ' ✓ -20 Ttpx_A', 'ok');
        X.ui.refresh();
        X.router.go('profile');
      } catch (e) {
        X.ui.toast('创建失败', 'err');
      }
    },

    /** 群聊弹窗（群主/管理员可踢人；Realtime 订阅） */
    async openGroupChat(groupId) {
      if (!X.auth.requireLogin()) return;
      if (!X.supabaseReady) { X.ui.toast('Supabase 未配置', 'err'); return; }
      const cur = X.auth.currentUser();
      const g = await X.store.getGroup(groupId);
      if (!g) { X.ui.toast('group not found', 'err'); return; }
      const members = await X.store.getGroupMembers(groupId);
      const myMember = members.find(m => m.user_id === cur.id);
      const isOwner = g.owner_id === cur.id;
      const isAdmin = isOwner || (myMember && myMember.role === 'admin');
      const inst = X.ui.modal({ title: '👥 ' + X.utils.escape(g.name) + ' (' + members.length + '/20)', size: 'wide' });
      inst.bodyEl.innerHTML = `
        <div id="gp_body" style="height:46vh;overflow:auto;display:flex;flex-direction:column;gap:8px;padding:4px"><div class="dim center" style="padding:20px">加载中...</div></div>
        <div class="row" style="margin-top:10px"><input class="input grow" id="gp_input" placeholder="${X.t('chat.placeholder')}" /><button class="btn primary" id="gp_send">${X.t('chat.send')}</button></div>
        ${isAdmin ? `<div class="hint" style="margin-top:6px">${X.t('nav.admin')}：可踢人/禁言</div>` : ''}`;

      let gpSub = null;

      const render = async () => {
        const box = X.utils.$('#gp_body', inst.modal);
        if (!box) return;
        try {
          const msgs = await X.store.getGroupMessages(groupId);
          const curMembers = await X.store.getGroupMembers(groupId);
          const myM = curMembers.find(m => m.user_id === cur.id);
          const iAmAdmin = g.owner_id === cur.id || (myM && myM.role === 'admin');
          box.innerHTML = '';
          msgs.forEach(m => {
            const avatar = m.avatar || '❓';
            const avatarType = m.avatar_type || 'emoji';
            const mine = m.user_id === cur.id;
            const avHTML = avatarType === 'dataurl' ? `<img class="avatar sm" src="${avatar}" />` : `<div class="avatar sm" style="display:grid;place-items:center;font-size:13px">${avatar}</div>`;
            const row = X.utils.h('div', { class: 'msg' + (mine ? ' me' : '') });
            row.innerHTML = avHTML;
            const meta = X.utils.h('div', { class: 'meta-col' });
            meta.innerHTML = `<div class="name">${X.utils.escape(m.username || '?')} · ${X.utils.relTime(m.created_at)}</div>`;
            const b = X.utils.h('div', { class: 'bubble' + (mine ? ' me' : '') });
            b.innerHTML = X.modules.chat.format(m.text || '');
            meta.appendChild(b);
            row.appendChild(meta);
            if (iAmAdmin && !mine) {
              const menu = X.utils.h('button', { class: 'btn ghost sm', onclick: async () => {
                await X.store.removeGroupMember(groupId, m.user_id);
                await render();
              } }, ['踢出']);
              row.appendChild(menu);
            }
            box.appendChild(row);
          });
          box.scrollTop = box.scrollHeight;
        } catch (e) {
          box.innerHTML = '<div class="dim center">加载失败</div>';
        }
      };

      await render();

      X.utils.$('#gp_send', inst.modal).addEventListener('click', async () => {
        const inp = X.utils.$('#gp_input', inst.modal);
        const text = inp.value.trim();
        if (!text) return;
        const btn = X.utils.$('#gp_send', inst.modal);
        if (btn) btn.disabled = true;
        try {
          await X.store.addGroupMessage(groupId, cur.id, cur.username, cur.avatar, cur.avatar_type, text);
          inp.value = '';
          if (!gpSub) await render();
        } catch (e) {
          X.ui.toast('发送失败', 'err');
        } finally {
          if (btn) btn.disabled = false;
        }
      });

      // Realtime 订阅群组新消息
      gpSub = X.realtime.onInsert('group_messages', { filter: `group_id=eq.${groupId}` }, async () => {
        await render();
      });

      const origClose = inst.close;
      inst.close = function () {
        if (gpSub) { try { gpSub.unsubscribe(); } catch (e) {} gpSub = null; }
        origClose();
      };
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
      try {
        await X.store.addReport({ reporterId: cur.id, targetType, targetId, reason });
        X.ui.toast(X.t('ok.reportSent'), 'ok');
      } catch (e) {
        X.ui.toast('举报失败', 'err');
      }
    }
  };

  X.modules.social = social;
})(window.Xiao = window.Xiao || {});
