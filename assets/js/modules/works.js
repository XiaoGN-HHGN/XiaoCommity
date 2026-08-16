// ============================================================
// Xiao · 模块 · 作品广场（Supabase）
// 分区：科创 / 论文 / 代码 / 游戏
// 上传文件 → Supabase Storage；元数据 → works 表
// 定价 / 下载需作者同意 / 游戏分区需实名 / 在线预览
// 点赞免费，作者每收到点赞 +0.01 Ttpx_A
// ============================================================
(function (X) {
  X.modules = X.modules || {};

  const CATS = [
    { id: 'all', key: 'works.all', icon: '🌐' },
    { id: 'sci', key: 'works.cat.sci', icon: '🔬' },
    { id: 'paper', key: 'works.cat.paper', icon: '📄' },
    { id: 'code', key: 'works.cat.code', icon: '💻' },
    { id: 'game', key: 'works.cat.game', icon: '🎮' }
  ];

  const PREVIEW_EXT = ['txt', 'py', 'js', 'html', 'css'];

  const works = {
    cat: 'all',
    q: '',

    render() {
      const t = X.t;
      const canUpload = X.auth.isLogin();
      return `
        <section class="app-view">
          <div class="works-bar">
            <div class="cat-pills" id="wk_cats">
              ${CATS.map(c => `<button class="cat-pill ${c.id === this.cat ? 'active' : ''}" data-cat="${c.id}">${c.icon} ${t(c.key)}</button>`).join('')}
            </div>
            <input class="input" id="wk_q" placeholder="${t('common.search')}" value="${X.utils.escape(this.q)}" style="max-width:200px" />
            ${canUpload ? `<button class="btn primary" id="wk_upload">${t('works.upload')}</button>` : ''}
          </div>
          <div class="grid auto" id="wk_grid"><div class="dim center" style="padding:20px;grid-column:1/-1">加载中...</div></div>
        </section>`;
    },

    async afterRender() {
      X.utils.$$('#wk_cats .cat-pill').forEach(b => b.addEventListener('click', () => {
        this.cat = b.dataset.cat; this.renderGrid();
        X.utils.$$('#wk_cats .cat-pill').forEach(x => x.classList.toggle('active', x.dataset.cat === this.cat));
      }));
      const qInput = X.utils.$('#wk_q');
      if (qInput) qInput.addEventListener('input', X.utils.debounce(e => { this.q = e.target.value; this.renderGrid(); }, 200));
      const up = X.utils.$('#wk_upload');
      if (up) up.addEventListener('click', () => this.openUpload());
      await this.renderGrid();
    },

    /** 渲染作品卡片（按需读取内容字段以省内存） */
    async renderGrid() {
      const grid = X.utils.$('#wk_grid');
      if (!grid) return;
      if (!X.supabaseReady) { grid.innerHTML = '<div class="dim center" style="grid-column:1/-1">⚠ Supabase 未配置</div>'; return; }
      try {
        const all = (await X.store.getWorks()).filter(w => w.status === 'approved');
        let list = this.cat === 'all' ? all : all.filter(w => w.category === this.cat);
        if (this.q) {
          const q = this.q.toLowerCase();
          list = list.filter(w => (w.name + ' ' + (w.desc || '')).toLowerCase().includes(q));
        }
        if (!list.length) {
          grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="ico">📦</div><p>${X.t('common.empty')}</p></div>`;
          return;
        }
        // 按需批量拉取作者信息
        const authorCache = {};
        const cur = X.auth.currentUser();
        grid.innerHTML = '';
        for (const w of list) {
          if (!authorCache[w.author_id]) authorCache[w.author_id] = await X.store.getUser(w.author_id);
          const author = authorCache[w.author_id] || { username: '?' };
          const ext = (w.file_name || '').split('.').pop().toLowerCase();
          const icon = w.category === 'game' ? '🎮' : w.category === 'paper' ? '📄' : w.category === 'code' ? '💻' : '🔬';
          const priceTag = w.price > 0 ? `<span class="tag gold">✦ ${w.price}</span>` : `<span class="tag accent">${X.t('works.free')}</span>`;
          const card = X.utils.h('div', { class: 'work-card', onclick: () => this.openDetail(w.id) });
          card.innerHTML = `
            <div class="thumb">${icon}</div>
            <h4>${X.utils.escape(w.name)}</h4>
            <p class="dim" style="font-size:12px;margin:0;min-height:32px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${X.utils.escape(w.desc || '')}</p>
            <div class="row-info">
              <span>${X.utils.escape(author.username)}</span>
              ${priceTag}
            </div>
            <div class="row-info">
              <span>❤️ ${w.likes || 0}</span>
              <span class="dim">${PREVIEW_EXT.includes(ext) ? ext.toUpperCase() : (ext || 'FILE')}</span>
            </div>`;
          grid.appendChild(card);
        }
      } catch (e) {
        grid.innerHTML = '<div class="dim center" style="grid-column:1/-1">加载失败</div>';
      }
    },

    /** 上传弹窗（文件 → Storage，元数据 → works 表） */
    openUpload() {
      if (!X.auth.requireLogin()) return;
      if (!X.supabaseReady) { X.ui.toast('Supabase 未配置', 'err'); return; }
      const t = X.t;
      const body = `
        <div class="field"><label class="label">${t('works.name')}</label><input class="input" id="up_name" /></div>
        <div class="field"><label class="label">${t('works.desc')}</label><textarea class="textarea" id="up_desc"></textarea></div>
        <div class="row">
          <div class="field grow"><label class="label">${t('works.category')}</label>
            <select class="select" id="up_cat">
              <option value="sci">${t('works.cat.sci')}</option>
              <option value="paper">${t('works.cat.paper')}</option>
              <option value="code">${t('works.cat.code')}</option>
              <option value="game">${t('works.cat.game')}</option>
            </select>
          </div>
          <div class="field"><label class="label">${t('works.price')}</label><input class="input" id="up_price" type="number" min="0" step="0.01" value="0" style="width:110px" /></div>
        </div>
        <div class="field"><label class="label">${t('works.file')}</label>
          <label class="btn ghost block" style="cursor:pointer">📁 ${t('works.file')}
            <input type="file" id="up_file" style="display:none" accept=".txt,.py,.js,.html,.css,.json,.md,.csv" />
          </label>
          <div class="hint" id="up_filehint"></div>
        </div>
        <p class="hint">支持预览：txt / py / js / html / css；游戏分区下载需实名认证</p>`;
      const inst = X.ui.modal({ title: t('works.upload'), body, footer: 'placeholder' });
      const foot = X.utils.$('.modal-foot', inst.modal);
      foot.innerHTML = '';
      foot.appendChild(X.utils.h('button', { class: 'btn ghost', onclick: () => inst.close() }, [t('common.cancel')]));
      const submit = X.utils.h('button', { class: 'btn primary' }, [t('common.upload')]);
      foot.appendChild(submit);
      X.utils.$('#up_file', inst.modal).addEventListener('change', async e => {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 2 * 1024 * 1024) { X.ui.toast('file ≤2MB', 'err'); e.target.value = ''; return; }
        X.utils.$('#up_filehint').textContent = '✓ ' + f.name + ' (' + (f.size / 1024).toFixed(1) + 'KB)';
      });
      submit.addEventListener('click', async () => {
        const name = X.utils.$('#up_name').value.trim();
        const desc = X.utils.$('#up_desc').value.trim();
        const category = X.utils.$('#up_cat').value;
        const price = X.utils.$('#up_price').value;
        const fileInput = X.utils.$('#up_file');
        const file = fileInput.files[0];
        if (!name) { X.ui.toast(t('err.required'), 'err'); return; }
        if (!file) { X.ui.toast(t('works.file'), 'err'); return; }
        submit.disabled = true; submit.textContent = '上传中...';
        try {
          const cur = X.auth.currentUser();
          const ext = file.name.split('.').pop().toLowerCase();
          // 上传到 Storage
          const storagePath = `${cur.id}/${Date.now()}_${file.name}`;
          await X.dbq.upload(X.SUPABASE_CONFIG.STORAGE_BUCKET_WORKS, storagePath, file);
          // 写入元数据
          await X.store.createWork({
            authorId: cur.id, name, desc, category, price,
            fileName: file.name, filePath: storagePath, fileType: ext
          });
          X.ui.toast(t('ok.uploaded'), 'ok');
          inst.close();
          await this.renderGrid();
        } catch (e) {
          X.ui.toast('上传失败: ' + (e.message || ''), 'err');
        } finally {
          submit.disabled = false; submit.textContent = t('common.upload');
        }
      });
    },

    /** 作品详情：预览 / 点赞 / 下载申请（按需从 Storage 拉取内容） */
    async openDetail(workId) {
      if (!X.supabaseReady) { X.ui.toast('Supabase 未配置', 'err'); return; }
      const w = await X.store.getWork(workId);
      if (!w) return;
      const author = await X.store.getUser(w.author_id) || {};
      const cur = X.auth.currentUser();
      const ext = (w.file_name || '').split('.').pop().toLowerCase();
      const canPreview = PREVIEW_EXT.includes(ext);
      const t = X.t;
      // 是否已点赞
      let liked = false;
      if (cur) liked = await X.store.getMyLike(workId, cur.id);

      const detail = X.utils.h('div', { class: 'work-detail' });
      const left = X.utils.h('div');
      left.innerHTML = `
        <h2 style="margin:0 0 4px">${X.utils.escape(w.name)}</h2>
        <div class="row" style="margin-bottom:8px">
          <span class="tag accent">${t('works.cat.' + w.category)}</span>
          ${w.price > 0 ? `<span class="tag gold">✦ ${w.price} Ttpx_A</span>` : `<span class="tag accent">${t('works.free')}</span>`}
          <span class="tag">❤️ ${w.likes || 0}</span>
        </div>
        <p class="muted">${X.utils.escape(w.desc || '—')}</p>
        <div class="divider"></div>
        <div class="card-title">${t('works.preview')}</div>`;
      if (canPreview) {
        const host = X.utils.h('div', { class: 'preview' });
        // 按需从 Storage 加载内容
        try {
          const content = await X.dbq.downloadText(X.SUPABASE_CONFIG.STORAGE_BUCKET_WORKS, w.file_path);
          if (ext === 'html') {
            const iframe = X.utils.h('iframe', { class: 'editor-preview', sandbox: 'allow-scripts', style: { minHeight: '300px', border: '1px solid var(--line)', borderRadius: '10px' } });
            host.appendChild(iframe);
            iframe.srcdoc = content;
          } else {
            const pre = X.utils.h('pre', { class: 'code' });
            pre.textContent = content || '';
            host.appendChild(pre);
          }
        } catch (e) {
          host.appendChild(X.utils.h('div', { class: 'dim center', style: { padding: '20px' } }, ['内容加载失败']));
        }
        left.appendChild(host);
      } else {
        left.appendChild(X.utils.h('div', { class: 'dev-placeholder', style: { padding: '20px' } }, ['该文件类型不支持在线预览']));
      }
      detail.appendChild(left);

      // 右侧操作
      const right = X.utils.h('div', { class: 'card' });
      const authorAvatar = author.avatar || '👤';
      const av = author.avatar_type === 'dataurl'
        ? `<img class="avatar md clickable" src="${author.avatar}" />`
        : `<div class="avatar md" style="display:grid;place-items:center;font-size:22px">${authorAvatar}</div>`;
      right.innerHTML = `
        <div class="row" style="align-items:center;margin-bottom:12px">
          ${av}
          <div><div style="font-weight:600">${X.utils.escape(author.username || '?')}</div><div class="dim" style="font-size:12px">${X.utils.relTime(w.created_at)}</div></div>
        </div>`;
      const actions = X.utils.h('div', { class: 'col' });
      // 点赞（免费，作者 +0.01 Ttpx_A）
      actions.appendChild(X.utils.h('button', { class: 'btn ' + (liked ? 'primary' : 'ghost'), onclick: () => { this.doLike(workId); } }, [`${liked ? '❤️' : '🤍'} ${t('works.like')} (${w.likes || 0})`]));
      // 下载
      actions.appendChild(X.utils.h('button', { class: 'btn primary', onclick: () => this.doDownload(workId) }, ['⬇ ' + t('works.download')]));
      // 游戏分区需实名
      if (w.category === 'game') {
        actions.appendChild(X.utils.h('p', { class: 'hint' }, ['⚠️ ' + t('works.realname')]));
      }
      if (cur && w.author_id !== cur.id) {
        actions.appendChild(X.utils.h('button', { class: 'btn ghost', onclick: () => { inst.close(); X.modules.social.openReport('work', workId); } }, [t('chat.report')]));
      }
      right.appendChild(actions);
      detail.appendChild(right);

      const inst = X.ui.modal({ title: t('works.title'), body: detail, size: 'wide' });
    },

    async doLike(workId) {
      if (!X.auth.requireLogin()) return;
      const cur = X.auth.currentUser();
      try {
        const r = await X.store.toggleLike(workId, cur.id);
        if (!r) return;
        X.ui.toast(X.t('ok.liked'), 'ok', 1200);
        // 刷新详情
        const modal = X.utils.$('.modal.show');
        if (modal) { modal.remove(); this.openDetail(workId); }
      } catch (e) {
        X.ui.toast('操作失败', 'err');
      }
    },

    async doDownload(workId) {
      if (!X.auth.requireLogin()) return;
      const cur = X.auth.currentUser();
      const w = await X.store.getWork(workId);
      if (!w) return;
      // 游戏分区需实名（管理员除外）
      if (w.category === 'game' && !cur.realname && !X.auth.isAdmin()) {
        X.ui.toast(X.t('err.realnameRequired'), 'err');
        const ok = await X.ui.confirm(X.t('err.realnameRequired') + '\n\n' + X.t('profile.realnameBtn') + '?');
        if (ok) { await this.openRealname(workId); }
        return;
      }
      try {
        // 自己的作品直接下载
        if (w.author_id === cur.id) {
          const content = await X.dbq.downloadText(X.SUPABASE_CONFIG.STORAGE_BUCKET_WORKS, w.file_path);
          X.utils.downloadText(w.file_name, content, 'text/plain');
          X.ui.toast(X.t('works.download') + ' ✓', 'ok'); return;
        }
        // 别人作品需作者同意
        let req = await X.store.getDownloadReq(workId, cur.id);
        if (!req) {
          await X.store.addDownloadReq(workId, cur.id);
          X.ui.toast(X.t('works.pending'), 'info');
          return;
        }
        if (req.status === 'approved') {
          const content = await X.dbq.downloadText(X.SUPABASE_CONFIG.STORAGE_BUCKET_WORKS, w.file_path);
          X.utils.downloadText(w.file_name, content, 'text/plain');
          X.ui.toast(X.t('works.download') + ' ✓', 'ok');
        } else if (req.status === 'pending') {
          X.ui.toast(X.t('works.pending'), 'info');
        } else {
          X.ui.toast(X.t('works.reject'), 'err');
        }
      } catch (e) {
        X.ui.toast('下载失败', 'err');
      }
    },

    async openRealname(workId) {
      const name = await X.ui.prompt({
        title: X.t('profile.realname'),
        label: '真实姓名',
        placeholder: 'real name',
        validate: v => v ? null : X.t('err.required')
      });
      if (!name) return;
      const idno = await X.ui.prompt({
        title: X.t('profile.realname'),
        label: '证件号',
        placeholder: 'ID number',
        validate: v => v ? null : X.t('err.required')
      });
      if (!idno) return;
      const cur = X.auth.currentUser();
      await X.store.updateProfile(cur.id, {
        realname: true,
        realname_info: JSON.stringify({ name, id: idno.slice(0, 4) + '****' })
      });
      await X.auth.refresh();
      X.ui.toast(X.t('profile.realnameDone'), 'ok');
      if (workId) this.doDownload(workId);
    }
  };

  X.modules.works = works;
  X.router.register('works', { render: () => works.render(), afterRender: () => works.afterRender() });
})(window.Xiao = window.Xiao || {});
