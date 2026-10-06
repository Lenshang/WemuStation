# WemuStation

网页版复古游戏主机前端：ES-DE 风格的 SDL 级界面 + RetroArch WASM 完整后端。浏览器打开即玩，手柄全程操作，存档跟随账号在所有设备间同步。

- **双引擎**：RetroArch（完整快速菜单：着色器 / 遮罩 / 金手指 / 倒带 / 重映射）+ EmulatorJS（轻量备选）
- **中文 RA 菜单**：全部核心启用 `HAVE_LANGEXTRA` 自编译，含简体中文
- **手柄即插即玩**：浏览器索引漂移自动归一化（永远绑定端口 1），Select+X 呼出菜单、Select+Start 退出
- **存档云同步**：存档 / 即时存档 / RA 配置存服务器 SQLite，30 秒自动推送 + 退出时冲刷
- **游戏列表**：← → 翻页、拼音首字母搜索（如 `hdl` → 魂斗罗、`qh97` → 拳皇97）
- **街机支持**：FBN（含 Neo Geo / CPS1/2/3）+ MAME 2003 Plus，自动从 `bios/` 装载 Neo Geo 等 BIOS

## 支持平台

NES · SNES · Mega Drive · PC Engine · GBA · GB · GBC · Game Gear · PS1 · 3DO ·
街机（FBNeo / Neo Geo / CPS1 / CPS2 / CPS3 / MAME 2003+）· DOS（DOSBox Pure）·
Atari 2600 / 5200 / 7800 · WonderSwan / Color · Neo Geo Pocket / Color · Virtual Boy · Game & Watch

## Docker 部署（推荐）

镜像发布在 GHCR，推送到 `main` 自动构建。

```bash
mkdir -p roms data && docker compose up -d
```

`docker-compose.yml`：

```yaml
services:
  wemustation:
    image: ghcr.io/lenshang/wemustation:latest
    container_name: wemustation
    ports:
      - "4464:4464"     # Web 界面（HTTP）
      # - "4465:4465"   # HTTPS（挂载 certs 后自动启用）
    environment:
      PORT: "4464"
      ROM_DIR: "/app/roms"
      DATA_DIR: "/app/data"
    volumes:
      - ./roms:/app/roms
      - ./data:/app/data
      # - ./config.json:/app/server/config.json   # 持久化主题/引擎设置
      # - ./certs:/app/certs                      # HTTPS（局域网手柄需要）
    restart: unless-stopped
```

打开 `http://服务器IP:4464` 即可。

### 数据卷说明

| 挂载点 | 内容 | 说明 |
|---|---|---|
| `/app/roms` | 游戏库 | R36S / ES-DE 目录结构；`bios/` 子目录放 BIOS（neogeo.zip、scph*.bin 等，启动时自动装载） |
| `/app/data` | SQLite 数据库 | 存档 / 即时存档 / RA 配置，务必持久化 |
| `/app/server/config.json` | 站点设置 | 主题、默认引擎（写入该文件，不挂载则重建容器后丢失） |
| `/app/certs` | HTTPS 证书 | `gen-cert` 生成；不挂载则仅 HTTP |

ROM 目录结构示例（每个系统一个文件夹，支持嵌套与 gamelist.xml 元数据）：

```
roms/
├── nes/          # .nes .fds .zip
├── snes/         # .sfc .smc .zip
├── fbneo/        # 街机 ROM zip（需匹配 FBN romset）
├── neogeo/
├── mame/         # MAME 2003+ romset
├── gba/ gb/ gbc/ gamegear/ megadrive/ pcengine/ psx/ ...
└── bios/         # neogeo.zip pgm.zip scph1001.bin gb_bios.bin ...
```

**文件夹命名随意**：每个系统定义了常见别名，大小写不敏感，多个目录自动合并扫描。例如
`FC`、`Famicom`、`FamilyComputer`、`nes` 都会并入 NES；`SFC`/`SuperFamicom` → SNES；
`MD`/`Genesis` → Mega Drive；`PCE`/`TG16` → PC Engine；`PS1`/`PlayStation` → PSX；
`FBA`/`Arcade` → 街机；`MAME4all`/`MAME2003Plus` → MAME。完整别名表见
`wemu/server/lib/systems.js` 的 `aliases` 字段，按需可自行追加。

