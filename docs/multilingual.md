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
仅保留首次真实双语文章成功生成的记录，不在重复检查时改写。该记录不是自动检查或历史补译的前置门槛，也不能替代人工质量检查。

## 第二阶段：增量与批量

```sh
npm run translate -- --kind posts --all
npm run translate -- --kind pages --all
npm run translate -- --kind projects --all
npm run translate -- --kind thoughts --all
```

批量入口及后台全量检查会直接处理符合公开条件的内容，不要求先运行试点文章。旅程已接入每条事件的标题、简述与图片说明翻译，日期与图片保持原样；可使用
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

在 `/admin/translations` 设置自动翻译，无需逐篇操作：

- 总开关默认关闭，频率默认每天。首次开启立即提交一次全部内容检查，并补译历史已发布内容缺少的英文、日文。
- 频率可选每小时整点、每天北京时间凌晨 3 点、每周一北京时间凌晨 3 点。GitHub 调度可能延迟，延迟后补查一次，不重复追赶所有错过的时段。
- “立即检查全部内容”独立于总开关，关闭自动翻译时也能使用。已有活动任务时禁用重复提交。
- 全部检查包含文章、首页与关于等导航页面、作品、随想及旅程；遵循网站现有发布状态、日期、有效链接名等公开条件。
- 开启后修改频率不会重复触发首次补译；关闭不删除现有译文，也不中断已经执行的任务。

设置保存在 `translations/automation.json`。本机由持续运行的 `npm run translate:worker` 检查到期任务；也可执行
`npm run translate:check` 立即扫描。线上管理后端通过带 SHA 的 GitHub 文件写入保存设置，开启时 dispatch
`scan_all=true`。设置保存成功但 dispatch 失败时明确提示，可点击立即检查重试，后续定时任务也会补查。

`.github/workflows/translations.yml`
每小时唤醒独立 runner，由设置和上次实际检查时间判断是否到期。关闭或未到期时不查询 Notion、不请求模型。旧
`TRANSLATIONS_ENABLED`、`TRANSLATION_BATCH_ENABLED`
变量不再控制该工作流，避免后台开关与隐藏开关不一致。单篇手动任务仍支持 kind/slug/locale，单独运行不会扫描全部内容。`repository_dispatch`
入口遵守同样的自动开关和频率；没有自动注册 Notion webhook。

先在仓库配置：

| 类型     | 名称                         | 用途                              |
| -------- | ---------------------------- | --------------------------------- |
| Secret   | NOTION_API_TOKEN             | 读取中文源                        |
| Secret   | TRANSLATION_API_KEY          | 模型供应商密钥                    |
| Secret   | VERCEL_DEPLOY_HOOK           | 当前默认分支的 Vercel Deploy Hook |
| Variable | TRANSLATION_MODEL            | 账户可用模型 ID                   |
| Variable | TRANSLATION_BASE_URL         | 可选，留空默认 DeepSeek           |
| Variable | 五个 NOTION_*_DATA_SOURCE_ID | 与网站相同的 Notion 数据源        |
| Variable | FIRST_TRANSLATION_SLUG       | 可选，手动单篇任务的默认链接名    |

每次先比较整篇和逐段 hash，无变化不请求模型，也不改写 catalog/jobs/verification。模型客户端按需创建，因此命中缓存不要求实际发起任何模型请求。变化内容逐段 checkpoint，失败保留旧完整译文，下次检查续跑；人工锁定内容进入待复核。

检查状态单独记录：本机为忽略提交的 `.admin-check.json`；线上为保留 90 天的 GitHub Actions
artifact（包含检查开始/结束和结果），后台通过 artifact 元数据读取上次真实检查。没有变化时仍可查看执行记录，但不创建 Git 提交或请求部署。

只有译文或 checkpoint/错误状态变化才提交相应文件；只有 published 译文变化且推送成功才调用部署钩子。某篇失败时，其他已完整成功的译文可以继续上线，失败内容保留旧版。Actions
concurrency 串行执行；本机 `.worker-lock`
保护全量扫描和人工修订。push 前 rebase 对齐独立设置变更，遇到真实内容冲突则失败，绝不强推；失败保留 checkpoint
artifact。

本机模式仍只写本地文件，上线需要提交并部署。线上自动流程需要新代码和工作流已发布到默认分支、仓库允许 Actions 提交、GitHub 后端及部署钩子已配置。GitHub 计划任务的延迟和公共仓库长期无活动自动停用计划任务等限制仍适用。

## 验证与边界

`npm test`
覆盖文本与结构保留、逐块增量、缓存失效、重排、媒体签名更新、断点恢复、旧版本保留、人工锁、模型失败/截断、互斥与原子写入。`npm run lint`、`npm run build`
及浏览器三语路由验证分别检查代码与实际渲染。

自动测试使用明确的模拟供应商，不把模拟字符串当作真实译文发布。没有真实 API 凭证时，不能声称已验证 DeepSeek 质量、费用、账户权限或后台上线；此时不要声称真实模型生成链路已验收。

## 可视化管理入口

现在可通过 `/admin/translations`
查看状态、提交单篇任务、对照修订和锁定译文。专用管理口令、本地 worker 和 GitHub 后端的说明见
[管理后台说明](translation-admin.md)。
