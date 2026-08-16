// ============================================================
// Xiao · 核心层 · 数据存储
// 基于 localStorage 的轻量数据层（静态站无后端，本地持久化）
// 模块化集合：users / works / messages / social / reports / logs
// ============================================================
(function (X) {
  const PREFIX = 'xiao.';
  const K = {
    USERS: PREFIX + 'users',
    WORKS: PREFIX + 'works',
    CHAT: PREFIX + 'chat.public',
    DM: PREFIX + 'chat.dm',
    FRIENDS: PREFIX + 'social.friends',
    BLOCKED: PREFIX + 'social.blocked',
    GROUPS: PREFIX + 'social.groups',
    REPORTS: PREFIX + 'reports',
    LOGS: PREFIX + 'admin.logs',
    SESSION: PREFIX + 'session',
    COUNTER: PREFIX + 'counter'
  };

  function read(key, def) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? def : JSON.parse(raw);
    } catch { return def; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { console.warn('storage write fail', e); return false; }
  }

  /** 自增 ID 生成器 */
  function nextId(seq) {
    const c = read(K.COUNTER, {});
    c[seq] = (c[seq] || 0) + 1;
    write(K.COUNTER, c);
    return Date.now().toString(36) + c[seq].toString(36);
  }

  const store = {
    K,
    read, write, nextId,

    // ===== 用户 =====
    getUsers() { return read(K.USERS, []); },
    getUser(id) { return this.getUsers().find(u => u.id === id); },
    getUserByName(name) { return this.getUsers().find(u => u.username === name); },
    saveUser(user) {
      const users = this.getUsers();
      const i = users.findIndex(u => u.id === user.id);
      if (i >= 0) users[i] = user; else users.push(user);
      write(K.USERS, users);
      return user;
    },
    /** 创建用户（注册） */
    createUser({ username, password, phone, avatar, avatarType }) {
      const user = {
        id: nextId('user'),
        username, password, phone,
        avatar: avatar || X.utils.randAvatar(),
        avatarType: avatarType || 'emoji', // emoji | dataurl
        ttpxA: 10,            // 初始 10 枚
        role: 'user',         // user | admin | super
        realname: false,      // 实名认证
        banned: null,         // { until: ts } 或 { perm: true }
        muted: null,          // { until: ts } 或 { perm: true }
        bio: '',
        createdAt: Date.now()
      };
      return this.saveUser(user);
    },

    /** 调整代币（正增负减） */
    adjustCoin(userId, delta) {
      const u = this.getUser(userId);
      if (!u) return null;
      u.ttpxA = Math.max(0, (u.ttpxA || 0) + delta);
      this.saveUser(u);
      return u.ttpxA;
    },

    // ===== 会话（登录态 + 记住密码） =====
    getSession() { return read(K.SESSION, null); },
    setSession(userId, remember) {
      const s = { userId, remember, ts: Date.now() };
      write(K.SESSION, s);
      return s;
    },
    clearSession() { localStorage.removeItem(K.SESSION); },

    // ===== 公共聊天 =====
    getChat() { return read(K.CHAT, []); },
    addMessage(msg) {
      const list = this.getChat();
      list.push({ id: nextId('msg'), ts: Date.now(), ...msg });
      // 仅保留最近 300 条
      if (list.length > 300) list.splice(0, list.length - 300);
      write(K.CHAT, list);
      return list[list.length - 1];
    },

    // ===== 私聊 =====
    dmKey(a, b) { return [a, b].sort().join('__'); },
    getDM(userA, userB) {
      const all = read(K.DM, {});
      return all[this.dmKey(userA, userB)] || [];
    },
    addDM(from, to, text) {
      const all = read(K.DM, {});
      const key = this.dmKey(from, to);
      const arr = all[key] || [];
      arr.push({ id: nextId('dm'), from, to, text, ts: Date.now() });
      if (arr.length > 200) arr.splice(0, arr.length - 200);
      all[key] = arr;
      write(K.DM, all);
      return arr[arr.length - 1];
    },

    // ===== 作品 =====
    getWorks() { return read(K.WORKS, []); },
    getWork(id) { return this.getWorks().find(w => w.id === id); },
    getWorksByUser(userId) { return this.getWorks().filter(w => w.authorId === userId); },
    saveWork(work) {
      const list = this.getWorks();
      const i = list.findIndex(w => w.id === work.id);
      if (i >= 0) list[i] = work; else list.push(work);
      write(K.WORKS, list);
      return work;
    },
    createWork({ authorId, name, desc, category, price, fileName, fileContent, fileType }) {
      const work = {
        id: nextId('work'),
        authorId, name, desc,
        category,             // sci | paper | code | game
        price: Number(price) || 0,
        fileName, fileContent, fileType,
        status: 'pending',     // pending(待审核) | approved | rejected
        likes: 0, likedBy: [],
        downloadReqs: [],      // [{ userId, status: pending|approved|rejected }]
        createdAt: Date.now()
      };
      return this.saveWork(work);
    },
    /** 点赞：免费；作者 +0.01 */
    toggleLike(workId, userId) {
      const w = this.getWork(workId);
      if (!w) return null;
      const i = w.likedBy.indexOf(userId);
      let liked;
      if (i >= 0) { w.likedBy.splice(i, 1); w.likes = Math.max(0, w.likes - 1); liked = false; }
      else { w.likedBy.push(userId); w.likes++; liked = true; this.adjustCoin(w.authorId, 0.01); }
      this.saveWork(w);
      return { liked, likes: w.likes };
    },

    // ===== 好友 =====
    getFriends(userId) {
      const all = read(K.FRIENDS, {});
      return all[userId] || [];
    },
    getFriendReqs(userId) {
      const all = read(K.FRIENDS + '.req', {});
      return (all[userId] || []).filter(r => r.status === 'pending');
    },
    sendFriendReq(fromId, toId) {
      const all = read(K.FRIENDS + '.req', {});
      const arr = all[toId] || [];
      if (arr.find(r => r.from === fromId && r.status === 'pending')) return false;
      arr.push({ id: nextId('freq'), from: fromId, to: toId, status: 'pending', ts: Date.now() });
      all[toId] = arr;
      write(K.FRIENDS + '.req', all);
      return true;
    },
    resolveFriendReq(reqId, toId, accept) {
      const all = read(K.FRIENDS + '.req', {});
      const arr = all[toId] || [];
      const r = arr.find(x => x.id === reqId);
      if (!r) return false;
      r.status = accept ? 'accepted' : 'rejected';
      all[toId] = arr;
      write(K.FRIENDS + '.req', all);
      if (accept) {
        const fa = this.getFriends(r.from); if (!fa.includes(toId)) fa.push(toId); write(K.FRIENDS, { ...read(K.FRIENDS, {}), [r.from]: fa });
        const fb = this.getFriends(toId); if (!fb.includes(r.from)) fb.push(r.from); write(K.FRIENDS, { ...read(K.FRIENDS, {}), [toId]: fb });
      }
      return true;
    },
    removeFriend(userId, otherId) {
      const all = read(K.FRIENDS, {});
      [userId, otherId].forEach(uid => {
        const arr = all[uid] || [];
        const i = arr.indexOf(uid === userId ? otherId : userId);
        if (i >= 0) arr.splice(i, 1);
        all[uid] = arr;
      });
      write(K.FRIENDS, all);
    },

    // ===== 拉黑 =====
    getBlocked(userId) {
      const all = read(K.BLOCKED, {});
      return all[userId] || [];
    },
    block(userId, otherId) {
      const all = read(K.BLOCKED, {});
      const arr = all[userId] || [];
      if (!arr.includes(otherId)) arr.push(otherId);
      all[userId] = arr; write(K.BLOCKED, all);
    },
    unblock(userId, otherId) {
      const all = read(K.BLOCKED, {});
      const arr = (all[userId] || []).filter(x => x !== otherId);
      all[userId] = arr; write(K.BLOCKED, all);
    },

    // ===== 群组（创建消耗 20 Ttpx_A） =====
    getGroups() { return read(K.GROUPS, []); },
    getGroupsByUser(userId) { return this.getGroups().filter(g => g.ownerId === userId || g.members.includes(userId)); },
    createGroup(ownerId, name) {
      const g = { id: nextId('grp'), ownerId, name, members: [ownerId], admins: [], createdAt: Date.now() };
      const list = this.getGroups(); list.push(g); write(K.GROUPS, list);
      return g;
    },
    addGroupMember(groupId, userId) {
      const list = this.getGroups();
      const g = list.find(x => x.id === groupId);
      if (g && g.members.length < 20 && !g.members.includes(userId)) { g.members.push(userId); write(K.GROUPS, list); }
      return g;
    },
    removeGroupMember(groupId, userId) {
      const list = this.getGroups();
      const g = list.find(x => x.id === groupId);
      if (g) { g.members = g.members.filter(m => m !== userId); g.admins = g.admins.filter(a => a !== userId); write(K.GROUPS, list); }
      return g;
    },
    /** 群聊消息（独立存储） */
    getGroupMessages(groupId) {
      const all = read(K.GROUPS + '.msg', {});
      return all[groupId] || [];
    },
    addGroupMessage(groupId, userId, text) {
      const all = read(K.GROUPS + '.msg', {});
      const arr = all[groupId] || [];
      arr.push({ id: nextId('gmsg'), userId, text, ts: Date.now() });
      if (arr.length > 300) arr.splice(0, arr.length - 300);
      all[groupId] = arr;
      write(K.GROUPS + '.msg', all);
      return arr[arr.length - 1];
    },

    // ===== 举报 =====
    getReports() { return read(K.REPORTS, []); },
    addReport({ reporterId, targetType, targetId, reason }) {
      const list = this.getReports();
      const r = { id: nextId('rpt'), reporterId, targetType, targetId, reason, status: 'pending', ts: Date.now() };
      list.push(r); write(K.REPORTS, list);
      return r;
    },
    resolveReport(id, action, note) {
      const list = this.getReports();
      const r = list.find(x => x.id === id);
      if (r) { r.status = 'resolved'; r.action = action; r.note = note; r.resolvedAt = Date.now(); write(K.REPORTS, list); }
      return r;
    },

    // ===== 管理员操作记录 =====
    getLogs() { return read(K.LOGS, []); },
    addLog({ operatorId, action, targetUserId, reason, meta }) {
      const list = this.getLogs();
      list.unshift({ id: nextId('log'), operatorId, action, targetUserId, reason, meta, ts: Date.now() });
      if (list.length > 500) list.length = 500;
      write(K.LOGS, list);
      return list[0];
    },

    // ===== 种子数据（首次访问） =====
    seedIfEmpty() {
      if (this.getUsers().length > 0) return;
      // 内置超级管理员
      const superAdmin = {
        id: nextId('user'), username: 'admin', password: 'admin888',
        phone: '13800000000', avatar: '🛡️', avatarType: 'emoji',
        ttpxA: 9999, role: 'super', realname: true,
        banned: null, muted: null, bio: 'Xiao 超级管理员', createdAt: Date.now()
      };
      this.saveUser(superAdmin);
      // 示例用户 + 示例作品，便于体验
      const demo = this.createUser({ username: 'demo', password: 'demo123', phone: '13900000000', avatar: '🐬', avatarType: 'emoji' });
      this.createWork({
        authorId: demo.id, name: 'FFT 快速傅里叶变换可视化', desc: '基于 Canvas 的实时频谱演示', category: 'code', price: 0,
        fileName: 'fft.html', fileContent: '<h1>FFT Demo</h1><canvas id=c></canvas><script>const c=document.getElementById("c");const x=c.getContext("2d");c.width=400;c.height=200;let t=0;(function f(){x.clearRect(0,0,400,200);x.strokeStyle="#2fe3c4";x.beginPath();for(let i=0;i<400;i++){x.lineTo(i,100+Math.sin(i/20+t)*40);}x.stroke();t+=.05;requestAnimationFrame(f)})()</script>', fileType: 'html'
      });
      this.createWork({
        authorId: demo.id, name: '量子隧穿效应模拟论文', desc: '一维势垒穿透概率推导', category: 'paper', price: 2,
        fileName: 'quantum.txt', fileContent: '量子隧穿：当粒子能量小于势垒高度时，波函数仍以指数衰减形式穿透势垒，透射系数 T ≈ exp(-2κa)。',
        fileType: 'txt'
      });
      this.createWork({
        authorId: demo.id, name: '贪吃蛇（学术减压）', desc: 'Canvas 贪吃蛇，课间放松', category: 'game', price: 0,
        fileName: 'snake.html', fileContent: '<h3>Snake</h3><canvas id=g width=300 height=300 style="border:1px solid #ccc"></canvas><script>const g=document.getElementById("g");const x=g.getContext("2d");let s=[{x:10,y:10}],d={x:1,y:0},f={x:5,y:5};onkeydown=e=>{if(e.key=="ArrowUp")d={x:0,y:-1};if(e.key=="ArrowDown")d={x:0,y:1};if(e.key=="ArrowLeft")d={x:-1,y:0};if(e.key=="ArrowRight")d={x:1,y:0}};setInterval(()=>{let n={x:(s[0].x+d.x+15)%15,y:(s[0].y+d.y+15)%15};s.unshift(n);if(n.x==f.x&&n.y==f.y)f={x:Math.floor(Math.random()*15),y:Math.floor(Math.random()*15)};else s.pop();x.fillStyle="#0b1220";x.fillRect(0,0,300,300);x.fillStyle="#2fe3c4";s.forEach(p=>x.fillRect(p.x*20,p.y*20,18,18));x.fillStyle="#ffd76a";x.fillRect(f.x*20,f.y*20,18,18)},100)</script>', fileType: 'html'
      });
      // 把示例作品直接审核通过
      this.getWorks().forEach(w => { w.status = 'approved'; this.saveWork(w); });
      // 示例公共消息
      this.addMessage({ userId: demo.id, text: '欢迎来到 Xiao 企海狐协会 🐬理科社区，畅聊学术与科创！' });
    }
  };

  X.store = store;
})(window.Xiao = window.Xiao || {});
