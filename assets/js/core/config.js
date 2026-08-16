// ============================================================
// Xiao · Supabase 配置
// 【③ 密钥填写位置】请把下面两个常量替换为您自己 Supabase 项目的值。
//   获取路径：登录 https://supabase.com → 选择项目 →
//   Project Settings → API → Project URL 与 anon public key。
// 仅使用 anon 公共密钥即可（前端纯静态部署，无需 service_role）。
// 未填写时应用会在控制台告警并在网络面板提示，但不会崩溃。
// ============================================================
(function (X) {
  X.SUPABASE_CONFIG = {
    // 例：'https://abcd1234.supabase.co'
    SUPABASE_URL: 'YOUR_SUPABASE_URL',
    // 例：'eyJhbGciOiJI...'（anon public，非 service_role）
    SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',
    // 头像 / 文件存储桶名（需在 Supabase Storage 中创建同名 bucket，设为 public）
    STORAGE_BUCKET_AVATAR: 'avatars',
    STORAGE_BUCKET_WORKS: 'works',
    // 合成邮箱后缀（账号名登录用，无需真实邮箱）
    EMAIL_DOMAIN: 'xiao.local'
  };
})(window.Xiao = window.Xiao || {});