**支持 Pegasus 元数据**：目录内没有 `gamelist.xml` 但有 `metadata.pegasus.txt`（或
`metadata.txt`）时自动解析——游戏名、描述、开发商、厂商、日期、评分，以及
`assets.box_front` / `assets.screenshot` / `assets.logo` 媒体字段。两种元数据同时存在时
`gamelist.xml` 优先。目录名允许系统别名前缀（如 `FBNEO ACT hack`、`SFC-MSU1`、`PS1 hack`
分别归入 FBN / SNES / PSX）。

## 本地开发

```bash
cd wemu
npm install
npm run dev        # Node 服务(4464) + Vite 热更新(5173)
npm run build      # 前端产物 → dist/
npm run gen-cert   # 生成自签 HTTPS 证书（局域网手柄需要，浏览器信任一次）
```

ROM 放 `wemu/roms/<系统id>/`，或运行后按 F1 网页导入。

## 操作

| 动作 | 键盘 | 手柄 |
|---|---|---|
| 移动 / 翻页 | 方向键 / WASD，←→ 翻页 | 十字键 / 左摇杆 |
| 确定 / 运行 | Enter / Space / X | A |
| 返回 | Esc | B |
| 搜索（列表内） | F | Y |
| 主菜单 | F1 / Tab | Start |
| 设置 | F2 | — |
| RA 菜单（游戏内） | F1 / Select+X | Select+X |
| 退出游戏（游戏内） | Esc | Select+Start 双击 |

## 从源码构建镜像

```bash
docker build -t wemustation .
docker run -d -p 4464:4464 -v "$PWD/roms:/app/roms" -v "$PWD/data:/app/data" wemustation
```

### 重新编译 RetroArch 核心（可选）

`wemu/retroarch/` 内是静态链接好的 RetroArch WASM（每核心一份，含 HAVE_LANGEXTRA 中文菜单）。仓库不包含构建工具链；`build-tools/`（不随仓库分发）内含 emsdk、RetroArch 源码与核心仓库，`link_new_cores.py` / `batch_link.py` 为链接脚本。流程概要：

```bash
cd cores/FBNeo-libretro/src/burner/libretro
make -f Makefile platform=emscripten CC="python <emsdk>/emcc.py" \
    CXX="python <emsdk>/em++.py" AR="python <emsdk>/emar.py" -j8   # → .bc
# 将 .bc 拷为 RetroArch 树的 libretro_emscripten.a 后用响应文件链接
# （超长命令行需分块归档，见 link_new_cores.py）
```

## 项目结构

```
wemu/                  # 可部署应用（Docker 构建上下文）
├── server/            # Node 服务：静态托管 + 游戏库 API + 存档同步（零依赖）
├── src/               # 前端（TypeScript + vite）：系统轮播 / 游戏列表 / 播放器
├── public/            # RetroArch WASM 播放器页 / EmulatorJS 播放器页
├── retroarch/         # 静态链接的 RetroArch 核心（.js/.wasm）+ 菜单素材 + 着色器
├── emulator/          # EmulatorJS 4.2.3（备用引擎）
├── themes/            # ES-DE 主题（slate / modern / linear）
├── roms/              # 游戏库（部署时挂载，不入库）
└── data/              # SQLite 存档库（部署时挂载，不入库）
```

## 致谢

- [RetroArch / libretro](https://www.libretro.com/) — 核心与 WASM 运行时
- [EmulatorJS](https://emulatorjs.org/) — 备用引擎
- [ES-DE](https://www.es-de.org/) — 界面设计参考与主题（slate-es-de 等为 EMULATIONSTATION-DE 项目主题）
- 各核心版权归其各自作者所有；请仅使用合法持有的游戏 ROM
