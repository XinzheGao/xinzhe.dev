# 翻译可视化管理

入口：`/admin/translations`。管理页不在公开导航和 sitemap 中，页面及接口均 noindex，接口响应 no-store。

## 本机使用

1. 在 `.env.local` 设置
   `TRANSLATION_ADMIN_PASSWORD`，至少 24 位随机字符。首次实施已为本机生成一份独立口令；不复用 DeepSeek
   Key，不将口令写进客户端。
2. `TRANSLATION_ADMIN_BACKEND=local`。
3. 启动网站 `npm run dev -- --hostname 127.0.0.1`。
4. 在另一个终端启动
   `npm run translate:worker`。worker 要独立保持运行；关网页不会停止任务，关掉 worker 后网页会明确显示离线。
5. 打开管理页，输入管理口令。使用 HttpOnly、SameSite=Strict、8 小时有效的签名会话；HTTPS 部署启用 Secure。更换口令会使所有现有会话失效。

这是单人博客的高熵访问口令方案，不包含用户注册、账户数据库或多人权限体系。公开生产环境应保持 HTTPS；如果未来需要多人、MFA 或细粒度权限，应接入成熟身份服务。

## 已接入的操作

- 分类与网站导航一致，顺序为：首页、文章、作品、随想、旅程、关于。首页和关于分别筛选 Notion 中的 home/about 页面，继续复用 pages 存储，不复制原文。旅程按时间线记录管理标题、简述与图片说明，日期和图片保持原样；支持标题、链接名和事件日期搜索。
- 分别查看英文、日文的未翻译、排队、处理中、成功、原文有更新、失败、锁定、待人工复核状态。
- 单篇单语言生成、检查更新和失败重试。
- 查看中文原文与已发布译文的逐段对照；单独修订标题、SEO 标题、摘要、图注、正文文字槽。
- 保存修订时自动锁定对应段落；支持整篇或单段锁定、解锁。
- 保存时比较译文版本及中文源哈希；出现冲突会拒绝覆盖，并保留页面中尚未保存的输入。修订一个段落不会意外发布其他段落的未完成 checkpoint。
- 原文变化时允许查看上一版对照，但要求先更新译文，再人工修订。代码与链接目标必须保留。
- 多个段落有未保存修改时，保存其中一段会保留其余草稿；切换内容/文章需先保存，或明确放弃未保存修改。
- 最近任务、历史错误、手动刷新和可见页面每 10 秒刷新状态。

后台列表用 Notion 的编辑时间提示原文更新；打开对照后用完整内容 hash 确认是否存在实际变化。普通网页请求不调用 AI。

## 本地任务链路与互斥

网页 POST 只写入
`translations/.admin-queue.json`，返回 202。独立 worker 领取任务、等待现有翻译 CLI 完成、记录成功/失败。复用 CLI 的段落 checkpoint、重试、源版本校验和完整发布逻辑。

相同类型/链接名/语言的活动任务去重；`.queue-lock` 保护领取与入队，`.admin-runner-lock` 保证单 worker，现有
`.worker-lock`
保护译文写入。worker 每 4 秒写心跳，页面超过 15 秒未收到心跳就禁用提交，避免任务被静默搁置。没有依赖 API 请求结束后的 detached
promise 或 waitUntil。

本机队列、心跳与锁已加入 gitignore。`jobs.json`
和 catalog 仍为正式译文记录。正常关闭 worker 会等待当前任务结束；异常终止后，需要检查 lock 内 owner.json，确认进程已结束再清理遗留锁并重新启动。恢复时将未完成 running 任务重新排队，已成功段落可从 checkpoint 复用。

本地修改直接写 catalog，开发服务器会读取更新。要发布到线上仍需提交并部署；本机模式不会自动推送 GitHub。

## Vercel / GitHub 后端

Vercel 的文件系统不能作为可靠译文写入目标。服务器检测到 `VERCEL` 时会拒绝 local 模式。线上使用：

```dotenv
TRANSLATION_ADMIN_BACKEND=github
TRANSLATION_ADMIN_PASSWORD=独立的随机管理口令
TRANSLATION_GITHUB_TOKEN=仓库范围的后台专用Token
TRANSLATION_GITHUB_REPOSITORY=XinzheGao/xinzhe.dev
TRANSLATION_GITHUB_BRANCH=main
VERCEL_DEPLOY_HOOK=可选的对应分支部署钩子
```

请在托管平台配置这些服务端变量，不将 Token 交给前端。后台 Token 仅授权目标仓库，至少需要 Contents 读写及 Actions 读写。翻译工作流本身使用仓库的 GITHUB_TOKEN，而不是将这个管理 Token 传入模型任务。

上线前：

1. 将管理代码和 `.github/workflows/translations.yml` 发布到默认分支；`TRANSLATION_GITHUB_BRANCH` 与默认分支保持一致。
2. 按 `multilingual.md` 配好 Actions 的 Notion/模型/部署 secrets 与 variables，并设置
   `TRANSLATIONS_ENABLED=true`。未启用的工作流会显示 skipped，需要修复配置。
3. 管理页通过 GitHub REST API 读取当前仓库 catalog、jobs 与 Actions 任务状态，不使用旧部署里的文件假装实时状态。
4. 翻译按钮 dispatch 指定 kind/slug/locale，独立 runner 翻译并提交；手动执行不触发批量。
5. 修订使用 GitHub 文件 SHA 条件写入；已有活动 workflow 时暂停修订，写冲突则拒绝覆盖。提交后可通过服务器的 VERCEL_DEPLOY_HOOK 触发部署；未配置或触发失败会明确提示“已保存，尚需部署”，不会假装线上已经生效。
6. 未配置后台 GitHub 凭据时，管理页会显示待连接状态，不允许写入临时磁盘。

GitHub API 适配器除模拟测试外，已在 `XinzheGao/xinzhe.dev`
使用专用 Token 验证仓库读写权限、读取远端 catalog/jobs 和 dispatch；远端单篇任务已成功复用既有译文。新 Vercel 项目已配置 GitHub 后端与部署钩子，具体上线与验收记录见
[上线说明](deployment.md)。

## 安全与验收范围

所有数据接口和写操作都在服务端校验会话；修改请求还验证 Origin，限定内容类型、语言、slug、操作和请求体大小。客户端不能提交任意 shell 命令、Notion
ID 或文件路径；原文只读，只有已发布内容可以提交翻译。错误输出不会包含供应商正文或凭据。

自动测试覆盖会话篡改/过期/口令轮换、跨站请求、非法目标、人工修订的版本冲突和 checkpoint 隔离、并发入队去重、任务完成持久化、Vercel 模式限制、GitHub
dispatch 与 SHA 冲突。浏览器实际验证登录、任务入队执行、对照编辑、保存锁定和还原；试点检查更新命中缓存，没有为此重新翻译整篇。

旅程记录使用由 Notion 页面 ID 派生的稳定标识作为翻译键，修改事件标题或日期不会生成重复记录。旅程译文预览跳转到对应语言的
`/journey`，不会创建不存在的逐条详情 URL。
