# LINE / WhatsApp 卡片生成器

完整的卡片制作网站，使用 Cloudflare Workers 和 D1 独立运行。
构建与发布不需要 ChatGPT 账号或 Sites 项目。

## 功能

- 首页切换 LINE 与 WhatsApp 分类。
- LINE 模板、卡片编辑、图片上传、收藏和分享。
- WhatsApp 卡片编辑、公开分享页和 Open Graph 链接预览。
- 用户注册、登录、会员、生成额度及管理员后台。
- 图片存储到 D1；配置 `UPLOADS` 后可使用 R2。

WhatsApp 的预览由客户端抓取公开分享页生成。LINE 分享继续使用原项目的
第三方 LIFF 服务。两者在真实聊天客户端中的展示取决于对应平台。

## 本地开发

需要 Node.js 22.13 或更高版本。

```sh
npm ci
npx wrangler d1 migrations apply DB --local --config cloudflare/wrangler.jsonc
npm run dev
```

开发服务器使用独立 Cloudflare 配置及本地 D1 绑定。

## 构建和发布

```sh
npm run build:cloudflare
npm run deploy:cloudflare
```

发布脚本先应用 D1 数据库迁移，再发布完整网站。
当前正式地址：https://line-card-lab.cx931774.workers.dev

向 `main` 推送会触发 GitHub Actions 自动发布，也可以在 Actions 页面手动运行。
新仓库需要配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 两项 Secrets。
详细配置见 [Cloudflare 部署说明](cloudflare/README.md)。

## 管理员和数据

尚无管理员时，在 Worker 配置临时 `ADMIN_SETUP_TOKEN` secret，再通过
`/admin/setup?token=...` 创建管理员；完成后移除该初始化 secret。
管理员后台位于 `/admin`，用户登录位于 `/login`。

本仓库迁入原项目的完整源码和 Git 历史。当前部署继续使用已授权的
`line-card-lab-db` 数据库。原 ChatGPT Sites 的数据库、上传文件和浏览器草稿
需要另行导出，不能通过复制源码恢复。
