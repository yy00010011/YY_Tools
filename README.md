# 🔀 Git Visualizer

Git 仓库可视化管理工具 — 一个桌面风格的 Web 应用，连接本地 Git 仓库，提供：

- 📊 **SVG 提交图谱** — 分支/合并可视化，自动分配颜色轨道
- 🌿 **分支管理** — 创建、切换、合并、删除分支
- 📦 **暂存区工作流** — stage / unstage / discard + commit
- 🔍 **Diff 查看器** — 按文件展开，增删行高亮
- 📤 **远程推送** — 显示未推送提交数，一键 push

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [Git](https://git-scm.com/)（命令行可用）

### 安装与运行

```bash
# 安装所有依赖
npm run install:all

# 开发模式（前端热更新 + 后端 API）
npm run dev
# 然后打开 http://localhost:3000

# 生产模式
npm run build
npm start
# 然后打开 http://localhost:3001
```

也可以分别启动：

```bash
# 终端 1：启动后端
cd server && npm start

# 终端 2：启动前端开发服务器
cd client && npm start
```

### Windows 用户

直接双击 `start.bat` 即可自动安装依赖、构建并启动服务。

## 项目结构

```
git-visualizer/
├── client/                 # React 18 前端
│   ├── src/
│   │   ├── App.jsx         # 主应用组件
│   │   ├── components/     # UI 组件
│   │   │   ├── CommitGraph.jsx   # SVG 提交图谱
│   │   │   ├── CommitDetail.jsx  # 提交详情 + diff
│   │   │   ├── StageArea.jsx     # 暂存区工作流
│   │   │   ├── BranchOps.jsx     # 分支操作
│   │   │   ├── RepoInput.jsx     # 仓库路径输入
│   │   │   └── ConfirmModal.jsx  # 确认对话框
│   │   ├── hooks/
│   │   │   └── useGitAction.js   # 通用 Git 操作 hook
│   │   └── styles/
│   │       └── app.css           # 全局样式（深色主题）
│   └── webpack.config.js
├── server/                 # Express 4 后端
│   └── src/
│       ├── index.ts        # API 路由 + 安全校验
│       ├── gitService.ts   # Git 命令封装（execFileSync）
│       ├── types.ts        # 共享类型定义
│       └── logger.ts        # 轻量日志
└── package.json            # 根 workspace 脚本
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/repo/info?path=` | 验证仓库路径 |
| GET | `/api/git/log?path=&max=&skip=` | 获取提交历史 + 分支/标签 |
| GET | `/api/git/diff?path=&hash=` | 获取某次提交的 diff |
| GET | `/api/git/status?path=` | 获取工作区文件状态 |
| POST | `/api/git/stage` | 暂存文件 `{ path, files }` |
| POST | `/api/git/unstage` | 取消暂存 `{ path, files }` |
| POST | `/api/git/discard` | 丢弃变更 `{ path, files }` |
| POST | `/api/git/commit` | 提交 `{ path, message, all? }` |
| POST | `/api/branch/create` | 创建分支 `{ path, name }` |
| POST | `/api/branch/switch` | 切换分支 `{ path, name }` |
| POST | `/api/branch/merge` | 合并分支 `{ path, name }` |
| POST | `/api/branch/delete` | 删除分支 `{ path, name, force? }` |
| GET | `/api/git/unpushed-count?path=` | 领先远程的提交数 |
| POST | `/api/git/push` | 推送 `{ path, remote?, branch? }` |
| GET | `/api/git/tree?path=&hash=` | 文件树 |
| GET | `/api/git/file?path=&hash=&file=` | 文件内容 |
| GET | `/api/git/diff-unstaged?path=` | 未暂存 diff |
| GET | `/api/git/diff-staged?path=` | 已暂存 diff |

## 安全配置

通过环境变量控制访问：

- `ALLOWED_ROOTS` — 允许访问的仓库根目录（用系统路径分隔符分隔），留空则允许所有路径
- `CORS_ORIGINS` — 允许的跨域来源（逗号分隔），默认 `http://localhost:3000,http://127.0.0.1:3000`
- `PORT` — 服务端口，默认 `3001`
- `LOG_LEVEL` — 日志级别（debug / info / warn / error），默认 `info`

## 运行测试

```bash
# 后端测试
cd server && npx jest

# 前端测试
cd client && npx jest
```

## 技术栈

- **前端**：React 18 · Webpack 5 · Babel · CSS（深色主题）
- **后端**：Express 4 · TypeScript（严格模式）
- **Git 调用**：`child_process.execFileSync`（参数数组，无 shell 注入风险）
- **测试**：Jest 30 · ts-jest

## 许可

MIT
