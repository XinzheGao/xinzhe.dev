# xinzhe.dev 部署与上线记录

更新日期：2026-10-29（Asia/Shanghai）。

## 目标与当前状态

- GitHub：<https://github.com/XinzheGao/xinzhe.dev>，默认分支 `main`。
- Vercel：`xinzhe-dev`，团队 `xinzhes-projects`，Node.js `24.x`。
- 正式地址 `https://xinzhe.dev` 已切换到 `xinzhe-dev`。`www.xinzhe.dev`
  同属新项目，并以 308 跳转到根域名，保留路径和查询参数。旧 `xinzhe-blog` 项目保留用于回退。
- 新项目预览受到 Vercel 登录保护。请使用有该团队访问权限的账号打开。
- 本机 `origin` 指向新仓库，`legacy` 保留原 `XinzheGao/onur.dev`。当前工作分支为 `main`。
- 新仓库导入当前完整快照；旧仓库和本机原分支保留此前提交历史。MIT 与上游来源声明已保留。

## 自动翻译功能更新

本次代码新增后台自动翻译开关、每小时/每天/每周频率和立即检查全部内容。新工作流使用 `translations/automation.json`
作为开关，替代以下历史验收中的 `TRANSLATIONS_ENABLED` 与
`TRANSLATION_BATCH_ENABLED`；发布新代码后默认关闭，用户开启时会立即补译。新增功能已完成线上验收，见“本次正式上线”；下面的旧验收记录保留为迁移历史。

## 环境与翻译任务

GitHub Actions Secrets 已配置 `NOTION_API_TOKEN`、`TRANSLATION_API_KEY` 和
`VERCEL_DEPLOY_HOOK`。Variables 包含模型、供应商地址、Notion 数据源 ID 和试点 `writing-starter8`。旧变量
`TRANSLATIONS_ENABLED` / `TRANSLATION_BATCH_ENABLED` 已不再参与工作流判断。线上以 `translations/automation.json`
为准，本次发布时为关闭、每天检查。现有 catalog、任务状态、词汇表和验证记录均已迁移。

Vercel Production / Preview 已配置 Notion、刷新密钥、翻译后台口令、仓库专用 Token、仓库与分支、
`TRANSLATION_ADMIN_BACKEND=github`、部署钩子、草稿预览密钥以及正式 canonical 地址。模型密钥仅由 GitHub 独立任务使用，普通网页访问不会调用模型。GitHub
Token 仅授权新仓库，Contents 与 Actions 读写；密钥均不进入 Git。

部署钩子名为 `translations-main`，仅触发新项目的 `main`
分支。后台人工修订提交与翻译任务有变更时使用同一钩子触发部署。缓存命中时不产生新提交，也不会反复请求部署。

## 已验证

- 本地 43 项测试、ESLint 和生产构建通过。
- GitHub CI 完成安装、43 项测试、ESLint 和 Node.js 24 生产构建：
  <https://github.com/XinzheGao/xinzhe.dev/actions/runs/40731611080>。
- 独立 runner 读取真实 Notion 的 dry-run 成功，不调用模型：
  <https://github.com/XinzheGao/xinzhe.dev/actions/runs/40731673867>。
- 正式翻译工作流检查试点英文，输出 `unchanged`，成功复用已保存译文：
  <https://github.com/XinzheGao/xinzhe.dev/actions/runs/40732288339>。
- 新仓库提交 `c475f05` 的 Vercel 生产和预览构建均达到 READY；生产构建并未接管正式域名。
- 通过现有 Vercel 登录会话读取预览首页，显示真实 Notion 介绍及七篇已发布文章。
- 实际登录部署后的翻译后台，显示 GitHub Actions 模式、真实首页记录和新仓库最近成功任务。
- 使用后台适配器及仓库专用 Token 实际读取 catalog/jobs 并 dispatch 日文检查任务，runner 成功：
  <https://github.com/XinzheGao/xinzhe.dev/actions/runs/40733013811>。

