# DeltaSound

面向游戏音频的开源音效调节工具：**压低环境风声、抬起脚步细节、削平枪声峰值**。

> 独立实现。仅调整系统音频输出，不读取或修改游戏进程、内存、网络数据；不含任何模型、云服务或账号体系。
> v1.1 起所有 DSP 增益 **立体声联动**，不改写左右电平差（ILD），避免破坏 HRTF 定位。

## 能做什么

| 目标 | 手段 |
|---|---|
| 风声压下去 | 稳态低频中置分量抵消 + 90–140 Hz 高通 + 120 Hz 低架 −3.5 dB（削减低频向上掩蔽） |
| 脚步浮上来 | 三区频段模型：150–450 Hz 撞击 / 1–3.5 kHz 材质 / 4–9 kHz 瞬态；700 Hz 去浑浊；连续斜率向上压缩只抬微弱声；侧信号 L−R 增强 |
| 枪声不刺耳 | 只在枪声活动期动态衰减 2.5–9 kHz + 1.5 ms 前瞻联动限幅 + tanh 软削波（不再靠硬钳） |

**关键取舍**：听觉掩蔽是不对称的，低频掩蔽高频、且向上扩散。所以「切掉多余低频」比「提高频」更有效——提高频会把枪声一起变刺。曲线依据与 7 个同类项目的逐条对比见 [docs/RESEARCH.md](docs/RESEARCH.md)。

## 两种用法

**1. 浏览器里直接试听（零安装）**

双击根目录 `index.html`（Chrome / Edge）。内置合成演示音（风声 + 脚步 + 静步 + 枪响），也可上传录音或用麦克风；8 个滑块实时生效，空格键 A/B 对比，带实时频谱与增益衰减表。

**2. Windows 本机生效**

