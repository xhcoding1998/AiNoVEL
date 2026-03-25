import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('159.75.129.108', port=22, username='root', password='xhCoder1998...',
            allow_agent=False, look_for_keys=False, timeout=30)

def run(cmd):
    _, o, e = ssh.exec_command(cmd, timeout=30)
    out = o.read().decode('utf-8', errors='replace')
    err = e.read().decode('utf-8', errors='replace')
    if out: print(out)
    if err: print('[err]', err)

BUN = '/root/.bun/bin/bun'
APP = '/code/AiNoVEL'

# 杀掉所有 bun 进程
run("pkill -9 -f 'bun src/index.js' || true")
import time; time.sleep(2)
run("ps aux | grep bun | grep -v grep")

# 重启
run(f'cd {APP}/backend && setsid {BUN} src/index.js > /tmp/ainovel.log 2>&1 &')
time.sleep(3)
run('curl -s http://localhost:3000/api/health')

ssh.close()
print('完成')
