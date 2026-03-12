# AI Novel - 智能小说创作平台

## 技术栈

- **前端**: Vue 3 (Composition API) + Vite + Pinia + Vue Router + 自研 Vercel 风格组件库
- **后端**: Bun + Hono + PostgreSQL (postgres.js)
- **关系图**: @dagrejs/dagre + SVG
- **AI**: 兼容 OpenAI 协议的可配置接口

## 快速开始

### 1. 安装依赖

```bash
# 前端
cd frontend && npm install

# 后端
cd backend && bun install
```

### 2. 配置数据库

确保 PostgreSQL 已运行，然后编辑 `backend/.env`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ainovel
JWT_SECRET=your-secret-key
PORT=3000
```

创建数据库并运行迁移:

```bash
createdb ainovel
cd backend && bun run migrate
```

### 3. 启动开发服务器

```bash
# 后端 (端口 3000)
cd backend && bun run dev

# 前端 (端口 5173)
cd frontend && npm run dev
```

访问 http://localhost:5173

## 项目结构

```
AINovel/
├── frontend/          # Vue 3 SPA
│   └── src/
│       ├── components/ui/     # Vercel 风格组件库
│       ├── components/novel/  # 7 大类物料编辑器
│       ├── components/graph/  # 关系图可视化
│       ├── views/             # 页面
│       ├── stores/            # Pinia 状态管理
│       ├── api/               # API 封装
│       └── styles/            # 全局样式
├── backend/           # Bun + Hono 后端
│   └── src/
│       ├── routes/            # API 路由
│       ├── db/                # 数据库连接 + 迁移
│       ├── middleware/        # JWT 认证
│       └── services/          # AI 服务 + 物料编译
└── README.md
```
