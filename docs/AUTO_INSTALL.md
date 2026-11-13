# 自动安装任务卡（给 AI 助手执行）

> 这份文件是**给 Windows 端 AI 助手（WorkBuddy / 类 Cursor Agent 等）的机器指令**，不是给人看的教程。
> 触发语：「按 `deltasound` 仓库 `docs/AUTO_INSTALL.md` 执行」。
> 全程可执行文件下载，无需登录、无需云盘。

## 0. 固定事实

| 项 | 值 |
|---|---|
| 安装包 | `https://github.com/jingzhaohui/deltasound/releases/download/v1.0.0/DeltaSound-Setup-1.0.0.exe` |
| 安装包 SHA256 | `CBFF16DF0E5D8EF3B46C9538253B67D73A5ECA0AC72DEC72D2A08966BADFC953` |
| 配置模板 | `https://raw.githubusercontent.com/jingzhaohui/deltasound/main/config.txt` |
| 安装目录 | `%LOCALAPPDATA%\DeltaSound` |
| APO 配置 | `C:\Program Files\EqualizerAPO\config\config.txt` |
| APO 官网 | https://sourceforge.net/projects/equalizerapo/ |

**关键前提**：DeltaSound 不是驱动。没有 Equalizer APO 且未在 Configurator 勾选耳机，装了也不生效。

## 1. 下载 + 校验 + 静默安装（PowerShell）

```powershell
$ErrorActionPreference = 'Stop'
$dir  = Join-Path $env:USERPROFILE 'Downloads\DeltaSound'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$exe  = Join-Path $dir 'DeltaSound-Setup-1.0.0.exe'
$cfg  = Join-Path $dir 'config.txt'
Invoke-WebRequest -Uri 'https://github.com/jingzhaohui/deltasound/releases/download/v1.0.0/DeltaSound-Setup-1.0.0.exe' -OutFile $exe
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/jingzhaohui/deltasound/main/config.txt' -OutFile $cfg
$hash = (Get-FileHash $exe -Algorithm SHA256).Hash
if ($hash -ne 'CBFF16DF0E5D8EF3B46C9538253B67D73A5ECA0AC72DEC72D2A08966BADFC953') { throw "SHA256 不符，中止：$hash" }
Start-Process -FilePath $exe -ArgumentList '/S' -Wait
$app = Join-Path $env:LOCALAPPDATA 'DeltaSound\DeltaSound.exe'
if (-not (Test-Path $app)) { throw '安装后未找到 DeltaSound.exe' }
"OK: $app"
```

## 2. Equalizer APO 检查

```powershell
$apoDir = 'C:\Program Files\EqualizerAPO'
$apoCfg = "$apoDir\config\config.txt"
"APO installed: $(Test-Path $apoDir)"
"APO config   : $(Test-Path $apoCfg)"
```

- **已装且已勾选耳机** → 进第 3 步。
- **已装但未勾选** → 启动 `"$apoDir\Configurator.exe"`，提示用户勾选耳机并**重启电脑**。不要改注册表代替，容易损坏音频端点。
- **未安装** → 助手可下载并运行官方安装程序，但设备勾选与重启必须由用户完成，提示同上。重启后再继续。

## 3. 下发音效配置（需一次 UAC）

```powershell
$src = Join-Path $env:USERPROFILE 'Downloads\DeltaSound\config.txt'
$dst = 'C:\Program Files\EqualizerAPO\config\config.txt'
$bak = "$dst.deltasound.bak"
$inner = "if (-not (Test-Path '$bak')) { Copy-Item '$dst' '$bak' -Force }; Copy-Item '$src' '$dst' -Force"
Start-Process powershell -Verb RunAs -ArgumentList @('-NoProfile','-Command', $inner) -Wait
```

提示用户点一次 UAC「是」。写完后读回 `$dst` 比对内容确认成功。

等价人工路径：启动 DeltaSound →「应用到本机音效」→「勾选耳机」。脚本失败时改走这条。

## 4. 自检并报告

| 检查项 | 通过条件 |
|---|---|
| 主程序 | `%LOCALAPPDATA%\DeltaSound\DeltaSound.exe` 存在 |
| 卸载项 | `HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\DeltaSound` 存在 |
| APO 配置 | `C:\Program Files\EqualizerAPO\config\config.txt` 与下载的一致 |
| 备份 | `config.txt.deltasound.bak` 存在 |
| 设备 | 用户确认耳机已勾选并已重启 |

最后启动程序，提醒：关掉游戏内 7.1 / 杜比；空格键 A/B；还原原声用「恢复原声」或 `.bak`。

## 5. 边界

- 不做驱动签名、不改音频端点注册表、不装第三方 VST、不关闭 Windows 音频增强。
- **不自动重启电脑**，只提示。
- SmartScreen 拦截时提示「更多信息 → 仍要运行」，不要改系统安全策略。
- 不修改游戏内设置。

## 6. 自动化程度

自动：下载、校验、静默安装、检测 APO、提权写配置、自检报告。
必须人做：Configurator 勾选耳机（GUI）、一次 UAC、一次重启。原因是 APO 属系统级音频组件，Windows 不允许无交互静默注册到具体播放端点。
