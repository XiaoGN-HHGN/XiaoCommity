// ============================================================
// Xiao · Supabase 配置
// 【③ 密钥填写位置】请把下面两个常量替换为您自己 Supabase 项目的值。
//   获取路径：登录 https://supabase.com → 选择项目 →
//   Project Settings → API → Project URL 与 Publishable key。
// 仅使用 Publishable 公共密钥即可（前端纯静态部署，无需 service_role）。
// 未填写时应用会在控制台告警并在网络面板提示，但不会崩溃。
// ============================================================
(function (X) {
  X.SUPABASE_CONFIG = {
    SUPABASE_URL: 'https://lyibmphtnokkxslummlq.supabase.co',
    // 这里！把页面里 sb_publishable_ 开头那串完整粘贴进来
    SUPABASE_ANON_KEY: 'sb_publishable_qjDY11IDzE5UrKy3ruMMLw_VCxGqiep',
    STORAGE_BUCKET_AVATAR: 'avatars',
    STORAGE_BUCKET_WORKS: 'works_files',
    EMAIL_DOMAIN: 'xiao.local'
  };
})(window.Xiao = window.Xiao || {});
