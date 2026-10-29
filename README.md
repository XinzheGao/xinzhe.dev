# xinzhe.dev

[Xinzhe 的个人站点](https://xinzhe.dev)，用于发布文章、作品、随想与旅程。使用 Next.js 16 App Router、React 19、Tailwind
CSS 4 和 Notion，支持中英日多语言与翻译管理。

## 导航与内容对应

左侧导航由 `src/lib/navigation.mjs`
定义，允许读取的 Notion 页面和站点地图都使用这份配置；页面正文及描述只在 Notion 中维护。

| 导航 | 路径                            | 内容来源                                                            |
| ---- | ------------------------------- | ------------------------------------------------------------------- |
| 首页 | `/`                             | Notion「导航页面」的 `home` 正文＋文章库的已发布文章                |
| 文章 | `/writing`、`/writing/[slug]`   | Notion「文章」库；栏目简介来自导航页面的 `writing`                  |
| 作品 | `/projects`、`/projects/[slug]` | Notion「作品库」；栏目简介来自导航页面的 `projects`                 |
| 随想 | `/thoughts`、`/thoughts/[slug]` | Notion「随想库」；栏目简介来自导航页面的 `thoughts`                 |
| 旅程 | `/journey`                      | Notion「旅程」库；栏目简介来自导航页面的 `journey`                  |
| 关于 | `/about`                        | Notion「导航页面」的 `about` 正文，同一页包含「关于我」「关于本站」 |

Notion 的导航页面默认视图也按以上顺序显示六项。「关于」为正文单页，没有二级列表；原收藏条目在 Notion 中归档保留，网站已删除旧收藏页面、RSS 与接口代码，旧地址返回 404。技术栈、工作空间仍归档，旧地址转到首页。头像、社交链接等个人资料仍在
`src/lib/site.js` 中维护。

## Notion 后台

[打开新版内容后台](https://www.notion.so/4062f6e1253b8198b354d17ef013e815)

| 数据库   | 数据源 ID                              |
| -------- | -------------------------------------- |
| 文章     | `5450b578-e312-44fd-b431-e8c2e43f36f8` |
| 随想库   | `43203c99-ea47-41d7-bd13-9953c14b2357` |
| 作品库   | `b7c54199-6549-4162-a009-8457edb0a5cb` |
| 导航页面 | `991f7575-565e-4821-bbcc-631218e318dd` |
| 旅程     | `390f6b41-8754-46a3-8aec-117e273222ff` |

网站使用 Notion 的数据源 API 和递归分页读取正文块。实现位置是 `src/lib/notion-client.mjs`、`src/lib/content.js` 和
`src/components/notion-content.js`。网站仅使用 Notion 内容接口；通用代码块组件位于 `src/components/code-block.js`。

### 配置与启动

1. 使用 Node.js 24.22.1（`.nvmrc` / `.node-version`）和 npm 12.2.1，运行 `npm ci` 安装锁定依赖，参考 `.env.example` 在
   `.env.local` 添加 Notion 配置。不要提交密钥。
2. 创建有读取内容权限的 Notion 集成，将密钥填入
   `NOTION_API_TOKEN`。在新版后台页面的「连接」中添加该集成，确保五个数据库可读。聊天中的 Notion 插件授权不会自动成为网站凭据。
3. 数据源 ID 已有默认值，也可通过五个 `NOTION_*_DATA_SOURCE_ID` 环境变量覆盖。
4. 设置随机的 `NOTION_PREVIEW_SECRET` 和 `NEXT_REVALIDATE_SECRET`。`NEXT_PUBLIC_SITE_URL` 默认使用
   `https://xinzhe.dev`，可通过环境变量覆盖。
5. 运行 `npm run dev`；构建使用 `npm run build`。修改环境变量后重新启动；生产环境须重新构建部署。

缺少 `NOTION_API_TOKEN`
时，不展示本地备用正文或描述，文章、作品、随想和旅程列表为空，未发布或不存在的详情返回 404。配置了密钥后，权限或 API 错误会明确报错，不会伪装成成功读取。

### 写作与发布

- 随想与文章布局一致：在「随想库」新建页面，每篇随想一条记录；填写标题、链接名、发布日期和状态，正文直接写在页面里。详情地址为
  `/thoughts/链接名`，导航页面的 `thoughts`
  只管理栏目简介和 SEO 标题。旧随想导航页正文保留在 Notion 中。草稿预览路径可使用
  `/api/draft?secret=预览密钥&slug=/thoughts/随想链接名`。

- 作品与文章布局一致：在「作品库」新建页面，每个作品一条记录，填写标题、链接名、发布日期和状态，正文直接写在页面里。作品详情地址为
  `/projects/链接名`；导航页面的 `projects`
  只管理栏目简介和 SEO 标题。旧作品导航页正文保留在 Notion 中，不再作为作品列表正文。草稿预览路径可使用
  `/api/draft?secret=预览密钥&slug=/projects/作品链接名`。

- 正文直接在 Notion 页面里写。段落、标题、嵌套列表、引用、代码、图片、勾选、折叠和表格可渲染；视频、PDF、附件和嵌入展示为链接，公式暂以源码显示。其他不支持的块会出现提示。
- 所有内容默认是草稿。公开页面只读取「已发布」，排除归档、回收站记录。文章、作品和随想还必须有标题、合法且唯一的链接名及手选发布日期；未来日期在对应的上海日历日期之前不公开。旅程必须填写发生日期。
- 首页与关于的正文来自导航页面；在「关于」（链接名
  `about`）的页面正文中维护「关于我」「关于本站」两个部分，保持状态为「已发布」。文章、作品、随想、旅程四条导航记录只提供 SEO 标题和简介，正文由对应列表生成。导航名称保持统一，单独的 SEO 标题可选填。
- 全站默认描述在「导航页面」→「首页」的「全站默认描述」字段维护，用于全站 SEO、默认分享卡片和缺少摘要的文章。六个栏目的简介在各自记录的「摘要」中维护；摘要留空时使用 Notion 全站默认描述。首页记录须为「已发布」才能在公开网站使用，草稿仅在预览中读取。代码不再保留备用描述或正文；全站默认描述留空时不生成备用文案。
- 普通 Notion 更新通过 60 秒缓存重新验证；必要时调用 `/api/revalidate?secret=密钥&path=/`
  清理 Notion 内容缓存。已打开的浏览器需刷新页面。
- 首页文章右侧的阅读时长自动从完整正文估算，显示为
  `5 min`：默认每分钟 300 个中日韩字符、200 个其他语言单词，混合内容按耗时相加并向上取整，空正文不显示。通用函数位于
  `src/lib/reading-time.mjs`，支持纯文本或递归加载的 Notion 正文块。正文和计算结果按文章 ID、最后编辑时间一起缓存，首页和详情共用；缓存命中时不重新请求正文。修改文章或手动清理
  `notion-content` 缓存后重新计算，草稿预览不写入公开缓存。
- 用 `/api/draft?secret=预览密钥&slug=/writing/文章链接名`
  进入草稿预览，预览请求不缓存。首页文章列表也能显示草稿；缺少发布日期的草稿只在预览中使用创建日期。调用
  `/api/disable-draft` 退出。
- RSS 和站点地图始终只使用公开内容，不受草稿预览影响。
- 「发布前检查」视图检查缺少链接名或发布日期，重复链接名由网站读取时拒绝。

### 其他服务

阅读统计可选，需要 `.env.example`
中的 Supabase 配置；没有凭据时页面仍可显示，统计 API 返回 503。服务角色密钥只能放在服务端。Tinybird 分析也可选。

## 主题与界面语言

主侧栏及移动导航抽屉的左下角提供双横线、圆形滑块设置入口，菜单优先向上展开。紧凑菜单固定先显示语言、再显示外观及当前值；桌面端通过 Radix
Dropdown
Menu 展开级联选项，支持悬停、点击、方向键、Enter 和 Space，浮层自动避让视口。移动端、窄窗口或触屏设备在同一菜单内显示选项及返回入口。Escape 逐层关闭，点击外部或选定选项关闭整个菜单。主题默认跟随系统，也可选浅色或深色；语言默认简体中文，可选 English 和日本語。

主题偏好保存在本站 Cookie（`site-theme`，有效期一年），语言由当前 URL 确定，刷新后仍保留对应语言。根布局读取后提供给 React
Context。服务端首屏与客户端使用同一偏好；System 模式由 CSS 媒体查询直接响应，无需等待 JavaScript 设置主题。现有 `dark:`
样式统一复用 Tailwind 的主题变体；菜单使用轻量的 `@radix-ui/react-dropdown-menu`，主题与语言沿用已有状态管理。

界面词典在 `src/lib/i18n.mjs`，增加语言时同步扩展 `LOCALES` 和 `messages`；`npm test`
会检查词条和插值参数的一致性。导航、身份简介、栏目标题、日期、操作按钮和空状态等使用词典。Notion 保留中文原文；首页介绍、关于正文、文章、作品、随想、旅程及 SEO 的外语版本由独立翻译任务生成，网页请求只读取已保存译文。人工修订与锁定通过翻译管理后台维护。

## 依赖与环境

项目使用 npm，`package-lock.json` 是唯一依赖锁文件。已迁移到 Next.js 16 的异步草稿/路由参数、`proxy.js`、ESLint flat
config 和 Tailwind 4 PostCSS 插件；保留原有主题配置与样式语义。Node.js 的系统依赖由 Homebrew 管理。

ESLint 使用 10.13.0。由于当前 `eslint-plugin-import`、`eslint-plugin-react` 和 `eslint-plugin-jsx-a11y`
的 peer 范围尚不包含 ESLint 10，项目在 `package.json` 中通过定向 `overrides`
让这三个插件使用直接声明的 ESLint 版本；其他依赖仍正常检查。当前配置与源码已通过 ESLint
10 检查，后续启用新规则时仍需验证兼容性。上游正式支持后应移除覆盖配置。其他直接依赖按升级时 npm `latest` 稳定标签更新。

## 验证

```sh
npm test
npm run lint
npm run build
```

测试覆盖发布状态、日期和时区、归档、链接名冲突、导航范围、API 分页、正文嵌套、预览缓存、错误暴露与限流重试。模拟 API 测试不代表已经验证真实 Notion 集成；真实读取需要上述密钥与连接权限。

## 多语言与 AI 翻译

中文保持原 URL，英文和日文使用 `/en`、`/ja`。Notion 是唯一中文源，译文在独立后台任务生成，访问页面只读取持久化结果。

架构、单篇验证、批量门槛、人工锁定、任务状态和 GitHub Actions/Vercel 配置见 [多语言说明](docs/multilingual.md)。

## 部署与迁移

当前仓库为 [XinzheGao/xinzhe.dev](https://github.com/XinzheGao/xinzhe.dev)，Vercel 项目为
`xinzhe-dev`。部署准备、验收结果与正式域名切换步骤见 [上线说明](docs/deployment.md)。

## 项目来源与许可

作者：Xinzhe。本站基于 [Onur Şuyalçınkaya 的 onur.dev](https://github.com/suyalcinkaya/onur.dev)
开始开发，现已重做内容后台、导航、个人资料及多语言与翻译管理等功能，仍保留部分原项目组件与样式。

Xinzhe 的原创代码及修改采用 [MIT 许可证](LICENSE.txt)，Copyright (c) 2026
Xinzhe。保留的上游代码与第三方依赖仍适用各自的许可条款；来源与上游原始许可说明见 [第三方声明](THIRD_PARTY_NOTICES.md)。
