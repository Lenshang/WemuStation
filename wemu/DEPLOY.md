# WemuStation 局域网部署指南

目标效果：一台机器做服务器（存 ROM + 跑 Node 服务），局域网内任何电脑/设备打开浏览器输入地址即可选游戏、开玩。模拟完全在**各自浏览器**里进行，服务器只负责分发文件，同时几十人玩压力也很小。

```
局域网
┌──────────────┐  ROM 上传/下载   ┌────────────────┐
│ 任何电脑浏览器 │ ◄──────────────► │ 服务器 (Node)    │
│ 手柄 + 模拟运行 │   静态文件/API    │ roms/ + 前端/wasm │
└──────────────┘                  └────────────────┘
```

## 一、服务器准备（Windows）

1. 安装 [Node.js](https://nodejs.org) 20 或更新版本。
2. 把整个 `wemu/` 目录拷到服务器（如 `D:\wemu`），在目录里执行：

```bash
npm install        # 安装依赖
npm run build      # 构建前端（生成 dist/）
npm run gen-cert   # 生成局域网 HTTPS 自签名证书（手柄必需，见下文）
npm start          # 或 npm run server；默认端口 HTTP 4464 / HTTPS 4465
```

启动后控制台会直接打印可用的局域网地址，例如：

```
WemuStation (HTTP)  : http://localhost:4464
                      http://192.168.31.10:4464
WemuStation (HTTPS) : https://localhost:4465  (self-signed)
                      https://192.168.31.10:4465  <- gamepad users should use this
```

3. **Windows 防火墙**放行端口（管理员 PowerShell/CMD 执行一次即可）：

```bat
netsh advfirewall firewall add rule name="WemuStation HTTP" dir=in action=allow protocol=TCP localport=4464
netsh advfirewall firewall add rule name="WemuStation HTTPS" dir=in action=allow protocol=TCP localport=4465
```

4. ROM 放到服务器的 `wemu/roms/<系统>/`（nes/snes/megadrive/pcengine/gba/gb/psx），也可以之后在任何客户端网页里按 F1 拖拽上传（会直接存进服务器对应目录）。

## 二、客户端访问

| 场景 | 地址 | 说明 |
|---|---|---|
| 键盘游玩 | `http://<服务器IP>:4464` | 直接可用 |
| **手柄游玩** | `https://<服务器IP>:4465` | 浏览器规定手柄 API 只在 HTTPS（或 localhost）开放，必须走这个 |

首次打开 HTTPS 地址会看到证书警告（自签名证书的必然现象）：

- **推荐做法（一次性，警告永久消失）**：把服务器上 `wemu/certs/cert.pem` 拷到客户端电脑，双击 →「安装证书」→ 存储位置选「本地计算机」→「将所有的证书都放入下列存储」→ 浏览选择「**受信任的根证书颁发机构**」→ 完成，重启浏览器。之后 HTTPS 地址直接打开、手柄即插即用。
- 临时做法：警告页点「高级」→「继续前往」（每次都要点，且部分浏览器对 IP 自签名拦截较死，不推荐）。
- 手机/平板/不信任证书的设备：用 HTTP 地址，键盘可玩，手柄不可用。

> 证书 SAN 已包含生成时服务器的所有局域网 IP；服务器更换 IP 后重新执行 `npm run gen-cert` 并重装客户端证书即可。

## 三、开机自启（可选）

**Windows 计划任务**（管理员执行，替换实际路径）：

```bat
schtasks /create /tn WemuStation /tr "cmd /c cd /d D:\wemu && npm run server" /sc onstart /ru SYSTEM /rl highest
```

**Linux 服务器**（systemd，`/etc/systemd/system/wemustation.service`）：

```ini
[Unit]
Description=WemuStation
After=network.target

[Service]
WorkingDirectory=/opt/wemu
ExecStart=/usr/bin/node server/index.js
Restart=always
Environment=PORT=4464 HTTPS_PORT=4465

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now wemustation
```

## 四、多台电脑一起玩

- **互不影响**：每台浏览器的模拟独立运行，服务器只发文件。8/16 位机对客户端 CPU 要求很低，老笔记本也流畅。
- **ROM 管理**：任何客户端按 F1 上传的 ROM 直接进入服务器 `roms/` 目录，所有人刷新后可见。
- **存档**：存档/即时存档/RA 配置保存在**各台设备自己的浏览器** IndexedDB 里（同一台电脑同一浏览器下次继续有效）。不同设备之间暂不互通，如需要可后续加服务端存档同步。
- **配置**：主题/引擎（`server/config.json`）是全局的，改动后重启服务生效。

## 五、常见问题

| 现象 | 原因与处理 |
|---|---|
| 局域网电脑打不开页面 | 服务器防火墙未放行（见上文 netsh 命令）；或服务器 IP 变了（建议在路由器里给服务器固定 IP） |
| 手柄连上了但页面没反应 | 用了 HTTP 地址——浏览器限制，改用 HTTPS 地址并信任证书 |
| HTTPS 提示「您的连接不是专用连接」 | 自签名证书未受信任，按第二节安装 `cert.pem` |
| 上传大 ROM（PS1 bin）较慢 | 走的局域网带宽，建议打成 zip 上传（核心内自动解压） |
| 游戏卡顿 | 客户端性能问题而非服务器：换 Chrome/Edge、关闭其他标签页；PS1 建议在 RA 菜单里降低内部分辨率 |

## 六、安全提示

自部署方案默认面向**可信局域网**（家庭/办公室），没有用户登录体系——任何能访问该地址的人都可以浏览/上传 ROM、游玩。如需暴露到公网，请自行加反向代理 + 认证（如 Caddy/Nginx basic auth），并替换为正式域名证书。
