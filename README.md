# DeltaSound

面向三角洲游戏音频的开源音效调节工具：**压低环境风声、抬起脚步细节、削平枪声峰值**。

> 独立实现。仅调整系统音频输出，不读取或修改游戏进程、内存、网络数据；不含任何模型、云服务或账号体系。

## 能做什么

| 目标 | 手段 |
|---|---|
| 风声压下去 | 稳态低频/底噪估计与抵消 + 140 Hz 高通 |
| 脚步浮上来 | 220 / 420 / 1.6k / 3.2k / 6.5k 分段提升 + 瞬态增益 + 安静段提升 |
| 枪声不刺耳 | 2–8 kHz 动态去刺 + 3 ms / 120 ms 压缩限幅，峰值钳在 0.94 |

## 两种用法

**1. 浏览器里直接试听（零安装）**

双击根目录 `index.html`（Chrome / Edge）。内置合成演示音（风声 + 脚步 + 静步 + 枪响），也可上传录音或用麦克风；7 个滑块实时生效，空格键 A/B 对比，带实时频谱与增益衰减表。

**2. Windows 本机生效**

从 [Releases](https://github.com/jingzhaohui/deltasound/releases) 下载 `DeltaSound-Setup-1.0.0.exe`：

1. 先装 [Equalizer APO](https://sourceforge.net/projects/equalizerapo/)，安装时勾选你的耳机，**重启电脑**。
2. 运行 DeltaSound 安装程序（NSIS，免管理员，支持 `/S` 静默）。
3. 打开 DeltaSound →「应用到本机音效」（UAC 点「是」）→「勾选耳机」。
4. 进游戏，拖滑块即时热重载。关掉游戏内 7.1 / 杜比，只留立体声。

完整步骤见 [docs/INSTALL.md](docs/INSTALL.md)。想让 AI 助手自动装完，见 [docs/AUTO_INSTALL.md](docs/AUTO_INSTALL.md)。

## 自检

```bash
node selftest.js
```

合成 6 秒信号（稳态风声 / 脚步 / 枪声）验证三个方向，纯 Node 无依赖。标准档结果：

| 段 | RMS | 峰值 |
|---|---|---|
| 风声 | 0.0201 → 0.0136（−3.4 dB） | 0.081 → 0.115 |
| 脚步 | 0.0359 → 0.0502（+2.9 dB） | 0.351 → 0.506 |
| 枪声 | 0.0713 → 0.0350（−6.2 dB） | 1.020 → 0.898 |

无 NaN、无硬削波。

## 实现

```
输入 → [稳态噪声抑制] → [多段 EQ] → [瞬态/安静段提升] → [动态去刺 + 压缩限幅] → 输出
```

- `index.html` — Web Audio 版完整 DSP 链，浏览器实时处理。
- `win-app/` — Electron 托盘控制面：状态检测、UAC 提权写入、备份还原、开机自启、A/B 开关。它**不是驱动**，只把参数写成 Equalizer APO 的 `config.txt`；真正处理音频的是 Equalizer APO。
- `config.txt` — Equalizer APO 成品配置（8 段滤波 + 四档增益表）。
- [docs/DESIGN.md](docs/DESIGN.md) — 各段判据、参数与取舍。

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
index.html            Web Audio 试听器 / 实时 DSP 原型
selftest.js           DSP 数值自检
config.txt            Equalizer APO 配置模板
LICENSE               MIT
docs/INSTALL.md       Windows 安装与排错
docs/AUTO_INSTALL.md  给 AI 助手的自动安装任务卡
docs/DESIGN.md        DSP 设计与取舍
win-app/              Electron 控制面 + 打包脚本 + 图标
```

## 已知限制

- 依赖 Equalizer APO；本仓库不分发它，也不分发任何 APO 驱动或签名组件。
- 稳态估计只能做到七八成的内容感知降噪效果；更接近需要自录环境噪声做 NLMS，或接 RNNoise / SpeexDSP。
- 静态 EQ 覆盖「压风声 + 提脚步」；完整的动态防炸耳在试听器里已实现，本机侧可另挂免费的 ReaComp + ReaLimit。
- 只支持立体声。
- 安装包未做代码签名，SmartScreen 可能提示「更多信息 → 仍要运行」。
- 跨平台：控制面板为 Windows 设计；浏览器试听器任何平台可用。

## 免责声明

本项目为独立的音频处理实现，仅用于学习与个人音频偏好调节。不含任何第三方专有代码、二进制、录音素材或授权逻辑，与任何商业音频软件及其厂商无关联、非官方、未获背书。使用者需自行遵守所玩游戏的条款；作者不对使用后果负责。

## 第三方

- [Electron](https://www.electronjs.org/) — MIT（运行时，构建时下载，不在本仓库分发二进制）
- [NSIS](https://nsis.sourceforge.io/) — zlib/libpng（安装器）
- [Equalizer APO](https://sourceforge.net/projects/equalizerapo/) — 外部依赖，用户自行安装

## License

[MIT](LICENSE)
