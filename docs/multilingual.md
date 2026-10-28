# 三语博客与自动翻译

## 现有架构与方案

- Next.js 16.4 App Router、React 19、JavaScript，内容由 `src/lib/notion-client.mjs`
  读取 Notion。文章、独立页面、作品、随想、旅程各有数据源；公开文章只接受「已发布」、有效链接名及非未来发布日期。
- 中文原文只维护在 Notion。正文是原生 Notion blocks，并非 Markdown 文件。原有 `NotionContent`
  渲染格式、代码、图片、列表和表格；不先转 Markdown 再转回，避免损坏结构。
- 现有 UI 字典、侧栏底部语言/主题控件继续使用。主题仍为 light/dark/system，使用服务端 Cookie 初始化；语言改由 URL 确定，不按 Cookie 或浏览器语言自动重定向中文链接。
- 中文保持 `/writing/slug` 等原路径；英文 `/en/writing/slug`，日文 `/ja/writing/slug`。`src/proxy.js`
  将带语言的 URL 重写到原路由，设置可信请求头；无需复制页面组件或移动所有路由。`/zh-CN/...`
  308 到原中文路径。动态渲染读取请求语言，避免跨语言共享 HTML。`skipProxyUrlNormalize`
  保留内部重写的原始 origin，避免 127.0.0.1 被规范化为 localhost 后变成自代理请求、丢失语言头。
- 翻译存储是
  `translations/catalog.json`，使用 Git 版本控制及部署发布。当前 Supabase 没有配置，项目没有现成的后台队列；因此不引入新数据库，不在 Vercel 只读/临时文件系统写入译文。文件仅存译文、哈希和必要结构，不额外保存中文原文快照。代码及专有名词会原样出现在译文中。
- 模型供应商封装在 `provider.mjs`，使用 Node 内置 fetch 调用 OpenAI 兼容 Chat
  Completions，默认地址 DeepSeek。接口地址、模型、Key 都可以替换，不增加运行时依赖。接口文档：https://api-docs.deepseek.com/api/create-chat-completion/
  。模型 ID 请按账户可用列表配置，不在代码中固定。

## 第一阶段：单篇验证

`.env.local`（禁止提交密钥）：

```dotenv
NOTION_API_TOKEN=本机已有配置
TRANSLATION_API_KEY=在本机填写
TRANSLATION_BASE_URL=https://api.deepseek.com
TRANSLATION_MODEL=填写账户可用模型ID
```

兼容已有 `DEEPSEEK_API_KEY`，优先使用 `TRANSLATION_API_KEY`。密钥不会进入 `NEXT_PUBLIC_`、浏览器 bundle 或任务日志。

```sh
# 只读取真实已发布文章和计算哈希，不请求 AI，不修改 Notion
npm run translate -- --kind posts --slug writing-starter8 --dry-run
# 翻译同一篇的 en、ja；也可加 --locale en
npm run translate -- --kind posts --slug writing-starter8
```

检查 `/writing/writing-starter8`、`/en/writing/writing-starter8`、`/ja/writing/writing-starter8`
的标题、摘要、正文、代码、图片、canonical、hreflang，并人工检查翻译语气。中文为默认且原文不被修改。Notion 首页介绍使用
`--kind pages --slug home`，关于页使用 `--kind pages --slug about`；其余页面 SEO 可通过同一 pages 类型翻译。

未生成译文时展示带 `lang="zh-CN"`
的中文原文和准备中提示。文章此时 noindex，hreflang 和 sitemap 只列出成功生成的语言。正常访问只读取已有译文，绝不触发 AI。草稿预览始终显示中文，不使用公开译文覆盖草稿。

`translations/verification.json`
只在同一篇真实文章的两种语言均成功生成后写入。这是生成门槛，不能替代浏览器和人工质量检查。首次上线不要启用批量，先完成上述检查。

## 第二阶段：增量与批量

```sh
npm run translate -- --kind posts --all
npm run translate -- --kind pages --all
npm run translate -- --kind projects --all
npm run translate -- --kind thoughts --all
```

批量入口在真实双语单篇生成前会拒绝执行。旅程已接入每条事件的标题、简述与图片说明翻译，日期与图片保持原样；可使用
`--kind journey --slug entry-页面ID去掉连字符` 翻译单条，或 `--kind journey --all`
批量处理。文章、作品、随想及独立页继续支持正文翻译。

增量单位为 Notion
block，每块一次生成其所有普通文本 slot（包括链接标签、图注、表格单元格），保留 rich_text 顺序、annotations、block
ID、代码、公式、媒体 URL 及子级结构。标题、SEO 标题、摘要、全站描述分别缓存。hash 包含文字、结构、词汇表、模型配置和翻译器版本；修改一个块仅重译该块，块排序/代码修改不会重译其他块；修改词汇表或模型会使相关缓存失效。Notion 图片短期签名 URL 不参与 hash，也不写进译文文件；展示时按 block
ID 从当前原文补回。

