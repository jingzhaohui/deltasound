# DeltaSound for Windows · 安装说明

## 安装顺序（重要）

1. **先装 [Equalizer APO](https://sourceforge.net/projects/equalizerapo/)**，安装时勾选你打游戏用的那副耳机，装完**重启电脑**。
2. 双击 `dist/DeltaSound-Setup-1.0.0.exe` 安装（77 MB，中文向导，默认装到 `%LOCALAPPDATA%\DeltaSound`，不需要管理员）。不想安装可直接运行 `dist-portable/DeltaSound/DeltaSound.exe`（整个文件夹一起拷贝）。
3. 打开 DeltaSound → 点「**应用到本机音效**」。首次会弹 UAC，点「是」。
4. 点「**勾选耳机**」打开官方 Configurator，确认耳机已被勾选（首次必做）。
5. 进游戏即可。拖滑块 → 配置自动热重载，改完立刻生效，不用重启游戏。

## 它做了什么

- 把当前滑块写成 `C:\Program Files\EqualizerAPO\config\config.txt`（Equalizer APO 监控该文件，自动热重载）。
- 写入前自动备份原配置为 `config.txt.deltasound.bak`；「恢复原声」一键还原。
- 托盘常驻（点 × 只是隐藏，音效不停）、开机自启、托盘菜单 A/B 开关。
- 面板内置试听原型：合成演示音 / 上传录音 / 麦克风，可实时 A/B 对比 DSP 链。

## 注意

- **动态处理**（防炸耳限幅 / 瞬态增强 / 稳态风声抵消）Equalizer APO 原生不支持。静态 EQ 已覆盖「风声压制 + 脚步浮上来」的大部分；要完整「枪声不刺耳」，按根目录 `config.txt` 注释挂免费的 ReaComp + ReaLimit。
- 只支持**立体声**；关闭游戏内音效增强、7.1 虚拟环绕、杜比，避免二次处理。
- Windows 10/11 x64。未做微软驱动签名（本程序不是 APO 驱动，只是配置面板 + 试听器）。
- 卸载前先点「恢复原声」，卸载程序不会改动系统音频配置。
- 若「应用到本机音效」提示未检测到 Equalizer APO：确认装在默认路径，或点「下载 Equalizer APO」重装后重启本程序。

## 源码结构

```
main.js            Electron 主进程：托盘 / 状态检测 / UAC 提权写配置 / 备份还原 / 开机自启 / 媒体权限
preload.js         contextBridge 安全桥
renderer/          Web Audio 界面（与根目录 index.html 同源，多一个 Windows 面板）
build/icon.ico     多尺寸图标（16/32/48/64/128/256）
build_portable.py  组装便携目录（把 electron.exe 复制成 DeltaSound.exe，注入 resources/app）
installer.nsi      NSIS 安装脚本：中文向导、快捷方式、注册表卸载项
vendor/            Windows Electron 33.4.11 分发包 + macOS 版 makensis（仅构建用）
```

## 重新构建

普通环境：`npm install && npm run build`（electron-builder 直接产出 nsis + portable）。

在受限沙箱里 electron-builder 可能无法完成临时文件清理，此时改走手动链路（全程只创建/复制）：

```bash
python3 build_portable.py
NSISDIR="$PWD/vendor/nsis" ./vendor/nsis/mac/makensis installer.nsi
```

产物：`dist/DeltaSound-Setup-1.0.0.exe`（安装包）、`dist-portable/DeltaSound/DeltaSound.exe`（便携）。
