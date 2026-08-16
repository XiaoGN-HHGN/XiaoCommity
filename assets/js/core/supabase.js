// ============================================================
// Xiao · Supabase 客户端 + 统一请求封装
// 依赖：head 中引入的 Supabase 官方 SDK（window.supabase.createClient）
// 依赖：core/config.js 提供的 X.SUPABASE_CONFIG
// 暴露：X.db（supabase 客户端）、X.dbq（统一请求工具）、X.realtime（订阅辅助）
// 业务层（store.js / 各 module）只通过 X.db / X.dbq 访问数据，
// 不直接拼 SQL，便于后续替换或加缓存。
// ============================================================
(function (X) {
  const cfg = X.SUPABASE_CONFIG || {};
  const ready = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY
    && cfg.SUPABASE_URL !== 'YOUR_SUPABASE_URL'
    && cfg.SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY'
    && typeof window.supabase !== 'undefined' && window.supabase.createClient);

  let client = null;
  if (ready) {
    try {
      client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
    } catch (e) { console.error('[Xiao] Supabase 初始化失败', e); }
  } else {
    console.warn('[Xiao] Supabase 未配置：请在 assets/js/core/config.js 填入 SUPABASE_URL / SUPABASE_ANON_KEY，并确认 index.html 已加载 Supabase SDK。');
  }

  X.db = client;
  X.supabaseReady = !!(client);

  // [FIX: 401/403 静默] 统一错误判定：RLS拒绝 / 策略未授权 / 匿名无权 这类，不 throw、不刷屏，
  // 按方法语义返回空值，保证页面不崩。真正致命的错误（500 / 网络断开）还是会打 warn。
  const _silentCodes = new Set(['401','403','404','42501','PGRST301','PGRST202','42P01']);
  function _isSilent(error) {
    if (!error) return false;
    const code = String(error.code || error.status || '');
    if (_silentCodes.has(code)) return true;
    const msg = (error.message || '').toLowerCase();
    return msg.indexOf('row-level security') >= 0
      || msg.indexOf('permission denied') >= 0
      || msg.indexOf('unauthorized') >= 0
      || msg.indexOf('forbidden') >= 0;
  }
  function _trace(method, table, error) {
    // 调试模式下只打 debug 级别，不污染 console
    if (window.XIAO_DEBUG) console.debug('[Xiao][dbq][' + method + ']', table, error && error.code, error && error.message);
    else if (!_isSilent(error)) console.warn('[Xiao][dbq][' + method + ']', table, error);
  }

  /** 统一请求工具：包装常见 CRUD，统一错误处理（401/403 静默返回空） */
  const dbq = {
    /** SELECT：返回数组（空也返回 []） */
    async select(table, { columns = '*', filter = {}, eq = null, order = null, limit = null, single = false } = {}) {
      if (!client) return single ? null : [];
      let q = client.from(table).select(columns);
      if (eq) q = q.eq(eq[0], eq[1]);
      for (const k in filter) q = q.eq(k, filter[k]);
      if (order) q = q.order(order[0], order[1] || {});
      if (limit) q = q.limit(limit);
      if (single) q = q.single();
      const { data, error } = await q;
      if (error) { _trace('select', table, error); return single ? null : []; }
      return single ? data : (data || []);
    },

    /** INSERT：返回插入后的行 */
    async insert(table, row, { returning = '*' } = {}) {
      if (!client) return null;
      const { data, error } = await client.from(table).insert(row).select(returning);
      if (error) { _trace('insert', table, error); return null; }
      return (data || [])[0] || null;
    },

    /** UPDATE：按条件更新 */
    async update(table, patch, { eq = null, filter = null } = {}) {
      if (!client) return [];
      let q = client.from(table).update(patch);
      if (eq) q = q.eq(eq[0], eq[1]);
      if (filter) for (const k in filter) q = q.eq(k, filter[k]);
      const { data, error } = await q.select('*');
      if (error) { _trace('update', table, error); return []; }
      return data || [];
    },

    /** DELETE */
    async remove(table, { eq = null, filter = null } = {}) {
      if (!client) return;
      let q = client.from(table).delete();
      if (eq) q = q.eq(eq[0], eq[1]);
      if (filter) for (const k in filter) q = q.eq(k, filter[k]);
      const { error } = await q;
      if (error) _trace('remove', table, error);
    },

    /** UPSERT */
    async upsert(table, row, { conflict = 'id' } = {}) {
      if (!client) return null;
      const { data, error } = await client.from(table).upsert(row, { onConflict: conflict }).select('*');
      if (error) { _trace('upsert', table, error); return null; }
      return (data || [])[0] || null;
    },

    /** RPC 调用（用于带 SECURITY DEFINER 的函数，如代币增减） */
    async rpc(fn, args = {}) {
      if (!client) return null;
      const { data, error } = await client.rpc(fn, args);
      if (error) { _trace('rpc', fn, error); return null; }
      return data;
    },

    /** Storage 上传：返回公开 URL（失败返回 null 不崩） */
    async upload(bucket, path, file, { contentType } = {}) {
      if (!client) return null;
      try {
        const { data, error } = await client.storage.from(bucket)
          .upload(path, file, { contentType: contentType || file.type, upsert: true });
        if (error) { _trace('upload', bucket + '/' + path, error); return null; }
        const { data: pub } = client.storage.from(bucket).getPublicUrl(path);
        return pub.publicUrl;
      } catch (e) { _trace('upload', bucket + '/' + path, e); return null; }
    },

    /** Storage 下载为文本（在线预览作品内容） */
    async downloadText(bucket, path) {
      if (!client) return '';
      try {
        const { data, error } = await client.storage.from(bucket).download(path);
        if (error) { _trace('downloadText', bucket + '/' + path, error); return ''; }
        return await data.text();
      } catch (e) { _trace('downloadText', bucket + '/' + path, e); return ''; }
    }
  };

  /** Realtime 订阅辅助：返回可 unsubscribe 的句柄 */
  const rt = {
    /** 订阅某表 INSERT 事件，回调(payload) */
    onInsert(table, filter, cb) {
      if (!client) return { unsubscribe() {} };
      const ch = client.channel('rt_' + table + '_' + Math.random().toString(36).slice(2, 7))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table, ...(filter || {}) }, cb)
        .subscribe();
      return { unsubscribe() { try { client.removeChannel(ch); } catch (e) {} } };
    },
    /** 订阅任意事件 */
    onChange(table, filter, cb, event = '*') {
      if (!client) return { unsubscribe() {} };
      const ch = client.channel('rt_' + table + '_' + Math.random().toString(36).slice(2, 7))
        .on('postgres_changes', { event, schema: 'public', table, ...(filter || {}) }, cb)
        .subscribe();
      return { unsubscribe() { try { client.removeChannel(ch); } catch (e) {} } };
    }
  };

  X.dbq = dbq;
  X.realtime = rt;
})(window.Xiao = window.Xiao || {});