普通 Notion 块以结构保真为保证；若在纯文本里直接输入 Markdown，额外检查代码和链接目标不变，但模型对任意 Markdown 文本的结构保真仍需人工检查。本系统不提供独立 Markdown 文件导入器。

每段成功后原子写入 checkpoint，整篇成功且再次确认 Notion 发布状态和版本一致后才替换 published。失败时旧 published 保留。重跑复用成功段落；旧译文仍按其完整快照展示，不把新中文段落和旧外文混成正文。Notion 取消发布后，原有公开内容查询仍阻止译文访问。

## 人工修订与锁定

查看 catalog 中 `documents["posts:slug"].en.segments`
的 key。修订文件是和该段文本 slot 数量相同的 JSON 字符串数组。文件里的内容应保持代码和链接。

```sh
# 修订标题并锁住该段
npm run translate:review -- --slug writing-starter8 --locale en --segment title --file /absolute/path/edit.json
# 锁整篇，不改变已有译文
npm run translate:review -- --slug writing-starter8 --locale ja
# 解锁整篇/某段后重新运行翻译
npm run translate:review -- --slug writing-starter8 --locale ja --unlock
npm run translate:review -- --slug writing-starter8 --locale en --segment title --unlock
```

同一原文重复跑任务不会覆盖锁定修订。锁住的段落原文改变时，整篇进入 needs-review，保留上一版，需人工决定解锁或继续保留。整篇锁定同样处理。修订后提交 catalog 并重新部署即可生效；不改中文 Notion 页面。CLI 使用同一互斥锁，避免与本机 worker 冲突。

## 后台自动执行与发布

`.github/workflows/translations.yml` 使用独立 GitHub Actions
runner，任务完整等待模型和落盘，不依赖请求结束后异步执行。支持：

- 每小时第 17、47 分扫描，识别中文发布/更新；GitHub 调度可能延迟，属于最终一致，不承诺即时执行。
- Actions 手动运行指定文章。
- 外部发布集成发送 `repository_dispatch`，event_type 为
  `notion-content-published`，唤醒扫描；这是可接入入口，尚未自动注册 Notion webhook。

工作流在默认分支存在且变量 `TRANSLATIONS_ENABLED=true` 时才执行。先设置：

| 类型     | 名称                      | 用途                              |
| -------- | ------------------------- | --------------------------------- |
| Secret   | NOTION_API_TOKEN          | 仅读取已发布中文源                |
| Secret   | TRANSLATION_API_KEY       | DeepSeek 或兼容供应商             |
| Secret   | VERCEL_DEPLOY_HOOK        | 当前默认分支的 Vercel Deploy Hook |
| Variable | TRANSLATION_MODEL         | 账户可用模型 ID                   |
| Variable | TRANSLATION_BASE_URL      | 可选，留空默认 DeepSeek           |
| Variable | FIRST_TRANSLATION_SLUG    | 单篇验证文章的链接名              |
| Variable | TRANSLATIONS_ENABLED      | true 开启调度                     |
| Variable | TRANSLATION_BATCH_ENABLED | 单篇质量验收后设为 true           |

如 Notion 数据源与当前 checkout 不同，设置同名 `NOTION_*_DATA_SOURCE_ID`
Variables。工作流先完成 pilot，再在批量开关允许时扫描文章、页面、作品、随想和旅程五类存储内容。任务状态和最近 20 次失败保存在
`translations/jobs.json`，状态包括 running/succeeded/failed/needs-review；Actions 页面同时保留执行日志。API 请求最多三次，429/5xx/网络或响应校验失败有限退避，401/403 立即失败；后续调度会续跑。

Actions concurrency 串行化所有远程翻译；本机使用 `.worker-lock`
互斥。进程异常退出遗留锁时，确认 owner.json 进程已结束再手工清理；不按任意超时抢占仍活跃的任务。跨机器操作应通过同一个工作流，或先同步后手动提交；Git
push 冲突会失败，不强推覆盖人工修订，失败会上传 checkpoint artifact。

成功译文和状态先提交并推送到默认分支，只有有变更且任务成功才调用 Vercel Deploy
Hook。不要只依赖机器人提交自动触发其他工作流。配置对应 Git/Vercel 项目及 Deploy
Hook 后才能证明线上发布链路；部署完成前旧线上版本继续服务。开启工作流前需确认默认分支允许机器人提交，或将持久化步骤改为组织要求的 PR 流程。

## 验证与边界

`npm test`
覆盖文本与结构保留、逐块增量、缓存失效、重排、媒体签名更新、断点恢复、旧版本保留、人工锁、模型失败/截断、互斥与原子写入。`npm run lint`、`npm run build`
及浏览器三语路由验证分别检查代码与实际渲染。

自动测试使用明确的模拟供应商，不把模拟字符串当作真实译文发布。没有真实 API 凭证时，不能声称已验证 DeepSeek 质量、费用、账户权限或后台上线；此时批量保持关闭。

## 可视化管理入口

现在可通过 `/admin/translations`
查看状态、提交单篇任务、对照修订和锁定译文。专用管理口令、本地 worker 和 GitHub 后端的说明见
[管理后台说明](translation-admin.md)。
