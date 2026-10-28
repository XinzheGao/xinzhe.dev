# 本地验收记录

日期：2026-10-28。未部署、未开启后台工作流。

用户流程：中文在 Notion 发布 → 独立 worker 读取公开内容 → 生成双语块级译文 → 完整版本原子替换并保存至 Git → 部署后页面只读已有译文。

| 边界 | 当前结果 |
| --- | --- |
| 真实 Notion 内容读取 | 通过：读取到 7 篇公开文章；对 posts:writing-starter8 完成 dry-run，读取正文并计算源哈希 |
| UI 三语 | 浏览器确认 /en 为 Home/Writing 等英文，侧栏切换后 /ja 为日文，内部链接保留前缀 |
| 页面及旧链接 | /、/en、/ja 及三种语言的 /writing/writing-starter8 全部 HTTP 200；/zh-CN/writing/writing-starter8 返回 308 到原中文路径 |
| SEO | 试点双语译文成功后，hreflang 包含 zh-CN/en/ja/x-default；英文、日文 canonical 各自独立，article lang 对应 en/ja，robots 为 index, follow。其他缺译文章仍回退中文并 noindex |
| 请求头隔离 | 对中文 URL 手工传入 x-site-locale: en，输出仍为 zh-CN，语言不能被请求头覆盖 |
| 浏览器检查 | 真实英文、日文标题和正文均已显示，复制按钮与日期对应当前语言；发现 ForwardRef 列表 key 开发警告，未发现 hydration mismatch |
| 自动测试 | 30 项通过，含 7 项翻译/路由/持久化测试组；模型调用为明确的模拟响应，不作为真实翻译结果 |
| 代码与构建 | npm run lint、npm run build（默认 Turbopack）和 webpack 生产构建通过 |
| 真实模型生成 | 通过：使用本机配置的 deepseek-flash，为 posts:writing-starter8 生成英文、日文各 14 个翻译段；两项任务首次成功 |
| 上线链路 | 尚未启用：需 GitHub secrets/variables、Vercel Deploy Hook、默认分支工作流及一次真实单篇质量验收 |

实际修复了 Next.js 将本地 rewrite origin 从 127.0.0.1 规范化成 localhost 后再次代理自身、覆盖语言头的问题。设置当前版本支持的 skipProxyUrlNormalize，并用原始 request.url 构造目标后，浏览器与 HTTP 检查均显示正确语言。

## 本次真实单篇验证

- `npm run translate -- --kind posts --slug writing-starter8`：英文和日文均 succeeded，各 14 个段落/元数据翻译单元。
- 重复执行同一命令，两种语言均输出 unchanged；已跳过模型调用，任务 attempts 仍为 1。
- 从真实 Notion 重新读取源内容，对比源哈希并完整比较 materialize(source, segments) 与已保存快照，确认中文未变，所有非翻译字段、代码、链接和结构均保留。
- 源哈希：`4cdd3df87db11679a7e3d02ed6ba344d915ae9effdbb7227a5ec3bdf088a1a77`。
- `translations/catalog.json` 已持久化本篇双语译文；`jobs.json` 保留成功状态；`verification.json` 已生成。
- 浏览器与实际 HTTP 输出均读取到真实译文，缺译提示消失，页面可索引。
- 此样文没有实际图片块，真实 Notion 图片的端到端展示尚未验证；图片结构和签名 URL 更新由已有模拟测试覆盖。

只验证了单篇真实生成和缓存复用，没有修改 Notion 原文来触发更新，也没有启用批量扫描、GitHub Actions 或线上部署。段落增量、失败恢复和锁定仍以前述自动测试为依据。

## 可视化管理验收

- 新增 `/admin/translations`，已由用户实际登录后在浏览器验收；未登录数据请求返回 401，跨 Origin 登录返回 403，正确口令返回 HttpOnly 会话。
- 管理页读取到真实 7 篇文章及现有 2 份译文，显示本机 worker 在线。
- 从页面提交 writing-starter8 的英文检查更新，独立 worker 领取并完成任务，CLI 输出 unchanged，任务列表显示成功。
- 浏览器对示例英文标题执行修订、保存并锁定；再次运行 CLI 后人工修订仍被保留。随后通过界面恢复原标题并解锁，没有留下测试标题或额外锁定。
- 真实接口对过期 revision 返回 409、非法目标返回 400，拒绝后 catalog 文件内容不变。
- 自动测试更新为 39 项，通过；Lint 和含管理路由的生产构建通过。GitHub 远端适配器使用模拟响应验收，尚未执行真实远端提交、dispatch 或线上部署。
- 使用说明见 `docs/translation-admin.md`。本地队列和心跳未纳入 Git；管理口令仍仅在本机 .env.local 中。

## 旅程与分类补充验收

- 后台分类顺序改为首页、文章、作品、随想、旅程、关于；实际渲染 HTML 中顺序一致，不再显示独立页面。
- 六个分类的真实接口均为 200；首页只含 home，关于只含 about，旅程返回 6 条已发布记录。
- 通过后台队列为一条旅程记录生成英文、日文标题、简述和图片说明；两种语言均成功，源哈希与当前 Notion 一致。
- `/en/journey` 与 `/ja/journey` 返回 200，实际响应包含翻译后的标题与简述。预览链接均指向时间线，不增加逐条详情路由。
- 测试增至 43 项，Lint 和生产构建通过。覆盖分类筛选、稳定记录标识、日期/图片保留、图片签名更新、增量复用及人工锁定。
- 本次浏览器自动化连接报不可用，未宣称完成新界面截图验收；分类顺序与页面内容通过真实 HTTP 响应核验。
