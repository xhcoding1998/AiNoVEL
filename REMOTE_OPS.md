# 远程服务器运维手册（AI 操作指南）

> 本文档记录生产服务器的实际配置，AI 可直接按本文档执行操作，无需额外询问。

---

## 一、服务器信息

| 项目 | 值 |
|------|-----|
| IP | `159.75.129.108` |
| 用户 | `root` |
| 项目路径 | `/code/AiNoVEL` |
| 前端 dist | `/code/AiNoVEL/frontend/dist` |
| 后端入口 | `/code/AiNoVEL/backend/src/index.js` |
| 后端日志 | `/tmp/ainovel-backend.log` |
| bun 路径 | `/root/.bun/bin/bun` |
| 数据库连接 | `postgresql://ainovel_user:ainovel2024@localhost:5432/ainovel` |
| 后端端口 | `3000` |
| 健康检查 | `curl http://localhost:3000/api/health` |

---

## 二、SSH 连接方式（Python paramiko）

由于 Windows 环境下 ssh 命令不支持密码参数，统一使用 Python paramiko 库连接。

```python
import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('159.75.129.108', port=22, username='root', password='服务器密码',
               timeout=15, allow_agent=False, look_for_keys=False)

stdin, stdout, stderr = client.exec_command('your command here')
print(stdout.read().decode('utf-8', errors='replace'))

client.close()
```

> **注意**：输出内容统一用 `decode('utf-8', errors='replace')` 避免 Windows GBK 编码报错。

---

## 三、标准操作流程

### 3.1 拉取最新代码

```bash
cd /code/AiNoVEL && git pull
```

### 3.2 执行数据库迁移

```bash
psql "postgresql://ainovel_user:ainovel2024@localhost:5432/ainovel" -c "SQL语句"
```

或运行完整迁移脚本（会执行所有 migrations/ 下的 .sql 文件）：

```bash
cd /code/AiNoVEL/backend && /root/.bun/bin/bun run migrate
```

### 3.3 构建前端

```bash
cd /code/AiNoVEL/frontend && /root/.bun/bin/bun run build
```

构建产物自动输出到 `/code/AiNoVEL/frontend/dist`，Nginx 直接读取，**无需额外操作**。

### 3.4 重启后端

```bash
# 找到当前 bun 进程 PID
ps aux | grep "bun src/index" | grep -v grep

# 杀掉旧进程（替换为实际 PID）
kill <PID>

# 后台重新启动
setsid bash -c "cd /code/AiNoVEL/backend && /root/.bun/bin/bun src/index.js > /tmp/ainovel-backend.log 2>&1" &

# 等待 3 秒后验证
sleep 3 && curl http://localhost:3000/api/health
```

---

## 四、一次完整部署（代码有更新时）

按顺序执行以下步骤：

```
1. git pull
2. 数据库迁移（如有新迁移文件）
3. 构建前端：bun run build
4. 重启后端
5. 健康检查：curl http://localhost:3000/api/health
```

---

## 五、AI 执行模板（Python 脚本）

每次操作时，在本地创建临时 `.py` 文件，执行完后删除。

```python
import paramiko, sys, time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('159.75.129.108', port=22, username='root', password='服务器密码',
               timeout=15, allow_agent=False, look_for_keys=False)

BUN = '/root/.bun/bin/bun'
DB  = 'postgresql://ainovel_user:ainovel2024@localhost:5432/ainovel'

def run(cmd, wait=True):
    print(f'\n>>> {cmd}')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=180)
    if wait:
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        if out: print(out)
        if err: print('ERR:', err)

# -------- 在此填写操作 --------
run('cd /code/AiNoVEL && git pull')
# run(f'psql "{DB}" -c "ALTER TABLE ..."')
# run(f'cd /code/AiNoVEL/frontend && {BUN} run build')
# 重启后端见 3.4 节
# ------------------------------

client.close()
print('\nDone!')
```

---

## 六、常用排查命令

```bash
# 查看后端日志
tail -50 /tmp/ainovel-backend.log

# 查看后端进程
ps aux | grep "bun src/index" | grep -v grep

# 健康检查
curl http://localhost:3000/api/health

# 查看 Nginx 状态
systemctl status nginx

# 查看 Nginx 配置
cat /etc/nginx/sites-enabled/*

# 查看数据库表结构
psql "postgresql://ainovel_user:ainovel2024@localhost:5432/ainovel" -c "\d users"

# 查看迁移文件列表
ls /code/AiNoVEL/backend/src/db/migrations/
```

---

## 七、注意事项

1. **前端构建**：服务器没有 `node`/`npm`，统一用 `/root/.bun/bin/bun run build` 构建前端。
2. **后端进程管理**：服务器未安装 PM2，后端用 `setsid` 后台运行，重启需手动 kill 旧进程再启动。
3. **bun 不在 PATH**：SSH 登录时 `~/.bun/bin` 不在 PATH 中，必须使用完整路径 `/root/.bun/bin/bun`。
4. **迁移文件命名**：按 `00N_描述.sql` 格式递增命名，迁移脚本按文件名排序执行，已执行过的会重复执行（使用 `IF NOT EXISTS` 保证幂等）。
5. **临时脚本清理**：操作完成后删除本地临时 `.py` 文件，避免密码泄露。