`unchanged`
验收证明配置与缓存链路，不意味着重新生成了译文或验证了新模型质量。自动翻译保持关闭。Supabase 阅读统计和 Tinybird 分析为可选服务，当前不作为上线前提。

## 本次正式上线

2026-10-29（北京时间）经用户明确授权，部署翻译功能并同时切换正式域名。

- 功能提交 `ad3b63c`；线上验收修正最近任务标题后为 `d32ab90`。
- GitHub CI（51 项测试、ESLint、Node.js 24 生产构建）成功：
  <https://github.com/XinzheGao/xinzhe.dev/actions/runs/40802977558>。
- Vercel 生产部署 `dpl_AQiNr4ixXV5zUEE2jzXpQWxvakDE` 达到 READY：
  <https://vercel.com/xinzhes-projects/xinzhe-dev/AQiNr4ixXV5zUEE2jzXpQWxvakDE>。
- GitHub 只读 Notion 工作流成功，不调用模型： <https://github.com/XinzheGao/xinzhe.dev/actions/runs/40802697365>。
- 单篇缓存验收成功，输出 `posts:writing-starter8:en: unchanged`；检查后 main 仍为 `d32ab90`，部署步骤跳过，没有新增翻译提交：
  <https://github.com/XinzheGao/xinzhe.dev/actions/runs/40803545004>。
- 正式 HTTPS 的首页、文章、作品、随想、旅程、关于、中英日试点文章、RSS 和站点地图均返回 200，并确认实际首页内容及英文正文正常。
- 正式翻译后台成功登录，显示 GitHub
  Actions 模式、自动开关、每天凌晨 3 点频率、立即检查和真实任务标题；未登录接口返回 401。
- `www.xinzhe.dev/writing?release=verify` 返回 308，Location 为 `https://xinzhe.dev/writing?release=verify`。
- 自动翻译保持关闭，上线操作不等同于开启历史内容补译。受保护 Vercel 地址使用现有登录会话验收，没有创建共享链接。
- 错误日志曾出现一次外部请求 socket 瞬断；随后再次打开正式首页，内容和七篇文章正常显示。没有将此记录描述为完全无错误。

## 回退

旧项目、旧仓库和配置均保留。需要回退整站时，在 Vercel 将 `xinzhe.dev` 和 `www.xinzhe.dev` 迁回
`xinzhe-blog`；不要更改无关 DNS 记录。仅回退新项目代码时，可在 Vercel 选择上一条已验证生产部署。

## 数据源 ID 脱敏后的部署检查

源码和 `.env.example` 不再保存真实数据源 ID。五个 `NOTION_*_DATA_SOURCE_ID`
必须由运行环境提供，变量名见 README 的 Notion 后台表格。

- 本地：在 Git 忽略的 `.env.local` 保存五个 ID 和 `NOTION_API_TOKEN`，重启开发服务器后生效。
- Vercel：部署前分别检查 Production、Preview 的五个 ID 和
  `NOTION_API_TOKEN`；缺少变量时先补齐，再重新部署。Development 若需通过 Vercel 启动，也须单独配置；普通本地开发使用
  `.env.local`。
- GitHub Actions：五个 ID 放在仓库 Variables，`NOTION_API_TOKEN` 放在 Secrets；翻译工作流已经引用对应变量。
- 不带 Notion 凭据的 CI 构建仍可验证代码；它不代表真实内容链路验收。有 Token 却缺少某个 ID 时，读取该数据源会报出缺失变量名，不会退回硬编码 ID。

此次仅清理当前文件，不重写旧 Git 提交，也不修改翻译内容里的页面或区块 ID。

2026-10-29 本次核查：本地已补齐五个 ID，并只读验证五个数据源成功。经用户授权，已将
`NOTION_PROJECTS_DATA_SOURCE_ID`、`NOTION_THOUGHTS_DATA_SOURCE_ID` 补入 Vercel `xinzhe-dev` 的 Production /
Preview 和 GitHub Actions
Variables；回查确认与本地配置一致。当时未触发部署或工作流；随后本节记录的正式上线已使用这些变量。
