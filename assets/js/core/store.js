// ============================================================
// Xiao · 数据访问层（Supabase）
// 【适配用户自建 SQL 结构】—— 表名/列名全部映射到你自己的 SQL：
//   profiles           → profiles          (列：balance↔ttpx_a, is_admin↔role, avatar_url↔avatar …)
//   public_chat        ← messages          (列：sender_id↔user_id, content↔text)
//   private_chat_msg   ← dm_messages       (无 pair_key，from_id/to_id + or 查询)
//   works              → works             (title↔name, description↔desc, file_url↔file_path, is_checked↔status)
//   work_like          ← work_likes
//   work_download_auth ← download_requests (allow boolean ↔ status string)
//   friend_relation    ← friend_requests/friendships/blocks 三表合一，靠 status 区分
//   chat_group         ← groups
//   group_member       ← group_members
//   group_msg          ← group_messages
//   reports            → reports           (handle_status ↔ status)
//   admin_logs         ← 用户未建，降级为不写 / reports 占位
// 所有业务规则不变（代币/封禁/实名/定价/点赞 +0.01/20人上限…）；RLS / 列不存在的错误全部静默返回空。
// ============================================================
(function (X) {
  // ------ 表名常量：全部映射为你自己的 SQL 表名 ------
  const T = {
    PROFILES: 'profiles',
    MESSAGES: 'public_chat',        // 公共大厅
    DM: 'private_chat_msg',         // 私聊（无 pair_key）
    WORKS: 'works',
    WORK_LIKES: 'work_like',
    DL_REQS: 'work_download_auth',
    // 以下三张表合并到 friend_relation：status=pending(好友请求) / friend(已好友) / blocked(拉黑)
    FREQ: 'friend_relation',
    FRIENDS: 'friend_relation',
    BLOCKS: 'friend_relation',
    GROUPS: 'chat_group',
    GMEMBERS: 'group_member',
    GMSGS: 'group_msg',
    REPORTS: 'reports'
    // admin_logs 用户未建，不写进 T，读写直接走降级分支
  };
  // friend_relation 各语义对应的 status 值（要和你实际写进数据库的一致）
  const FR_STATUS = {
    PENDING: 'pending',
    FRIEND:  'friend',
    BLOCKED: 'blocked',
    REJECTED:'rejected'
  };

  // ============================================================
  // 列名转换：把"你自己的 SQL 列" ↔ "前端代码里约定的列"互转
  // 前端永远只认 SETUP.md 里约定的字段名，转换在这一层做。
  // ============================================================
  const _j = (s, d) => { try { return JSON.parse(s); } catch (_) { return d; } };

  /** [DB → 前端] profiles 行转换。传入 null/undefined 安全。 */
  function _profileIn(db) {
    if (!db) return null;
    // 前端列 ← 你自己的 SQL 列
    return Object.assign({}, db, {
      avatar:       db.avatar || db.avatar_url || X.utils.randAvatar(),
      avatar_type:  db.avatar_type || 'emoji',
      // 你自己的 SQL：balance 列；SETUP.md：ttpx_a 列。前端只读 ttpx_a。
      ttpx_a:       typeof db.ttpx_a === 'number' ? db.ttpx_a : (Number(db.balance) || 0),
      // 你自己的 SQL：is_admin boolean；SETUP.md：role 字符串。兼容两者。
      role:         db.role || (db.is_admin ? 'admin' : 'user'),
      // 你自己的 SQL：is_banned(boolean) + ban_end_time → SETUP.md：banned(JSON {perm, until})
      banned:       db.banned != null ? db.banned : (
        db.is_banned ? JSON.stringify({ perm: !db.ban_end_time, until: db.ban_end_time ? new Date(db.ban_end_time).getTime() : null }) : null
      ),
      // muted 同理
      muted:        db.muted != null ? db.muted : (
        db.is_muted ? JSON.stringify({ perm: true }) : null
      ),
      // 实名
      realname:     typeof db.realname === 'boolean' ? db.realname : (db.real_auth === true),
      realname_info:db.realname_info || null,
      bio:          db.bio || ''
    });
  }

  /** [前端 → DB] profiles patch 反转换，只保留你表里存在的列。用在 upsert/update 写入。 */
  function _profileOut(fe) {
    if (!fe) return {};
    const patch = {};
    // id / username / phone / created_at 直接透传
    for (const k of ['id','username','phone','created_at','bio','avatar_type','realname_info']) if (fe[k] !== undefined) patch[k] = fe[k];
    if (fe.avatar !== undefined) patch.avatar_url = fe.avatar;
    if (fe.avatar_url !== undefined) patch.avatar_url = fe.avatar_url;
    // 余额：写 balance（你表的列），兼容前端也可能写 ttpx_a
    if (typeof fe.balance === 'number') patch.balance = fe.balance;
    else if (typeof fe.ttpx_a === 'number') patch.balance = fe.ttpx_a;
    // 角色：写 is_admin（你表的列）。如果前端写了 role，转成 boolean。
    if (typeof fe.is_admin === 'boolean') patch.is_admin = fe.is_admin;
    else if (typeof fe.role === 'string') patch.is_admin = (fe.role === 'admin' || fe.role === 'super');
    // 封禁：如果前端写 banned JSON → 拆成 is_banned + ban_end_time
    if (fe.banned !== undefined) {
      const b = typeof fe.banned === 'string' ? _j(fe.banned, null) : fe.banned;
      if (!b) { patch.is_banned = false; patch.ban_end_time = null; }
      else {
        patch.is_banned = true;
        patch.ban_end_time = b.until ? new Date(b.until).toISOString() : null;
      }
    } else if (fe.is_banned !== undefined) {
      patch.is_banned = fe.is_banned;
      if (fe.ban_end_time !== undefined) patch.ban_end_time = fe.ban_end_time;
    }
    // 禁言
    if (fe.muted !== undefined) {
      const m = typeof fe.muted === 'string' ? _j(fe.muted, null) : fe.muted;
      patch.is_muted = !!m;
    } else if (fe.is_muted !== undefined) {
      patch.is_muted = fe.is_muted;
    }
    // 实名
    if (typeof fe.realname === 'boolean') patch.real_auth = fe.realname;
    else if (typeof fe.real_auth === 'boolean') patch.real_auth = fe.real_auth;
    return patch;
  }

  /** [DB → 前端] 大厅消息 public_chat → messages */
  function _msgIn(db) {
    if (!db) return null;
    return Object.assign({}, db, {
      user_id: db.user_id || db.sender_id,
      username: db.username || '',
      avatar: db.avatar || '',
      avatar_type: db.avatar_type || 'emoji',
      text: db.text || db.content || '',
      emojis: db.emojis || []
    });
  }

  /** [前端 → DB] 大厅消息写入 public_chat */
  function _msgOut(fe) {
    return {
      sender_id: fe.user_id || fe.sender_id,
      content:   fe.text || fe.content || '',
      emojis:    fe.emojis || [],
      created_at: fe.created_at || new Date().toISOString()
    };
  }

  /** [DB → 前端] 私聊 private_chat_msg → dm_messages */
  function _dmIn(db) {
    if (!db) return null;
    return Object.assign({}, db, {
      pair_key: [db.from_id, db.to_id].sort().join('__'),
      from_id: db.from_id,
      to_id: db.to_id,
      from_name: db.from_name || '',
      text: db.text || db.content || ''
    });
  }

  /** [前端 → DB] 私聊写入 private_chat_msg（没有 pair_key 列） */
  function _dmOut(fe) {
    return {
      from_id: fe.from_id,
      to_id: fe.to_id,
      content: fe.text || fe.content || '',
      created_at: fe.created_at || new Date().toISOString()
    };
  }

  /** [DB → 前端] 作品 works → works */
  function _workIn(db) {
    if (!db) return null;
    return Object.assign({}, db, {
      author_id: db.author_id,
      name: db.name || db.title || '',
      desc: db.desc || db.description || '',
      category: db.category || '',
      price: Number(db.price) || 0,
      file_name: db.file_name || (db.file_url ? db.file_url.split('/').pop() : ''),
      file_path: db.file_path || db.file_url || '',
      file_type: db.file_type || '',
      status: db.status || (db.is_checked ? 'approved' : 'pending'),
      likes: Number(db.likes) || 0,
      need_auth: db.need_auth === true,
      created_at: db.created_at
    });
  }

  /** [前端 → DB] 作品写入 works（对应你表的列） */
  function _workOut(fe) {
    return {
      author_id:   fe.author_id,
      title:       fe.title || fe.name || '',
      description: fe.description || fe.desc || '',
      category:    fe.category || '',
      price:       Number(fe.price) || 0,
      file_url:    fe.file_path || fe.file_url || '',
      need_auth:   fe.need_auth === true,
      is_checked:  (fe.status === 'approved') ? true : (typeof fe.is_checked === 'boolean' ? fe.is_checked : false),
      likes:       Number(fe.likes) || 0,
      created_at:  fe.created_at || new Date().toISOString()
    };
  }

  /** [DB → 前端] 下载申请 work_download_auth → download_requests */
  function _dlIn(db) {
    if (!db) return null;
    return Object.assign({}, db, {
      work_id: db.work_id,
      user_id: db.user_id,
      status: db.status || (db.allow === true ? 'approved' : 'pending'),
      created_at: db.created_at
    });
  }

  /** [前端 → DB] 下载申请写入 work_download_auth */
  function _dlOut(fe) {
    return {
      work_id: fe.work_id,
      user_id: fe.user_id,
      allow:   fe.status === 'approved' ? true : (typeof fe.allow === 'boolean' ? fe.allow : false),
      created_at: fe.created_at || new Date().toISOString()
    };
  }

  /** [DB → 前端] 群组 chat_group → groups */
  function _groupIn(db) {
    if (!db) return null;
    return Object.assign({}, db, {
      id: db.id,
      owner_id: db.owner_id,
      name: db.name || db.group_name || '',
      max_members: db.max_members || db.max_member || 20,
      created_at: db.created_at
    });
  }

  /** [前端 → DB] 群组写入 chat_group */
  function _groupOut(fe) {
    return {
      owner_id: fe.owner_id,
      group_name: fe.group_name || fe.name || '',
      max_member: fe.max_member || fe.max_members || 20,
      created_at: fe.created_at || new Date().toISOString()
    };
  }

  /** [DB → 前端] 群成员 group_member → group_members */
  function _gmemIn(db) {
    if (!db) return null;
    return Object.assign({}, db, {
      group_id: db.group_id,
      user_id: db.user_id,
      member_name: db.member_name || '用户' + (db.user_id ? String(db.user_id).slice(0,6) : ''),
      role: db.role || (db.is_group_admin ? 'admin' : 'member'),
      status: db.status || 'joined',
      created_at: db.created_at
    });
  }

  /** [前端 → DB] 群成员写入 group_member（你表里缺 member_name，不写） */
  function _gmemOut(fe) {
    return {
      group_id: fe.group_id,
      user_id: fe.user_id,
      is_group_admin: (fe.role === 'admin') ? true : (fe.is_group_admin === true),
      status: fe.status || 'joined',
      created_at: fe.created_at || new Date().toISOString()
    };
  }

  /** [DB → 前端] 群消息 group_msg → group_messages */
  function _gmsgIn(db) {
    if (!db) return null;
    return Object.assign({}, db, {
      group_id: db.group_id,
      user_id: db.user_id || db.sender_id,
      username: db.username || '',
      avatar: db.avatar || '',
      avatar_type: db.avatar_type || 'emoji',
      text: db.text || db.content || ''
    });
  }

  /** [前端 → DB] 群消息写入 group_msg（你表里没有 username/avatar 列，跳过） */
  function _gmsgOut(fe) {
    return {
      group_id: fe.group_id,
      sender_id: fe.user_id || fe.sender_id,
      content: fe.text || fe.content || '',
      created_at: fe.created_at || new Date().toISOString()
    };
  }

  /** [DB → 前端] 举报 reports → reports（你表的列叫 handle_status，前端要 status） */
  function _repIn(db) {
    if (!db) return null;
    return Object.assign({}, db, {
      reporter_id: db.reporter_id,
      target_type: db.target_type,
      target_id: String(db.target_id || ''),
      reason: db.reason || '',
      status: db.status || db.handle_status || 'pending',
      action: db.action || '',
      note: db.note || '',
      resolved_at: db.resolved_at || null,
      created_at: db.created_at
    });
  }

  /** [前端 → DB] 举报写入 reports */
  function _repOut(fe) {
    return {
      reporter_id: fe.reporter_id,
      target_type: fe.target_type || '',
      target_id:   fe.target_id ? String(fe.target_id) : null,
      reason:      fe.reason || '',
      handle_status: fe.status || fe.handle_status || 'pending',
      action:      fe.action || '',
      note:        fe.note || '',
      resolved_at: fe.resolved_at || null,
      created_at:  fe.created_at || new Date().toISOString()
    };
  }

  const store = {
    T,

    // ===== 用户 profiles =====
    async getUsers() {
      try {
        const rows = await X.dbq.select(T.PROFILES, { order: ['created_at', { ascending: true }] });
        return (rows || []).map(_profileIn);
      } catch (_) { return []; }
    },
    async getUser(id) {
      if (!id) return null;
      try {
        const r = await X.dbq.select(T.PROFILES, { eq: ['id', id], single: true });
        return _profileIn(r);
      } catch (_) { return null; }
    },
    async getUserByName(name) {
      if (!name) return null;
      try {
        const r = await X.dbq.select(T.PROFILES, { eq: ['username', name], single: true });
        return _profileIn(r);
      } catch (_) { return null; }
    },
    async saveUser(user) {
      if (!user || !user.id) return null;
      const patch = _profileOut(user);
      return X.dbq.upsert(T.PROFILES, patch, { conflict: 'id' }).then(r => _profileIn(r));
    },
    async updateProfile(id, patch) {
      if (!id) return [];
      return X.dbq.update(T.PROFILES, _profileOut(patch), { eq: ['id', id] });
    },

    /**
     * 创建用户 profile（注册流程：auth 建完账号后调用）
     * 【10 代币规则】：新用户 balance=10.00（你表的列），前端显示会映射为 ttpx_a
     */
    async createProfile({ id, username, phone, avatar, avatarType }) {
      if (!id) return null;
      const row = _profileOut({
        id, username, phone,
        avatar: avatar || X.utils.randAvatar(),
        avatarType: avatarType || 'emoji',
        balance: 10.00,
        role: 'user',
        realname: false,
        bio: ''
      });
      const r = await X.dbq.insert(T.PROFILES, row);
      return _profileIn(r);
    },

    /**
     * 调整代币：正增负减。
     * 【兼容 fallback】：你没建 adjust_coin RPC 时，直接 UPDATE profiles.balance。
     * 两种方式都走不通时返回 null（页面静默降级）。
     */
    async adjustCoin(userId, delta) {
      if (!userId) return null;
      const d = Number(delta) || 0;
      if (!d) return null;
      // 方式 1：走 RPC（如果有）
      try {
        const r = await X.dbq.rpc('adjust_coin', { target: userId, delta: d });
        if (r != null) return r;
      } catch (_) {}
      // 方式 2：直接 UPDATE 你自己的 profiles.balance 列
      try {
        // 先读当前余额再加（避免 "column does not exist" 报错时静默）
        const u = await X.dbq.select(T.PROFILES, { eq: ['id', userId], single: true });
        if (!u) return null;
        const cur = Number(u.balance) || Number(u.ttpx_a) || 0;
        const next = +(cur + d).toFixed(2);
        // 写你自己表的列（balance），同时保持 SETUP.md 列（ttpx_a）以防万一
        const patch = {};
        if ('balance' in u) patch.balance = next;
        if ('ttpx_a' in u) patch.ttpx_a = next;
        await X.dbq.update(T.PROFILES, patch, { eq: ['id', userId] });
        return next;
      } catch (e) {
        console.warn('adjustCoin fallback fail', e);
        return null;
      }
    },

    // ===== 公共大厅消息 public_chat =====
    async getChat(limit = 100) {
      try {
        const rows = await X.dbq.select(T.MESSAGES, { order: ['created_at', { ascending: true }], limit });
        return (rows || []).map(_msgIn);
      } catch (_) { return []; }
    },
    async addMessage({ userId, username, avatar, avatarType, text }) {
      return _msgIn(await X.dbq.insert(T.MESSAGES, _msgOut({
        user_id: userId, username, avatar, avatar_type: avatarType, text
      })));
    },

    // ===== 私聊 private_chat_msg（无 pair_key，用 from/to 双向查询） =====
    dmKey(a, b) { return [a, b].sort().join('__'); },
    async getDM(userA, userB) {
      try {
        // Supabase-js v2 提供 .or()，绕过 dbq 封装
        if (!X.db) return [];
        const { data, error } = await X.db
          .from(T.DM)
          .select('*')
          .or(`and(from_id.eq.${userA},to_id.eq.${userB}),and(from_id.eq.${userB},to_id.eq.${userA})`)
          .order('created_at', { ascending: true })
          .limit(200);
        if (error) return [];
        return (data || []).map(_dmIn);
      } catch (_) { return []; }
    },
    async addDM(from, fromName, to, text) {
      const r = await X.dbq.insert(T.DM, _dmOut({ from_id: from, from_name: fromName, to_id: to, text }));
      return _dmIn(r);
    },

    // ===== 作品 works =====
    async getWorks() {
      try {
        const rows = await X.dbq.select(T.WORKS, { order: ['created_at', { ascending: false }] });
        return (rows || []).map(_workIn);
      } catch (_) { return []; }
    },
    async getWork(id) {
      try {
        const r = await X.dbq.select(T.WORKS, { eq: ['id', id], single: true });
        return _workIn(r);
      } catch (_) { return null; }
    },
    async getWorksByUser(userId) {
      try {
        const rows = await X.dbq.select(T.WORKS, { eq: ['author_id', userId], order: ['created_at', { ascending: false }] });
        return (rows || []).map(_workIn);
      } catch (_) { return []; }
    },
    async saveWork(work) {
      if (!work || !work.id) return null;
      const r = await X.dbq.update(T.WORKS, _workOut(work), { eq: ['id', work.id] });
      return r;
    },
    async createWork({ authorId, name, desc, category, price, fileName, filePath, fileType }) {
      const fe = {
        author_id: authorId, name, desc, category, price,
        file_name: fileName, file_path: filePath, file_type: fileType
      };
      const r = await X.dbq.insert(T.WORKS, _workOut(fe));
      return _workIn(r);
    },
    /** 点赞：新增点赞 → 作者 +0.01 Ttpx_A（balance） */
    async toggleLike(workId, userId) {
      try {
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
      } catch (e) {
        console.warn('toggleLike fail', e);
        return null;
      }
    },
    async getMyLike(workId, userId) {
      try {
        const r = await X.dbq.select(T.WORK_LIKES, { filter: { work_id: workId, user_id: userId } });
        return (r && r.length) > 0;
      } catch (_) { return false; }
    },

    // ===== 下载申请 work_download_auth =====
    async getDownloadReq(workId, userId) {
      try {
        const r = await X.dbq.select(T.DL_REQS, { filter: { work_id: workId, user_id: userId } });
        return (r && r[0]) ? _dlIn(r[0]) : null;
      } catch (_) { return null; }
    },
    async addDownloadReq(workId, userId) {
      const r = await X.dbq.insert(T.DL_REQS, _dlOut({ work_id: workId, user_id: userId, status: 'pending' }));
      return _dlIn(r);
    },
    async setDownloadReq(workId, userId, status) {
      const allow = status === 'approved';
      // 你表的列：allow boolean
      await X.dbq.update(T.DL_REQS, { allow }, { filter: { work_id: workId, user_id: userId } });
    },
    async getDownloadReqsForAuthor(authorId) {
      try {
        const works = await this.getWorksByUser(authorId);
        const ids = works.map(w => w.id);
        if (!ids.length) return [];
        const all = await X.dbq.select(T.DL_REQS, { filter: {} });
        return (all || []).filter(r => ids.includes(r.work_id)).map(_dlIn);
      } catch (_) { return []; }
    },

    // ===== 好友 / 请求 / 拉黑：全走 friend_relation + status 过滤 =====
    async getFriends(userId) {
      try {
        const rows = await X.dbq.select(T.FRIENDS, { filter: { user_id: userId, status: FR_STATUS.FRIEND } });
        return (rows || []).map(r => r.target_id).filter(Boolean);
      } catch (_) { return []; }
    },
    async getFriendReqs(userId) {
      try {
        // 入站请求：to_id 不存在，但 friend_relation 里有 user_id(发起方)/target_id(接收方)
        // 所以 status=pending 且 target_id=userId → 我收到的请求
        const rows = await X.dbq.select(T.FREQ, { filter: { target_id: userId, status: FR_STATUS.PENDING } });
        // 前端 expect: from_id, from_name, to_id, status, created_at, id
        return (rows || []).map(r => ({
          id: r.id,
          from_id: r.user_id,
          from_name: r.from_name || '用户' + (r.user_id ? String(r.user_id).slice(0,6) : ''),
          to_id: r.target_id,
          status: r.status,
          created_at: r.created_at
        }));
      } catch (_) { return []; }
    },
    async sendFriendReq(fromId, fromName, toId) {
      try {
        const exist = await X.dbq.select(T.FREQ, { filter: { user_id: fromId, target_id: toId, status: FR_STATUS.PENDING } });
        if (exist.length) return false;
        // 你自己的 friend_relation 表只有 id/user_id/target_id/status/created_at，没有 from_name
        const row = {
          user_id: fromId, target_id: toId,
          status: FR_STATUS.PENDING, created_at: new Date().toISOString()
        };
        // 先尝试标准字段；如果列不存在，insert 会被静默吞（dbq 的 42703 不在 silentCode 里 → 走 warn，但 return false 不抛）
        const r = await X.dbq.insert(T.FREQ, row);
        // 插入失败的兜底：再试一次带上 from_name（如果未来你加了这个列）
        if (!r) {
          try {
            if (!X.db) return false;
            const { error } = await X.db.from(T.FREQ).insert({
              user_id: fromId, target_id: toId,
              status: FR_STATUS.PENDING, created_at: new Date().toISOString()
            });
            return !error;
          } catch (_) { return false; }
        }
        return true;
      } catch (_) { return false; }
    },
    async resolveFriendReq(reqId, toId, accept) {
      try {
        const reqs = await X.dbq.select(T.FREQ, { eq: ['id', reqId] });
        const r = reqs[0]; if (!r) return false;
        // accepted：把当前这行改成 status=friend，并插入反向行（对称好友关系）
        await X.dbq.update(T.FREQ, { status: accept ? FR_STATUS.FRIEND : FR_STATUS.REJECTED }, { eq: ['id', reqId] });
        if (accept) {
          await X.dbq.upsert(T.FRIENDS, {
            user_id: r.user_id, target_id: r.target_id, status: FR_STATUS.FRIEND, created_at: new Date().toISOString()
          }, { conflict: 'user_id,target_id' });
          // 反向好友行
          await X.dbq.insert(T.FRIENDS, {
            user_id: r.target_id, target_id: r.user_id, status: FR_STATUS.FRIEND, created_at: new Date().toISOString()
          }).catch(_ => {}); // 唯一键冲突静默
        }
        return true;
      } catch (e) { console.warn('resolveFriendReq fail', e); return false; }
    },
    async removeFriend(userId, otherId) {
      try {
        // 删除两行对称记录
        await X.dbq.remove(T.FRIENDS, { filter: { user_id: userId, target_id: otherId, status: FR_STATUS.FRIEND } });
        await X.dbq.remove(T.FRIENDS, { filter: { user_id: otherId, target_id: userId, status: FR_STATUS.FRIEND } });
      } catch (_) {}
    },

    // ===== 拉黑 friend_relation status=blocked =====
    async getBlocked(userId) {
      try {
        const rows = await X.dbq.select(T.BLOCKS, { filter: { user_id: userId, status: FR_STATUS.BLOCKED } });
        return (rows || []).map(r => r.target_id).filter(Boolean);
      } catch (_) { return []; }
    },
    async block(userId, otherId) {
      try {
        await X.dbq.upsert(T.BLOCKS, {
          user_id: userId, target_id: otherId, status: FR_STATUS.BLOCKED, created_at: new Date().toISOString()
        }, { conflict: 'user_id,target_id' });
      } catch (_) {}
    },
    async unblock(userId, otherId) {
      try {
        await X.dbq.remove(T.BLOCKS, { filter: { user_id: userId, target_id: otherId, status: FR_STATUS.BLOCKED } });
      } catch (_) {}
    },

    // ===== 群组 chat_group + group_member + group_msg（20 人上限） =====
    async getGroups() {
      try {
        const rows = await X.dbq.select(T.GROUPS, { order: ['created_at', { ascending: false }] });
        return (rows || []).map(_groupIn);
      } catch (_) { return []; }
    },
    async getGroup(id) {
      try {
        const r = await X.dbq.select(T.GROUPS, { eq: ['id', id], single: true });
        return _groupIn(r);
      } catch (_) { return null; }
    },
    async getGroupsByUser(userId) {
      try {
        const members = await X.dbq.select(T.GMEMBERS, { eq: ['user_id', userId] });
        const ids = (members || []).map(m => m.group_id).filter(Boolean);
        if (!ids.length) return [];
        const all = await this.getGroups();
        return all.filter(g => ids.includes(g.id));
      } catch (_) { return []; }
    },
    async createGroup(ownerId, ownerName, name) {
      try {
        const g = await X.dbq.insert(T.GROUPS, _groupOut({ owner_id: ownerId, name }));
        if (!g) return null;
        await X.dbq.insert(T.GMEMBERS, _gmemOut({
          group_id: g.id, user_id: ownerId, member_name: ownerName, role: 'admin', status: 'joined'
        }));
        return _groupIn(g);
      } catch (e) { console.warn('createGroup fail', e); return null; }
    },
    async getGroupMembers(groupId) {
      try {
        const rows = await X.dbq.select(T.GMEMBERS, { eq: ['group_id', groupId] });
        return (rows || []).map(_gmemIn);
      } catch (_) { return []; }
    },
    async addGroupMember(groupId, userId, name) {
      try {
        const members = await this.getGroupMembers(groupId);
        if (members.length >= 20) return false;
        if (members.find(m => m.user_id === userId)) return false;
        await X.dbq.insert(T.GMEMBERS, _gmemOut({
          group_id: groupId, user_id: userId, member_name: name, role: 'member', status: 'joined'
        }));
        return true;
      } catch (_) { return false; }
    },
    async removeGroupMember(groupId, userId) {
      try {
        await X.dbq.remove(T.GMEMBERS, { filter: { group_id: groupId, user_id: userId } });
      } catch (_) {}
    },
    async getGroupMessages(groupId) {
      try {
        const rows = await X.dbq.select(T.GMSGS, { eq: ['group_id', groupId], order: ['created_at', { ascending: true }], limit: 200 });
        return (rows || []).map(_gmsgIn);
      } catch (_) { return []; }
    },
    async addGroupMessage(groupId, userId, username, avatar, avatarType, text) {
      const r = await X.dbq.insert(T.GMSGS, _gmsgOut({
        group_id: groupId, user_id: userId, username, avatar, avatar_type: avatarType, text
      }));
      return _gmsgIn(r);
    },

    // ===== 举报 reports =====
    async getReports() {
      try {
        const rows = await X.dbq.select(T.REPORTS, { order: ['created_at', { ascending: false }] });
        return (rows || []).map(_repIn);
      } catch (_) { return []; }
    },
    async addReport({ reporterId, targetType, targetId, reason }) {
      const r = await X.dbq.insert(T.REPORTS, _repOut({
        reporter_id: reporterId, target_type: targetType, target_id: targetId, reason, status: 'pending'
      }));
      return _repIn(r);
    },
    async resolveReport(id, action, note) {
      try {
        await X.dbq.update(T.REPORTS, {
          handle_status: 'resolved',
          action: action || '',
          note: note || '',
          resolved_at: new Date().toISOString()
        }, { eq: ['id', id] });
      } catch (_) {}
    },

    // ===== 管理员日志：你未建 admin_logs，降级为空操作（不抛错） =====
    async getLogs(limit = 200) { return []; },
    async addLog(_meta) {
      // 可选：写进 reports 表加个特殊 target_type 占位，方便排查。
      try {
        await X.dbq.insert(T.REPORTS, _repOut({
          reporter_id: _meta && _meta.operatorId,
          target_type: 'admin_log',
          target_id: _meta && _meta.targetUserId,
          reason: (_meta && _meta.reason) || (_meta && _meta.action) || '',
          status: 'resolved',
          action: (_meta && _meta.action) || ''
        }));
      } catch (_) {}
      return null;
    }
  };

  X.store = store;
})(window.Xiao = window.Xiao || {});
