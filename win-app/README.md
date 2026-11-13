# DeltaSound for Windows · 安装说明（v1.1）

## 第 0 步：先做免费的音频链路设置

1. **只保留一层空间处理**：游戏内 HRTF 开；关 Windows Sonic、Dolby Atmos、耳机虚拟 7.1 和 Windows「音频增强」全部选项。输出设立体声 24bit / 48kHz。
2. **游戏内**：音乐 0、语音调低、音效 100、夜间模式开。
3. **先补偿耳机自身频响**（AutoEq / REW），再叠加本配置——每副耳机不一样。

这几步往往比调 EQ 本身收益更大。依据见仓库 `docs/RESEARCH.md`。

## 安装顺序（重要）

1. **先装 [Equalizer APO](https://sourceforge.net/projects/equalizerapo/)**，安装时勾选你打游戏用的那副耳机，装完**重启电脑**。
2. 双击 `dist/DeltaSound-Setup-1.1.0.exe` 安装（中文向导，默认装到 `%LOCALAPPDATA%\DeltaSound`，不需要管理员）。不想安装可直接运行 `dist-portable/DeltaSound/DeltaSound.exe`（整个文件夹一起拷贝）。
3. 打开 DeltaSound → 点「**应用到本机音效**」。首次会弹 UAC，点「是」。
4. 点「**勾选耳机**」打开官方 Configurator，确认耳机已被勾选（首次必做）。
5. 进游戏即可。8 个滑块 → 配置自动热重载，改完立刻生效，不用重启游戏。

## 它做了什么

- 把当前滑块写成 `C:\Program Files\EqualizerAPO\config\config.txt`（Equalizer APO 监控该文件，自动热重载）。
- 写入前自动备份原配置为 `config.txt.deltasound.bak`；「恢复原声」一键还原。
- 托盘常驻（点 × 只是隐藏，音效不停）、开机自启、托盘菜单 A/B 开关。
- 面板内置试听原型：合成演示音 / 上传录音 / 麦克风，可实时 A/B 对比完整动态链（立体声联动、向上压缩、侧信号增强、动态去刺、前瞻限幅）。

## 注意

- **动态处理**（向上压缩 / 防炸耳 / 侧向定位）Equalizer APO 原生不支持。静态 EQ 已覆盖「风声压制 + 脚步浮上来」的大部分；要完整「枪声不刺耳」，按根目录 `config.txt` 注释挂免费的 ReaComp + ReaLimit（**压缩器必须设为立体声联动**），或用内置试听器 + 虚拟声卡。
- v1.1 所有 DSP 增益立体声联动，不改写左右电平差（ILD），避免破坏 HRTF 定位。
- 只支持**立体声**；只留一层 HRTF，避免二次空间处理。
- Windows 10/11 x64。未做微软驱动签名（本程序不是 APO 驱动，只是配置面板 + 试听器）。
- 卸载前先点「恢复原声」，卸载程序不会改动系统音频配置。
- 若「应用到本机音效」提示未检测到 Equalizer APO：确认装在默认路径，或点「下载 Equalizer APO」重装后重启本程序。

## 源码结构

```
main.js                 Electron 主进程：托盘 / 状态检测 / UAC 提权写配置 / 备份还原 / 开机自启 / 媒体权限
preload.js              contextBridge 安全桥
dsp-core.js             （根目录）共享 DSP 核心：浏览器 <script> 与 Node require 共用
renderer/index.html     Web Audio 界面（比根目录 index.html 多一个 Windows 面板）
renderer/dsp-core.js    dsp-core.js 的打包副本，构建时由 build_portable.py 注入
build/icon.ico          多尺寸图标（16/32/48/64/128/256）
build/default-config.txt  默认 Equalizer APO 配置
build_portable.py       组装便携目录（把 electron.exe 复制成 DeltaSound.exe，注入 resources/app）
installer.nsi           NSIS 安装脚本：中文向导、快捷方式、注册表卸载项
vendor/                 Windows Electron 33.4.11 分发包 + macOS 版 makensis（仅构建用）
```

## 重新构建

普通环境：`npm install && npm run build`（electron-builder 直接产出 nsis + portable）。

在受限沙箱里 electron-builder 可能无法完成临时文件清理，此时改走手动链路（全程只创建/复制）：

```bash
python3 build_portable.py
NSISDIR="$PWD/vendor/nsis" ./vendor/nsis/mac/makensis installer.nsi
```

产物：`dist/DeltaSound-Setup-1.1.0.exe`（安装包）、`dist-portable/DeltaSound/DeltaSound.exe`（便携）。
