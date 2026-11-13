# Windows 安装与排错（v1.1）

## 下载

从 [GitHub Releases](https://github.com/jingzhaohui/deltasound/releases/latest) 下载 `DeltaSound-Setup-1.1.0.exe`。

```powershell
(Get-FileHash .\DeltaSound-Setup-1.1.0.exe -Algorithm SHA256).Hash
```

SHA256：`8E4086F79079F8507BB12F9683424D0B0B482DDDA405DF94FC9F84C33154BA85`（发布后由 Release 页面核对）。

## 第 0 步：先做免费的音频链路设置（比调 EQ 收益更大）

这三条不花钱、不改游戏文件，却经常比 EQ 本身影响更大。依据见 [RESEARCH.md](RESEARCH.md)。

1. **只保留一层空间处理**。游戏内 HRTF 开；关掉 Windows Sonic、Dolby Atmos、DTS、耳机厂商的虚拟 7.1、以及 Windows 声音属性「增强」页的所有增强。叠加两层 HRTF 会互相打架，结果是「听得到脚步但说不出方向」。输出设为**立体声 24 bit / 48 kHz**（避免采样率转换带来的延迟与失真）。
2. **游戏内混音**：音乐 0、语音调低、音效 100；开「夜间模式 / 动态范围压缩」（游戏自带的最省事防炸耳）。关单声道、关响度均衡。
3. **先补偿耳机本身**：用 AutoEq / REW 按你耳机的测量曲线做一次校正，再叠加 DeltaSound。每副耳机原生频响不同，不存在一套通用最优解；跳过这步容易把「耳机自身的刺耳峰」误判成需要 EQ 修正。

## 安装顺序（不能反）

1. **安装 [Equalizer APO](https://sourceforge.net/projects/equalizerapo/)**，在 Configurator 里勾选你打游戏的耳机，**重启电脑**。这是真正作用在系统音频链路上的组件。
2. 运行 `DeltaSound-Setup-1.1.0.exe`。NSIS 中文向导，默认装到 `%LOCALAPPDATA%\DeltaSound`，免管理员。静默安装：`DeltaSound-Setup-1.1.0.exe /S`。
3. 打开 DeltaSound，点「**应用到本机音效**」，UAC 弹窗点「是」。程序把滑块参数写成 `C:\Program Files\EqualizerAPO\config\config.txt`，写入前自动备份为 `config.txt.deltasound.bak`。
4. 点「**勾选耳机**」，用官方 Configurator 确认耳机已勾选（首次必做）。
5. 启动游戏。8 个滑块即时热重载，空格键 A/B 对比。

## 配置说明

`config.txt` 是 Equalizer APO 的全局配置模板（9 段滤波 + 四档增益表，Preamp −6.5 dB）。也可以手动复制：

```powershell
Copy-Item .\config.txt 'C:\Program Files\EqualizerAPO\config\config.txt' -Force   # 需管理员
```

Equalizer APO 会热重载配置文件，改完不用重启。想还原原声：应用里点「恢复原声」，或把 `config.txt.deltasound.bak` 覆盖回去。

### 动态部分（向上压缩 / 防炸耳 / 侧向定位）

Equalizer APO 原生只有静态 EQ，动态链有两条路：

- **(a) Peace GUI 挂 VST**：`ReaComp`（thr −18dB、4:1、atk 3ms、rel 120ms）→ `ReaLimit`（ceiling −1.0dB、lookahead 1.5ms）。**压缩器务必设为立体声联动（stereo link 100%）**，逐声道独立会破坏左右定位。
- **(b) 内置试听器的完整实时链**：`index.html` 已实现向上压缩、稳态风声抵消、动态去刺、侧信号增强、前瞻限幅，配 VB-Cable / BlackHole 虚拟声卡即可作用到系统音频。

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
| 声音发闷 / 失真 | 先查第 0 步：是否开了两层空间音效；再降低 Preamp 增益或整体档位 |
| 方向感反而变差 | 关掉 Windows Sonic / 杜比 / 虚拟 7.1，只留游戏内 HRTF；确认输出是立体声 |
| 枪声还是炸耳 | 挂 ReaLimit 或把「防炸耳」拉满；检查是否同时开了游戏内响度均衡 |
| 底噪变大 / 有抽气感 | 降低「静步」（向上压缩上限），确认 ReaComp 的 release ≥120ms |
| SmartScreen 拦截 | 点「更多信息 → 仍要运行」（未购买代码签名证书） |
| 卸载后音效仍在 | 先在应用里点「恢复原声」，再卸载 |

## 边界

- 本程序**不是 APO 驱动**，是控制面板 + 配置下发器 + 试听器；真正处理音频的是 Equalizer APO。
- 静态 EQ 覆盖「压风声 + 提脚步」；完整动态链在试听器里，本机侧可另挂免费的 ReaComp + ReaLimit。
- 只支持立体声。
- 仅调整系统音频输出，不读取或修改任何游戏进程、内存、网络数据；不含任何反作弊规避逻辑。
