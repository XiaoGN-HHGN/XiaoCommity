// ============================================================
// Xiao · i18n · 简体中文
// 注册到 window.Xiao.i18n.messages['zh-CN']
// ============================================================
(function (X) {
  X.i18n = X.i18n || {};
  X.i18n.messages = X.i18n.messages || {};
  X.i18n.messages['zh-CN'] = {
    // 通用
    "common.brand": "Xiao · 企海狐协会",
    "common.confirm": "确认",
    "common.cancel": "取消",
    "common.submit": "提交",
    "common.save": "保存",
    "common.delete": "删除",
    "common.edit": "编辑",
    "common.search": "搜索",
    "common.upload": "上传",
    "common.download": "下载",
    "common.like": "点赞",
    "common.back": "返回",
    "common.more": "更多",
    "common.loading": "加载中...",
    "common.empty": "暂无内容",
    "common.optional": "可选",
    "common.required": "必填",

    // 导航
    "nav.home": "首页",
    "nav.chat": "聊天大厅",
    "nav.works": "作品广场",
    "nav.editor": "在线编辑器",
    "nav.profile": "个人中心",
    "nav.admin": "管理后台",
    "nav.contact": "联系我们",
    "nav.video": "科研视频",
    "nav.login": "登录",
    "nav.register": "注册",
    "nav.logout": "退出",

    // 首页
    "home.title": "Xiao",
    "home.subtitle": "面向理科专业爱好者的在线虚拟社区",
    "home.meaning": "企海狐协会 · 融合 企鹅 + 海豚 + 雪狐",
    "home.cta.start": "立即加入",
    "home.cta.explore": "浏览作品",
    "home.feature.title": "社区核心能力",
    "home.feature.chat": "公共聊天大厅",
    "home.feature.chatDesc": "实时交流、@用户、Emoji、链接识别",
    "home.feature.works": "作品交易广场",
    "home.feature.worksDesc": "论文、代码、文件夹上传与定价下载",
    "home.feature.editor": "在线代码编辑器",
    "home.feature.editorDesc": "JS / HTML / CSS / Python 协同创作",
    "home.feature.social": "学术社交",
    "home.feature.socialDesc": "好友、私聊、付费群组、举报体系",
    "home.coin.title": "社区代币 Ttpx_A",
    "home.coin.desc": "新用户注册即送 10 枚，作品点赞获得 0.01 枚/次",

    // 登录注册
    "auth.login": "登录",
    "auth.register": "注册",
    "auth.username": "账号名",
    "auth.password": "登录密码",
    "auth.passwordConfirm": "二次确认密码",
    "auth.phone": "手机号码",
    "auth.remember": "记住密码",
    "auth.avatar": "头像选择",
    "auth.avatarUpload": "本地上传图片",
    "auth.avatarDefault": "使用系统默认头像",
    "auth.toRegister": "没有账号？去注册",
    "auth.toLogin": "已有账号？去登录",
    "auth.welcome": "欢迎回到 Xiao",
    "auth.welcomeNew": "加入企海狐协会",
    "auth.hint.coin": "新用户注册初始发放 10 枚 Ttpx_A",

    // 聊天
    "chat.title": "公共聊天大厅",
    "chat.placeholder": "输入消息，支持 @用户 Emoji 链接...",
    "chat.online": "在线用户",
    "chat.offline": "离线",
    "chat.send": "发送",
    "chat.emoji": "表情",
    "chat.private": "发起私聊",
    "chat.report": "举报",

    // 作品
    "works.title": "作品广场",
    "works.all": "全部",
    "works.cat.sci": "科创",
    "works.cat.paper": "论文",
    "works.cat.code": "代码",
    "works.cat.game": "游戏",
    "works.upload": "上传作品",
    "works.free": "免费",
    "works.paid": "定价",
    "works.likes": "点赞",
    "works.download": "下载",
    "works.realname": "游戏分区下载需实名认证",
    "works.pending": "等待创作者同意",
    "works.approve": "同意下载",
    "works.reject": "拒绝",
    "works.name": "作品名称",
    "works.desc": "作品描述",
    "works.category": "分区",
    "works.price": "价格（Ttpx_A）",
    "works.file": "选择文件",
    "works.preview": "在线预览",

    // 编辑器
    "editor.title": "在线代码编辑器",
    "editor.run": "运行",
    "editor.preview": "预览",
    "editor.collab": "协同创作",
    "editor.collabHint": "邀请好友加入同一项目",
    "editor.lang.js": "JavaScript",
    "editor.lang.html": "HTML",
    "editor.lang.css": "CSS",
    "editor.lang.python": "Python",

    // 个人中心
    "profile.title": "个人中心",
    "profile.coin": "Ttpx_A 资产",
    "profile.myWorks": "我的作品",
    "profile.friends": "好友列表",
    "profile.groups": "我的群组",
    "profile.blocked": "拉黑名单",
    "profile.settings": "账号设置",
    "profile.realname": "实名认证",
    "profile.realnameDone": "已认证",
    "profile.realnameBtn": "去认证",

    // 管理员
    "admin.title": "管理员后台",
    "admin.redeem": "兑换码",
    "admin.redeemPlaceholder": "输入管理员兑换码",
    "admin.redeemOk": "管理员模式已开启",
    "admin.redeemFail": "兑换码无效",
    "admin.users": "用户管理",
    "admin.coins": "代币查询",
    "admin.worksReview": "作品审核",
    "admin.reports": "举报审核",
    "admin.logs": "操作记录",
    "admin.grant": "授予管理员",
    "admin.ban": "封禁用户",
    "admin.banTemp": "限时封禁",
    "admin.banPerm": "永久封禁",
    "admin.mute": "全局禁言",
    "admin.reason": "操作原因（必填）",
    "admin.award": "发放代币",
    "admin.deduct": "扣除代币",
    "admin.amount": "数量",
    "admin.super": "超级管理员",

    // 社交
    "social.friendReq": "好友申请",
    "social.accept": "同意",
    "social.decline": "拒绝",
    "social.block": "拉黑",
    "social.unblock": "解除拉黑",
    "social.unfriend": "解除好友",
    "social.createGroup": "创建群组",
    "social.groupCost": "创建群组消耗 20 枚 Ttpx_A",
    "social.groupLimit": "单群人数上限 20 人",
    "social.groupName": "群组名称",
    "social.privateChat": "私聊",

    // 兑换码
    "redeem.title": "兑换码",
    "redeem.placeholder": "请输入兑换码",
    "redeem.submit": "立即兑换",
    "redeem.success": "兑换成功",
    "redeem.fail": "兑换失败，请检查兑换码",

    // 联系我们
    "contact.title": "联系我们",
    "contact.bilibili": "哔哩哔哩主页",
    "contact.visit": "前往访问",

    // 视频
    "video.title": "科研长视频",
    "video.dev": "功能正在开发中",
    "video.devDesc": "科研长视频板块即将上线，敬请期待",

    // footer
    "footer.brand": "企鹅 + 海豚 + 雪狐融合",

    // 校验
    "err.required": "此项必填",
    "err.passwordMismatch": "两次密码不一致",
    "err.phoneFormat": "手机号格式不正确",
    "err.userExists": "账号已存在",
    "err.loginFail": "账号或密码错误",
    "err.notLogin": "请先登录",
    "err.noPerm": "无权限操作",
    "err.insufficientCoin": "Ttpx_A 余额不足",
    "err.realnameRequired": "游戏分区需实名认证",

    // 成功
    "ok.registered": "注册成功，已发放 10 枚 Ttpx_A",
    "ok.loggedIn": "登录成功",
    "ok.loggedOut": "已退出登录",
    "ok.uploaded": "作品已提交，等待审核",
    "ok.saved": "已保存",
    "ok.liked": "已点赞",
    "ok.coinSent": "代币已发放",
    "ok.banned": "已封禁",
    "ok.muted": "已禁言",
    "ok.reportSent": "举报已提交，等待审核"
  };
})(window.Xiao = window.Xiao || {});
