# WemuStation

基于 Web 的模拟器整合前端 + 模拟器。界面上复刻 [ES-DE (EmulationStation Desktop Edition)](https://es-de.org) 的交互与主题观感；模拟层默认使用**从 RetroArch 源码编译的 WASM 构建**（保留完整 RetroArch 菜单：着色器、遮罩、金手指、倒带、重映射等），也可一键切换到 EmulatorJS 引擎。

**当前支持系统**：FC/NES · SFC/SNES · Mega Drive/Genesis · PC Engine · GBA · Game Boy/Color · PlayStation

**局域网部署**：一台机器跑服务、存 ROM，全家/全办公室浏览器打开即玩——见 [DEPLOY.md](DEPLOY.md)。

## 快速开始

首次准备（只需一次）：`npm install` → `npm run build` → `npm run gen-cert`

之后每天启动，任选其一：

| 方式 | Windows | Linux / macOS |
|---|---|---|
| 一键启动（推荐） | 双击 `start.bat` | `./start.sh` |
| 手动分步 | `npm run server` 后访问 :4464 | 同左 |

一键脚本会启动服务器并自动打开浏览器；局域网手柄用户请访问脚本打印的 `https://<服务器IP>:4465` 地址。

开发模式（改前端代码热更新）：

```bash
npm run server     # 先启动后端（http://localhost:4464）
npm run dev        # 另开终端：Vite 热更新（http://localhost:5173，代理 API 到 4464）
```

## 双引擎架构

`server/config.json` 的 `"player"` 字段决定游戏启动引擎：

- **`retroarch`（默认）**：加载 `retroarch/<core>_libretro.js + .wasm`——用 emsdk 从 RetroArch 源码静态链接各 libretro 核心编译出的完整 RetroArch。启动后直接运行游戏，按 **F1**（或右上角 ☝ RA菜单 按钮）呼出 **RetroArch 完整快速菜单**：Shaders（着色器）、On-Screen Overlay（屏幕遮罩）、Save States、Cheats（金手指）、Rewind（倒带）、Controls（重映射）等全部功能。存档/即时存档/RA 配置自动同步到**服务器 SQLite**（每 30 秒 + 退出时推送），所有设备共用同一份进度与设置。
- **菜单外观可换**：内置官方 OZONE / RGUI / GLUI 菜单素材（`retroarch/assets/`），在 RA 菜单 Settings → User Interface → Menu 里切换。
- **多语言（含简体中文）**：构建启用 HAVE_LANGEXTRA + 打包了 CJK 子集字体（`assets/pkg/chinese-fallback-font.ttf`，通过 ozone_font 配置生效），Settings → User（用户）→ Language 可切简体中文（不在“用户界面”里）。改完设置记得 Main Menu → Configuration File → Save Configuration，配置保存到服务器，重进游戏即生效。
- **游戏内组合键**：按住 **Select + X** 呼出 RA 菜单；**Select + Start**（或 L1+R1）退出到主界面。热键由 RA 原生处理，可在 RA 菜单 Controls 里改绑；若你的手柄 Select/X 编号不同，改绑一次即自动保存。
- **`emulatorjs`**：加载 EmulatorJS 运行时（较轻量，内置简化设置菜单）。当某核心的 RetroArch 构建缺失时前端会自动回退到此引擎。

预置着色器位于 `retroarch/shaders/`（内置 CRT 扫描线与 LCD 网格两款自制 GLSL），启动游戏时自动注入虚拟文件系统，在 RetroArch 菜单 Shaders → Load 中选择；想添加更多官方着色器，把 `.glsl/.glslp` 放入该目录并更新 `manifest.json`（文件名数组）。

### 从源码重建 RetroArch WASM（可选）

产物已包含在 `retroarch/`。如需重建（Windows + emsdk 3.1.46 + GNU make）：

```bash
# 1. 编译核心（以 fceumm 为例；femmm/snes9x/Genesis-Plus-GX/beetle-pce-libretro/gambatte/pcsx_rearmed 同理）
cd cores/fceumm && make -f Makefile platform=emscripten \
    CC="python <emsdk>/upstream/emscripten/emcc.py" CXX="python <emsdk>/upstream/emscripten/em++.py" \
    AR="python <emsdk>/upstream/emscripten/emar.py" -j8
# 2. 把产物 <core>_libretro_emscripten.bc 拷为 RetroArch 根目录 libretro_emscripten.a
# 3. 链接（参数超长需使用响应文件，见 build-tools/batch_link.py）
# 注意：Windows 下需覆盖 LD（GNU make 内置 LD=ld 会误用 binutils），且 emcc 需 noInitialRun 由承载页显式 callMain
```

`build-tools/` 内含完整构建脚本（`batch_link.py`）与核心仓库。

## 放入游戏

两种方式：

1. **直接放文件**：把 ROM 放到 `roms/<系统id>/`（`nes`、`snes`、`megadrive`、`pcengine`、`gba`、`gb`、`psx`）。
2. **网页导入**：前端按 `F1`（或点击菜单键）打开拖拽上传，文件会存到服务器对应目录。

元数据与封面：在每个系统目录（或其任意子目录）放 ES-DE / R36S 格式的 `gamelist.xml`。支持标准字段 `name/desc/image/marquee/video/releasedate/developer/publisher/genre/players/rating/favorite`，以及 R36S 整理包的扩展字段 `screenshot/screentitle/hidden`；`<folder>` 分类与嵌套子目录中的 ROM 都能识别，媒体路径相对各自 gamelist.xml 所在目录（如 `./media/box/xxx.png`、`./media/previews/xxx.png`）。没有 gamelist 时按文件名显示。

扩展名支持：nes `.nes/.fds/.unf` · snes `.sfc/.smc/.swc/.fig` · md `.md/.gen/.smd/.bin/.68k` · pce `.pce/.cue/.ccd` · gba `.gba` · gb `.gb/.gbc` · psx `.bin/.cue/.pbp/.chd/.iso/.img`，均支持 zip/7z 压缩包。

## 操作

按 **F2**（或右上角 ⚙ 按钮）打开**按键设置**：可自定义前端导航（系统选择/游戏列表）的键盘键位与手柄按钮映射，保存在浏览器本地。**游戏内**的按键映射在 RetroArch 菜单（游戏内 F1 → Controls）中配置并保存，同样持久化。

| 按键（默认） | 键盘 | 手柄（标准映射） |
|---|---|---|
| 移动 | 方向键 / WASD | 十字键 / 左摇杆 |
| 确定 | Enter / Space / X | A 键（南位） |
| 返回 | Esc / Backspace / Z | B 键（东位） |
| 菜单/导入 | F1 / Tab / Start | Start（9）/ 西键（Xbox X） |
| 按键设置 | F2 | — |
| **游戏中：呼出 RA 菜单** | 游戏内 F1 | **Select+X** |
| **游戏中：退出到前端** | Esc | **Select+Start 按两次**（2.5 秒内，防误触；或 L1+R1 一次） |

游戏运行期间，手柄/键盘的单个按键全部属于模拟游戏本身，不会误触发退出；只有组合键会作用于前端。退出采用两次确认：第一次按 Select+Start 只会提示，2.5 秒内再按才退出。RetroArch 菜单内的操作：方向键移动、确认键确认、返回键退回（默认 Xbox 布局：A=南 确认、B=东 返回；RA 菜单里可改为任天堂布局）。着色器/遮罩/核心选项/金手指/倒带等一切功能都在菜单里。

## ES-DE 主题支持

- 内置三个官方主题：`themes/slate-es-de`、`modern-es-de`、`linear-es-de`（来自 ES-DE 仓库，CC-BY-NC-SA），默认使用 Slate。
- 主题引擎实现兼容子集：`theme.xml` 的 include（任意深度、`./${system.theme}/` 变量）、`<variables>`、条件块 `<colorScheme>/<fontSize>/<aspectRatio>/<variant>`（含 `all`）、每系统 `colors.xml`/`systeminfo.xml`、`navigationsounds.xml` 导航音效、主题字体（otf）自动加载。
- 支持元素：`image`（pos/size/origin/maxSize/tile/color 染色/zIndex）、`text`/`datetime`（metadata 绑定、gamecount、字体、对齐、大小写）、`carousel`、`textlist`、`helpsystem`、`rating`、`clock`；坐标系统与 ES-DE 相同（0–1 相对屏幕 + origin 锚点）。
- 默认变体 `withoutVideos`（图片模式），无任何游戏媒体时自动按 `noGameMedia` 布局简化为纯列表。
- 切换主题：编辑 `server/config.json` 的 `"theme": "modern-es-de"` 后重启服务。

## 测试 ROM

`roms/nes/240pee.nes` 是 [240p Test Suite](https://github.com/pinobatch/240p-test-mini)（开源），`roms/nes/gamelist.xml` 演示元数据格式。其他系统请自行放入您拥有权利的 ROM。

## 已知限制与后续路线

- PS1 使用 pcsx_rearmed（HLE BIOS，无需用户 BIOS）；多文件 bin/cue 建议打成 zip 或转 chd。
- RetroArch 菜单默认 RGUI（无需额外素材）；Ozone/XMB 主题菜单需要放入 assets 资源包。
- 浏览器手柄需先按一下手柄才会被枚举（浏览器安全策略）；首次进入页面按任意键即可。
- ScreenScraper 在线刮削封面需要自建 CORS 代理（服务端已预留 `/api` 扩展位），当前用 gamelist.xml 本地元数据。
- 云游戏路线（DC/PS2 等高性能核心跑在服务端 + WebRTC 串流）为后续可选方向。

## 版权

- `retroarch/` 内构建产物：RetroArch 与各核心为 GPL-3.0（源码：RetroArch-master/ 及各 libretro 核心仓库）
- `emulator/` 内 EmulatorJS 运行时：GPL-3.0（[源码](https://github.com/EmulatorJS/EmulatorJS)）
- `themes/` 内主题：各主题自带许可（slate/modern/linear 为 ES-DE 项目 CC-BY-NC-SA）
- 请仅使用您合法拥有的游戏 ROM。

