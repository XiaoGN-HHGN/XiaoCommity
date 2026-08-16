// ============================================================
// Xiao · 数据访问层（Supabase）
// 全部方法为异步 Promise；通过 X.dbq 统一封装访问 Postgres。
// 表结构见 SETUP.md。所有业务规则不变（代币/封禁/实名/定价/点赞等）。
// 模块按需调用，禁止全量预加载，避免卡顿。
// ============================================================
(function (X) {
  const T = {
    PROFILES: 'profiles',
    MESSAGES: 'messages',         // 公共大厅
    DM: 'dm_messages',            // 私聊
    WORKS: 'works',
    WORK_LIKES: 'work_likes',
    DL_REQS: 'download_requests',
    FREQ: 'friend_requests',
    FRIENDS: 'friendships',
    BLOCKS: 'blocks',
    GROUPS: 'groups',
    GMEMBERS: 'group_members',
    GMSGS: 'group_messages',
    REPORTS: 'reports',
    LOGS: 'admin_logs'
  };

  const store = {
    T,

    // ===== 用户 profiles =====
    async getUsers() { return X.dbq.select(T.PROFILES, { order: ['created_at', { ascending: true }] }); },
    async getUser(id) { return X.dbq.select(T.PROFILES, { eq: ['id', id], single: true }); },
    async getUserByName(name) { return X.dbq.select(T.PROFILES, { eq: ['username', name], single: true }); },
    async saveUser(user) {
      // 仅更新可写字段（id 由 auth 决定）
      return X.dbq.upsert(T.PROFILES, user, { conflict: 'id' });
    },
    async updateProfile(id, patch) { return X.dbq.update(T.PROFILES, patch, { eq: ['id', id] }); },

    /**
     * 创建用户 profile（注册流程：先由 auth.js 创建 Supabase Auth 账号，再写 profile）
     * 新用户初始 ttpx_a = 10
     */
    async createProfile({ id, username, phone, avatar, avatarType }) {
      const row = {
        id, username, phone,
        avatar: avatar || X.utils.randAvatar(),
        avatar_type: avatarType || 'emoji',
        ttpx_a: 10,
        role: 'user',
        realname: false,
        realname_info: null,
        bio: '',
        banned: null,
        muted: null,
        created_at: new Date().toISOString()
      };
      return X.dbq.insert(T.PROFILES, row);
    },

    /** 调整代币：正增负减；通过 RPC adjust_coin（负值仅管理员可调） */
    async adjustCoin(userId, delta) {
      try { return await X.dbq.rpc('adjust_coin', { target: userId, delta: Number(delta) }); }
      catch (e) { console.warn('adjust_coin rpc fail', e); return null; }
    },

    // ===== 公共大厅消息 =====
    async getChat(limit = 100) {
      return X.dbq.select(T.MESSAGES, { order: ['created_at', { ascending: true }], limit });
    },
    async addMessage({ userId, username, avatar, avatarType, text }) {
      return X.dbq.insert(T.MESSAGES, {
        user_id: userId, username, avatar, avatar_type: avatarType,
        text, created_at: new Date().toISOString()
      });
    },

    // ===== 私聊 =====
    dmKey(a, b) { return [a, b].sort().join('__'); },
    async getDM(userA, userB) {
      const key = this.dmKey(userA, userB);
      return X.dbq.select(T.DM, { eq: ['pair_key', key], order: ['created_at', { ascending: true }], limit: 200 });
    },
    async addDM(from, fromName, to, text) {
      return X.dbq.insert(T.DM, {
        pair_key: this.dmKey(from, to), from_id: from, to_id: to,
        from_name: fromName, text, created_at: new Date().toISOString()
      });
    },

    // ===== 作品 =====
    async getWorks() { return X.dbq.select(T.WORKS, { order: ['created_at', { ascending: false }] }); },
    async getWork(id) { return X.dbq.select(T.WORKS, { eq: ['id', id], single: true }); },
    async getWorksByUser(userId) { return X.dbq.select(T.WORKS, { eq: ['author_id', userId], order: ['created_at', { ascending: false }] }); },
    async saveWork(work) { return X.dbq.update(T.WORKS, work, { eq: ['id', work.id] }); },
    async createWork({ authorId, name, desc, category, price, fileName, filePath, fileType }) {
      return X.dbq.insert(T.WORKS, {
        author_id: authorId, name, desc, category,
        price: Number(price) || 0,
        file_name: fileName, file_path: filePath, file_type: fileType,
        status: 'pending', likes: 0, created_at: new Date().toISOString()
      });
    },
    /** 点赞：免费；新增点赞作者 +0.01 Ttpx_A（通过 RPC adjust_coin） */
    async toggleLike(workId, userId) {
      const existing = await X.dbq.select(T.WORK_LIKES, { filter: { work_id: workId, user_id: userId } });
      const work = await this.getWork(workId);
      if (!work) return null;
      if (existing.length) {
        await X.dbq.remove(T.WORK_LIKES, { filter: { work_id: workId, user_id: userId } });
        await X.dbq.update(T.WORKS, { likes: Math.max(0, (work.likes || 0) - 1) }, { eq: ['id', workId] });
        return { liked: false, likes: Math.max(0, (work.likes || 0) - 1) };
      }
      await X.dbq.insert(T.WORK_LIKES, { work_id: workId, user_id: userId, created_at: new Date().toISOString() });
      await X.dbq.update(T.WORKS, { likes: (work.likes || 0) + 1 }, { eq: ['id', workId] });
      await this.adjustCoin(work.author_id, 0.01);
      return { liked: true, likes: (work.likes || 0) + 1 };
    },
    /** 是否已点赞（批量加载作品时用） */
    async getMyLike(workId, userId) {
      const r = await X.dbq.select(T.WORK_LIKES, { filter: { work_id: workId, user_id: userId } });
      return r.length > 0;
    },

    // ===== 下载申请 =====
    async getDownloadReq(workId, userId) {
      const r = await X.dbq.select(T.DL_REQS, { filter: { work_id: workId, user_id: userId } });
      return r[0] || null;
    },
    async addDownloadReq(workId, userId) {
      return X.dbq.insert(T.DL_REQS, { work_id: workId, user_id: userId, status: 'pending', created_at: new Date().toISOString() });
    },
    async setDownloadReq(workId, userId, status) {
      await X.dbq.update(T.DL_REQS, { status }, { filter: { work_id: workId, user_id: userId } });
    },
    async getDownloadReqsForAuthor(authorId) {
      // 作者视角：拿到自己作品的下载申请（需联表，这里先用两步）
      const works = await this.getWorksByUser(authorId);
      const ids = works.map(w => w.id);
      if (!ids.length) return [];
      // 一次取全部申请，再在客户端过滤
      const all = await X.dbq.select(T.DL_REQS, { filter: {} });
      return all.filter(r => ids.includes(r.work_id));
    },

    // ===== 好友 =====
    async getFriends(userId) {
      const rows = await X.dbq.select(T.FRIENDS, { eq: ['user_id', userId] });
      return rows.map(r => r.friend_id);
    },
    async getFriendReqs(userId) {
      return X.dbq.select(T.FREQ, { eq: ['to_id', userId], order: ['created_at', { ascending: false }] });
    },
    async sendFriendReq(fromId, fromName, toId) {
      const exist = await X.dbq.select(T.FREQ, { filter: { from_id: fromId, to_id: toId, status: 'pending' } });
      if (exist.length) return false;
      await X.dbq.insert(T.FREQ, { from_id: fromId, from_name: fromName, to_id: toId, status: 'pending', created_at: new Date().toISOString() });
      return true;
    },
    async resolveFriendReq(reqId, toId, accept) {
      const reqs = await X.dbq.select(T.FREQ, { eq: ['id', reqId] });
      const r = reqs[0]; if (!r) return false;
      await X.dbq.update(T.FREQ, { status: accept ? 'accepted' : 'rejected' }, { eq: ['id', reqId] });
      if (accept) {
        await X.dbq.upsert(T.FRIENDS, { user_id: r.from_id, friend_id: r.to_id, created_at: new Date().toISOString() }, { conflict: 'user_id,friend_id' });
        await X.dbq.upsert(T.FRIENDS, { user_id: r.to_id, friend_id: r.from_id, created_at: new Date().toISOString() }, { conflict: 'user_id,friend_id' });
      }
      return true;
    },
    async removeFriend(userId, otherId) {
      await X.dbq.remove(T.FRIENDS, { filter: { user_id: userId, friend_id: otherId } });
      await X.dbq.remove(T.FRIENDS, { filter: { user_id: otherId, friend_id: userId } });
    },

    // ===== 拉黑 =====
    async getBlocked(userId) {
      const rows = await X.dbq.select(T.BLOCKS, { eq: ['user_id', userId] });
      return rows.map(r => r.blocked_id);
    },
    async block(userId, otherId) {
      await X.dbq.upsert(T.BLOCKS, { user_id: userId, blocked_id: otherId, created_at: new Date().toISOString() }, { conflict: 'user_id,blocked_id' });
    },
    async unblock(userId, otherId) {
      await X.dbq.remove(T.BLOCKS, { filter: { user_id: userId, blocked_id: otherId } });
    },

    // ===== 群组（创建消耗 20 Ttpx_A，上限 20 人） =====
    async getGroups() { return X.dbq.select(T.GROUPS, { order: ['created_at', { ascending: false }] }); },
    async getGroup(id) { return X.dbq.select(T.GROUPS, { eq: ['id', id], single: true }); },
    async getGroupsByUser(userId) {
      const members = await X.dbq.select(T.GMEMBERS, { eq: ['user_id', userId] });
      const ids = members.map(m => m.group_id);
      if (!ids.length) return [];
      const all = await this.getGroups();
      return all.filter(g => ids.includes(g.id));
    },
    async createGroup(ownerId, ownerName, name) {
      const g = await X.dbq.insert(T.GROUPS, { owner_id: ownerId, name, created_at: new Date().toISOString() });
      await X.dbq.insert(T.GMEMBERS, { group_id: g.id, user_id: ownerId, member_name: ownerName, role: 'admin', created_at: new Date().toISOString() });
      return g;
    },
    async getGroupMembers(groupId) { return X.dbq.select(T.GMEMBERS, { eq: ['group_id', groupId] }); },
    async addGroupMember(groupId, userId, name) {
      const members = await this.getGroupMembers(groupId);
      if (members.length >= 20 || members.find(m => m.user_id === userId)) return false;
      await X.dbq.insert(T.GMEMBERS, { group_id: groupId, user_id: userId, member_name: name, role: 'member', created_at: new Date().toISOString() });
      return true;
    },
    async removeGroupMember(groupId, userId) {
      await X.dbq.remove(T.GMEMBERS, { filter: { group_id: groupId, user_id: userId } });
    },
    async getGroupMessages(groupId) {
      return X.dbq.select(T.GMSGS, { eq: ['group_id', groupId], order: ['created_at', { ascending: true }], limit: 200 });
    },
    async addGroupMessage(groupId, userId, username, avatar, avatarType, text) {
      return X.dbq.insert(T.GMSGS, {
        group_id: groupId, user_id: userId, username, avatar, avatar_type: avatarType,
        text, created_at: new Date().toISOString()
      });
    },

    // ===== 举报 =====
    async getReports() { return X.dbq.select(T.REPORTS, { order: ['created_at', { ascending: false }] }); },
    async addReport({ reporterId, targetType, targetId, reason }) {
      return X.dbq.insert(T.REPORTS, {
        reporter_id: reporterId, target_type: targetType, target_id: targetId, reason,
        status: 'pending', created_at: new Date().toISOString()
      });
    },
    async resolveReport(id, action, note) {
      await X.dbq.update(T.REPORTS, { status: 'resolved', action, note, resolved_at: new Date().toISOString() }, { eq: ['id', id] });
    },

    // ===== 管理员操作记录 =====
    async getLogs(limit = 200) { return X.dbq.select(T.LOGS, { order: ['created_at', { ascending: false }], limit }); },
    async addLog({ operatorId, action, targetUserId, reason, meta }) {
      return X.dbq.insert(T.LOGS, {
        operator_id: operatorId, action, target_user_id: targetUserId, reason,
        meta: meta || null, created_at: new Date().toISOString()
      });
    }
  };

  X.store = store;
})(window.Xiao = window.Xiao || {});