从 [Releases](https://github.com/jingzhaohui/deltasound/releases/latest) 下载 `DeltaSound-Setup-1.1.0.exe`：

1. **先做免费的音频链路设置**（比调 EQ 收益更大）：只保留一层空间处理——游戏内 HRTF 开，关 Windows Sonic / Dolby Atmos / 耳机虚拟 7.1 / Windows「音频增强」；输出设立体声 24bit 48kHz；游戏内音乐 0、语音调低、音效 100、夜间模式开。详见 [docs/INSTALL.md](docs/INSTALL.md)。
2. 先按自己耳机的测量曲线（AutoEq / REW）做补偿，再叠加本配置。
3. 装 [Equalizer APO](https://sourceforge.net/projects/equalizerapo/)，Configurator 里勾选耳机，**重启电脑**。
4. 运行 DeltaSound 安装程序（NSIS，免管理员，支持 `/S` 静默）→「应用到本机音效」→「勾选耳机」。
5. 进游戏，拖滑块即时热重载。

想让 AI 助手自动装完，见 [docs/AUTO_INSTALL.md](docs/AUTO_INSTALL.md)。

## 自检

```bash
node selftest.js
```

`selftest.js` 直接 `require('./dsp-core.js')`，与浏览器/Electron 用的是**同一份算法**，不会漂移。纯 Node 无依赖，合成 8 秒信号验证以下项目：

| 检查 | 标准档结果 |
|---|---|
| 风声 RMS | 0.0200 → 0.0118（**−4.6 dB**） |
| 脚步 RMS | 0.0302 → 0.0390（**+2.2 dB**） |
| 枪声 RMS / 峰值 | 0.0716 → 0.0358（**−6.0 dB**）；峰值 1.038 → **0.779**（无硬削波） |
| 极安静底噪 | −4.8 dB（**不被拉高**，−58 dBFS 门生效） |
| ILD（纯联动档） | 偏差 **0.000 dB**；全链路 0.034 dB |
| 侧信号增强 | +1.10 dB（中置不变） |
| 远近层次 | 输入 11.9 dB → 输出 11.3 dB（远脚步抬得更多，但没被拉平） |

无 NaN、无硬削波，全部 PASS 才允许发布。

## 实现

```
输入 → [静态 9 段 EQ] → [稳态噪声抑制] → [连续向上压缩]
     → [侧信号 L−R 增强] → [枪声动态去刺] → [1.5ms 前瞻联动限幅 + 软削波] → 输出
```

- `dsp-core.js` — **单一真源**：浏览器 `<script>` 与 Node `require` 共用，立体声联动的全部包络与增益。
- `index.html` — Web Audio 试听器（静态 EQ 用 Biquad 节点 + 动态链用 dsp-core）。
- `win-app/` — Electron 托盘控制面：状态检测、UAC 提权写入、备份还原、开机自启、A/B 开关。它**不是驱动**，只把参数写成 Equalizer APO 的 `config.txt`；真正处理音频的是 Equalizer APO。
- `config.txt` — Equalizer APO 成品配置（9 段滤波 + 四档增益表，Preamp −6.5 dB）。
- [docs/DESIGN.md](docs/DESIGN.md) — 各段判据、参数与取舍。
- [docs/RESEARCH.md](docs/RESEARCH.md) — 竞品对比、频段证据、v1.0 → v1.1 逐条修正。

> **注意**：Equalizer APO 只能承载静态 EQ；向上压缩、动态去刺、侧信号、前瞻限幅需要实时链（试听器 + 虚拟声卡）或另挂免费的 ReaComp + ReaLimit（压缩器务必设为立体声联动）。

## 构建

```bash
cd win-app
npm install
npm run build          # electron-builder，产出安装包与便携版
```

macOS 上交叉打包（本机环境不走 electron-builder 时）：

```bash
cd win-app
python3 build_portable.py                 # 组装 resources/app
NSISDIR=$PWD/vendor/nsis ./vendor/nsis/mac/makensis installer.nsi
```

`build_portable.py` 与 `installer.nsi` 已包含在仓库，可复现整个手工打包链路。

## 目录

```
index.html            Web Audio 试听器
dsp-core.js           共享 DSP 核心（浏览器 + Node）
selftest.js           DSP 数值自检
config.txt            Equalizer APO 配置模板
LICENSE               MIT
docs/INSTALL.md       Windows 安装与排错
docs/AUTO_INSTALL.md  给 AI 助手的自动安装任务卡
docs/DESIGN.md        DSP 设计与取舍
docs/RESEARCH.md      同类项目调研与优化依据
win-app/              Electron 控制面 + 打包脚本 + 图标
win-app/renderer/dsp-core.js  （打包副本，与根目录同步）
```

## 已知限制

- 依赖 Equalizer APO；本仓库不分发它，也不分发任何 APO 驱动或签名组件。
- 稳态估计只能做到七八成的内容感知降噪效果；更接近需要自录环境噪声做 NLMS。**不接 RNNoise**：它为语音训练，会误杀脚步/枪声，理由见 RESEARCH.md。
- 静态 EQ 覆盖「压风声 + 提脚步」；完整动态链在试听器里，本机侧可另挂 ReaComp + ReaLimit。
- 每副耳机原生频响不同，本配置是**起点不是终点**，需先做耳机自身补偿。
- 只支持立体声；多声道会让空间线索与 EQ 判据失配。
- 安装包未做代码签名，SmartScreen 可能提示「更多信息 → 仍要运行」。

## 免责声明

本项目为独立的音频处理实现，仅用于学习与个人音频偏好调节，不含任何第三方专有代码、二进制、录音素材或授权逻辑，与任何商业音频软件及其厂商无关联、非官方、未获背书。均衡属于播放链属性，与更换耳机同理；但使用者需自行遵守所玩游戏的条款，作者不对使用后果负责。

## 第三方

- [Electron](https://www.electronjs.org/) — MIT（运行时，构建时下载，不在本仓库分发二进制）
- [NSIS](https://nsis.sourceforge.io/) — zlib/libpng（安装器）
- [Equalizer APO](https://sourceforge.net/projects/equalizerapo/) — 外部依赖，用户自行安装

## License

[MIT](LICENSE)
