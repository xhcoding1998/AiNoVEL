# 笔来 部署文档

本文档供在 Linux 服务器上部署 笔来 项目使用，可交由 AI 或自动化脚本执行。

---

## 一、服务器环境要求

- **操作系统**: Linux (Ubuntu 20.04+ / Debian 11+ / CentOS 8+)
- **Node.js**: 18+ (用于 npm 构建前端)
- **Bun**: 1.0+ (后端运行时)
- **PostgreSQL**: 14+
- **Nginx**: 可选，用于反向代理和静态资源

---

## 二、环境安装

### 2.1 安装 Node.js (LTS)

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 或使用 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

### 2.2 安装 Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version
```

### 2.3 安装 PostgreSQL

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# 启动 PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2.4 安装 Nginx (可选)

```bash
sudo apt-get install -y nginx
```

---

## 三、创建数据库

```bash
# 切换到 postgres 用户
sudo -u postgres psql

# 在 psql 中执行
CREATE DATABASE ainovel;
CREATE USER ainovel_user WITH ENCRYPTED PASSWORD '你的数据库密码';
GRANT ALL PRIVILEGES ON DATABASE ainovel TO ainovel_user;
\c ainovel
GRANT ALL ON SCHEMA public TO ainovel_user;
\q
```

---

## 四、项目部署

### 4.1 克隆或上传项目

```bash
# 假设项目部署在 /var/www/ainovel
sudo mkdir -p /var/www/ainovel
cd /var/www/ainovel

# 若使用 git
# git clone <你的仓库地址> .
# 或直接上传项目文件到该目录
```

### 4.2 后端配置与启动

```bash
cd /var/www/ainovel/backend

# 安装依赖
bun install

# 创建 .env 文件
cat > .env << 'EOF'
DATABASE_URL=postgresql://ainovel_user:你的数据库密码@localhost:5432/ainovel
JWT_SECRET=请替换为随机长字符串用于JWT签名
PORT=3000
EOF

# 运行数据库迁移
bun run migrate

# 启动后端 (开发模式，可后台运行)
nohup bun run dev > backend.log 2>&1 &
```

**生产环境建议使用 PM2 管理进程：**

```bash
# 安装 PM2
npm install -g pm2

# 创建 ecosystem.config.cjs (在 backend 目录)
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'ainovel-api',
    cwd: '/var/www/ainovel/backend',
    script: 'src/index.js',
    interpreter: 'bun',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
EOF

# 启动
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### 4.3 前端构建与部署

```bash
cd /var/www/ainovel/frontend

# 安装依赖
npm install

# 构建生产版本
# 若前后端同域（Nginx 将 /api 代理到后端），使用：
#   VITE_API_URL=/api npm run build
# 若 API 在独立域名，使用：
#   VITE_API_URL=https://api.你的域名.com npm run build
npm run build

# 构建产物在 frontend/dist 目录
```

### 4.4 静态资源托管

**方式 A：使用 Nginx 托管前端 + 反向代理 API**

```bash
sudo nano /etc/nginx/sites-available/ainovel
```

写入以下配置（替换 `你的域名` 和 `你的SSL证书路径`）：

```nginx
server {
    listen 80;
    server_name 你的域名;

    # 若使用 HTTPS，取消下面注释并配置证书
    # listen 443 ssl http2;
    # ssl_certificate /path/to/fullchain.pem;
    # ssl_certificate_key /path/to/privkey.pem;

    root /var/www/ainovel/frontend/dist;
    index index.html;

    # 前端 SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用站点并重载 Nginx：

```bash
sudo ln -s /etc/nginx/sites-available/ainovel /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**方式 B：前后端同域**

前端构建时设置 `VITE_API_URL` 为空或 `/api`，由 Nginx 将 `/api` 转发到后端 3000 端口，前端请求 `/api/xxx` 即可。

---

## 五、环境变量汇总

| 变量 | 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:pass@localhost:5432/ainovel` |
| `JWT_SECRET` | JWT 签名密钥，建议 32+ 随机字符 | `openssl rand -hex 32` 生成 |
| `PORT` | 后端监听端口 | `3000` |
| `VITE_API_URL` | 前端请求的 API 前缀（构建时） | `https://api.example.com` 或留空 |

---

## 六、部署检查清单

```bash
# 1. 检查 PostgreSQL
sudo -u postgres psql -c "\l" | grep ainovel

# 2. 检查后端
curl http://localhost:3000/api/health

# 3. 检查前端
curl -I http://localhost/

# 4. 检查 PM2 (若使用)
pm2 status
```

---

## 七、常见问题

### 7.1 数据库连接失败

- 确认 PostgreSQL 已启动：`sudo systemctl status postgresql`
- 确认 `pg_hba.conf` 允许本地连接
- 确认 `DATABASE_URL` 用户名、密码、数据库名正确

### 7.2 前端请求 404 或跨域

- 确认 Nginx 中 `location /api` 正确代理到后端
- 确认前端构建时 `VITE_API_URL` 与最终访问的 API 地址一致

### 7.3 迁移失败

- 确认数据库已创建且用户有权限
- 可手动执行 `backend/src/db/migrations/001_init.sql`

---

## 八、一键部署脚本示例

可将以下内容保存为 `deploy.sh`，赋予执行权限后运行：

```bash
#!/bin/bash
set -e

PROJECT_DIR="/var/www/ainovel"
cd "$PROJECT_DIR"

echo ">>> 安装后端依赖..."
cd backend && bun install && cd ..

echo ">>> 运行数据库迁移..."
cd backend && bun run migrate && cd ..

echo ">>> 构建前端..."
cd frontend && npm install && npm run build && cd ..

echo ">>> 重启后端..."
cd backend && pm2 restart ainovel-api || pm2 start ecosystem.config.cjs

echo ">>> 重载 Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo ">>> 部署完成"
```
