# Cloudflare 独立部署

本站使用 Cloudflare Workers 和 D1，构建和发布不需要 ChatGPT 账号。
需要 Node.js 22.13+ 和已授权的 Cloudflare 账号。

## 当前资源

- Worker：`line-card-lab`
- D1：`line-card-lab-db`
- 配置：`cloudflare/wrangler.jsonc`
- 图片：没有 `UPLOADS` R2 绑定时保存到 D1。

独立配置用于开发和正式构建。当前资源 ID 保持不变，重新部署不会新建数据库。
原 ChatGPT Sites 的数据库和上传文件不在此资源中，需要单独取得导出或备份。

## 本地开发

```sh
npm ci
npx wrangler d1 migrations apply DB --local --config cloudflare/wrangler.jsonc
npm run dev
```

## 正式发布

```sh
npm run build:cloudflare
npm run deploy:cloudflare
```

构建脚本关闭不带 Workers 的本机预览模式。
部署脚本先通过来源配置应用远端 D1 迁移，成功后使用构建产物发布完整网站。
构建产物位于 `dist/server` 和 `dist/client`；Wrangler 从
`.wrangler/deploy/config.json` 选择生成的部署配置。

新数据库需要按顺序应用 `drizzle/0000` 到 `0005`。已有数据库使用迁移记录避免
重复执行。数据库迁移与 Worker 发布不是同一个交易，新迁移应兼容上一版网站。

## GitHub 自动发布

新仓库向 `main` 推送时运行 `.github/workflows/deploy-cloudflare.yml`，也可以在
GitHub Actions 手动运行。流程安装锁定依赖、构建、应用迁移并发布。

仓库需要两项 Actions repository secrets：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Token 的授权范围为目标账号的 Workers Scripts Edit、D1 Edit 和
Account Settings Read。不要将凭证写入源码或日志。工作流仅授予
`contents: read`，发布凭证只注入部署步骤。

迁移发布来源后，应停用旧仓库的发布工作流，防止两个仓库覆盖同一个 Worker。
GitHub concurrency 只限制本仓库内的并发发布。

## 管理员

没有管理员时，设置临时 `ADMIN_SETUP_TOKEN` Worker secret，并从
`/admin/setup?token=...` 创建管理员。初始化后移除该 secret。
已有管理员时初始化接口返回 409，不会重复创建。

## 图片

`0005_image_storage` 提供图片元数据和分片表。每片原始数据为 256 KiB；
base64 存储约增加三分之一空间。处理后 JPEG 上传上限 5 MiB，管理员标志
上限 2 MiB。加入 `UPLOADS` R2 绑定后新上传使用 R2，已有 D1 图片仍可读取。
本站直接提供图片，未启用 Cloudflare Images 优化端点。

## 域名

WhatsApp 分享页及图片链接按照访问时的当前域名生成。绑定新的正式域名后，
同步更新 `app/layout.tsx` 的 `metadataBase`。更换 GitHub 仓库不会改变 DNS。

参考 [Cloudflare GitHub Actions 文档](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
和 [GitHub Actions Secrets 文档](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)。
