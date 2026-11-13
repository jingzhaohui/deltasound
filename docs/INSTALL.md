# Windows 安装与排错

## 下载

从 [GitHub Releases](https://github.com/jingzhaohui/deltasound/releases/latest) 下载：

| 文件 | 大小 | SHA256 |
|---|---|---|
| `DeltaSound-Setup-1.0.0.exe` | 81,084,745 B | `cbff16df0e5d8ef3b46c9538253b67d73a5eca0ac72dec72d2a08966badfc953` |

PowerShell 校验：

```powershell
(Get-FileHash .\DeltaSound-Setup-1.0.0.exe -Algorithm SHA256).Hash
```

## 安装顺序（不能反）

1. **安装 [Equalizer APO](https://sourceforge.net/projects/equalizerapo/)**，在 Configurator 里勾选你打游戏的耳机，**重启电脑**。这是真正作用在系统音频链路上的组件。
2. 运行 `DeltaSound-Setup-1.0.0.exe`。NSIS 中文向导，默认装到 `%LOCALAPPDATA%\DeltaSound`，免管理员。静默安装：`DeltaSound-Setup-1.0.0.exe /S`。
3. 打开 DeltaSound，点「**应用到本机音效**」，UAC 弹窗点「是」。程序会把滑块参数写成 `C:\Program Files\EqualizerAPO\config\config.txt`，写入前自动备份为 `config.txt.deltasound.bak`。
4. 点「**勾选耳机**」，用官方 Configurator 确认耳机已勾选（首次必做）。
5. 启动游戏。7 个滑块即时热重载，空格键 A/B 对比。

## 配置说明

`config.txt` 是 Equalizer APO 的全局配置模板（8 段滤波 + 四档增益表）。也可以手动复制：

```powershell
Copy-Item .\config.txt 'C:\Program Files\EqualizerAPO\config\config.txt' -Force   # 需管理员
```

Equalizer APO 会热重载配置文件，改完不用重启。想还原原声：应用里点「恢复原声」，或把 `config.txt.deltasound.bak` 覆盖回去。

## 功能

- 托盘常驻、开机自启、托盘 A/B 开关
- 状态检测（APO 是否安装 / 配置是否生效）、UAC 提权写入、打开配置目录
- 内置试听器：合成演示音 / 上传录音 / 麦克风，实时频谱与增益衰减表
- 一键导出 Equalizer APO 配置文本
- 卸载程序会提示先恢复原声

## 排错

| 现象 | 处理 |
|---|---|
| 拖滑块完全没变化 | 耳机没在 Configurator 里勾选，或装完 Equalizer APO 没重启 |
| 「应用到本机音效」失败 | 以管理员身份运行一次；或手动复制 config.txt |
| 声音发闷 / 失真 | 关掉游戏内 7.1 环绕、杜比全景声，只留立体声；降低 Preamp 增益 |
| SmartScreen 拦截 | 点「更多信息 → 仍要运行」（未购买代码签名证书） |
| 卸载后音效仍在 | 先在应用里点「恢复原声」，再卸载 |

## 边界

- 本程序**不是 APO 驱动**，是控制面板 + 配置下发器 + 试听器；真正处理音频的是 Equalizer APO。
- 静态 EQ 覆盖「压风声 + 提脚步」；完整的动态防炸耳可按 `config.txt` 注释另挂免费的 ReaComp + ReaLimit。
- 只支持立体声。
- 仅调整系统音频输出，不读取或修改任何游戏进程、内存、网络数据。
