# xinzhe.dev

一个简洁的个人网站，记录文章、作品、随想与旅程。

[访问网站](https://xinzhe.dev) · [多语言说明](docs/multilingual.md) · [部署说明](docs/deployment.md)

## 特性

- **Notion 写作** — 在 Notion 维护正文与栏目介绍，按发布状态展示内容，支持草稿预览。
- **三种语言** — 简体中文、English、日本語；译文由独立任务生成，支持人工修订与锁定。
- **主题切换** — 浅色、深色与跟随系统，适配桌面和移动端。
- **内容呈现** — 支持代码高亮、图片、表格与嵌套列表，自动估算文章阅读时长。
- **订阅与发现** — RSS、站点地图及多语言 SEO 元数据。

使用 Next.js 16 App Router、React 19、JavaScript 与 Tailwind CSS 4 构建。

## 本地运行

需要 Node.js 24.x 和 npm，具体版本见 `.nvmrc` 与 `package.json`。

```sh
npm ci
cp .env.example .env.local
npm run dev
```

启动前在 `.env.local` 填写自己的配置，本地访问 [localhost:3000](http://localhost:3000)。

- 创建 Notion 集成，设置 `NOTION_API_TOKEN`，并授予对应数据库的读取权限。
- 内容分为文章、作品、随想、导航页面与旅程五个数据源；按自己的数据库字段与 ID 调整 `src/lib/notion-client.mjs`。
- 在 `src/lib/site.js` 修改站点名称、头像与社交链接，通过 `NEXT_PUBLIC_SITE_URL` 设置站点地址。
- 草稿预览与手动刷新缓存需分别配置 `NOTION_PREVIEW_SECRET`、`NEXT_REVALIDATE_SECRET`。

AI 翻译、阅读统计和分析服务按需配置，变量说明见 [.env.example](.env.example)。密钥仅保存在本地环境文件或部署平台中。

## 内容与结构

文章、作品和随想各自使用独立的 Notion 记录，正文直接写在页面中。公开内容按发布状态、日期和链接名校验；RSS 与站点地图只收录公开内容。

三个内容库的「链接名」由 Notion 自动编号生成，无需手填，修改标题也不会改变网址：

| 内容库 | 「编号」前缀 | 链接示例              |
| ------ | ------------ | --------------------- |
| 文章   | `post`       | `/writing/post-1`     |
| 作品   | `project`    | `/projects/project-1` |
| 随想   | `thought`    | `/thoughts/thought-1` |

每个库添加「编号」（Notion ID 属性），设置对应前缀；「链接名」使用公式
`lower(format(prop("编号")))`。两项属性都在视图和页面详情中隐藏，网站仍读取公式结果。编号由 Notion 分配且固定，删除记录可能留下断号，不能按行数重新计算。导航页面库继续使用文本链接名（如
`home`、`about`）。

```text
src/app/          页面、路由与接口
src/components/   界面组件与 Notion 正文渲染
src/lib/          内容读取、主题与多语言逻辑
scripts/          翻译与维护任务
translations/     译文与任务配置
tests/            自动化测试
docs/             配置与维护说明
```

中文使用原路径，英文与日文分别使用 `/en`、`/ja` 前缀。网页访问只读取已有译文，翻译任务与页面请求分开执行。配置方式见
[多语言说明](docs/multilingual.md)与[翻译管理说明](docs/translation-admin.md)。

## 检查与构建

```sh
npm test
npm run lint
npm run build
npm start
```

## 来源与许可

基于 [Onur Şuyalçınkaya 的 onur.dev](https://github.com/suyalcinkaya/onur.dev) 开发，保留部分上游组件与样式。

原创代码及修改采用 [MIT 许可证](LICENSE.txt)；保留的上游代码与第三方依赖适用各自条款，详见
[第三方声明](THIRD_PARTY_NOTICES.md)。
