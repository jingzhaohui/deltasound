# 同类项目调研与 v1.1 优化依据

> 调研日期：2026-11-13。方法：GitHub 仓库检索 + 源码阅读 + 社区配置指南交叉核对。
> 结论用于修正 v1.0 的一处实质性缺陷（逐声道独立增益破坏定位）并补齐四项机制。

## 一、找到的同类项目

| 项目 | 许可 / 规模 | 技术路线 | 对我们有用的部分 |
|---|---|---|---|
| [Snowail/BinauralAssist](https://github.com/Snowail/BinauralAssist) | MIT · Python | **物理回环**（Line-Out → Line-In → DSP → USB DAC），不装虚拟声卡、不碰游戏进程；WASAPI 共享模式 | **最直接对标**：明确写了「三角洲行动」。源码 `dsp.py` 第一原则就是所有增益 stereo-linked；`enhance.py` 实现向上压缩、侧信号增强、枪声动态高频衰减、lookahead 限幅；`analysis.py` 用双 sigmoid 事件检测；可选 2ch 事件模型热加载 |
| [Godpriest/DR_AudioRouter](https://github.com/Godpriest/DR_AudioRouter) | Rust / Tauri | 免驱动的 WASAPI **进程级 loopback**，5–15 ms 延迟，7 段参数 EQ（60/150/400/1000/2500/6000/12000 Hz） | 「斜率收窄小声音动态增益」：−55dBFS 到 −20dBFS 之间越弱补得越多（上限 +50dB），**连续线性斜率保留 15m/50m 远近层次**，大声音毫秒级退让消除 pumping |
| [fxsound2/fxsound-app](https://github.com/fxsound2/fxsound-app) | AGPL-3.0 · 4.7k★ · C++/JUCE | 商业软件 2023 年开源，虚拟声卡驱动 + `DfxDsp` 模块，9/20 段 EQ + Dynamic Boost / Clarity / Surround | 中文社区流传最广的「三角洲配置」就是它的预设；证明「动态增强」比纯静态 EQ 更关键 |
| [MasterMindGC8/hearitloud](https://github.com/MasterMindGC8/hearitloud) | C# | 与本项目同路线：Equalizer APO + per-process EQ 路由，自动检测耳机/DAC 写个性化配置，四档曲线 | 明确写了 **anti-cheat compliance** 原则；模式/曲线/强度三层抽象与预设导入导出 |
| [adrianlunamx/Hardline](https://github.com/adrianlunamx/Hardline) | MIT · PowerShell | Warzone 整机优化器，每步改动记原值可一键回滚 | **先按测量到的耳机校正曲线做补偿，再叠脚步 EQ** —— 每副耳机原生频响不同，不存在通用最优解 |
| [moondin/footstep-sound-enhancer](https://github.com/moondin/footstep-sound-enhancer) | MIT · Python | 200–800 Hz 带通 + 固定阈值放大 | 反例：频段过窄、无立体声联动、无动态保护，会把枪声低频一起放大 |
| [xiph/rnnoise](https://github.com/xiph/rnnoise) | BSD-3 · C | RNN 语音降噪，48kHz 全带 | **不适用**：模型为人声训练，会把脚步/枪声/换弹当作噪声削掉；仅适合麦克风输入链，不适合播放链 |
| [Equalizer APO](https://sourceforge.net/projects/equalizerapo/) + Peace GUI | GPL | 系统级 APO，零延迟参数 EQ，支持 VST | 本项目与 hearitloud 共用的底座 |

社区配置指南（非受控实验，仅作交叉印证）：[Equalizer APO 20 组预设](https://equalizerapoguide.com/equalizer-apo-settings/)、[竞技 EQ 频段框架](https://geargeeksgaming.com/audio/eq-for-competitive)、[三区脚步模型与 HRTF 单层原则](https://digitalgamerhub.com/?p=1045/)、[Delta Force 音频设置](https://immortalboost.com/blog?p=23562)、[FxSound 三角洲中文预设](https://wap.ali213.net/down/17230.html)。

## 二、频段证据：三区模型 + 向上掩蔽

多个独立来源收敛到同一个「三区脚步模型」，比「脚步 = 单一 2–4kHz」更准确：

| 区 | 频段 | 承载的信息 | 处理 |
|---|---|---|---|
| Zone 1 | 150–450 Hz | 脚掌撞击、地板共振、楼层/垂直线索 | **保留并轻抬**；只切 <150 Hz 的爆炸 rumble |
| Zone 2 | 1–3.5 kHz | 表面材质（木 / 铁 / 混凝土 / 砂石） | 轻抬 +2dB 左右 |
| Zone 3 | 4–9 kHz（含 6–12k 空气感） | 鞋跟瞬态、衣物摩擦、换弹、距离与 HRTF 耳廓线索 | 克制地抬，**不要静态砍死** |
| 浑浊区 | 500–800 Hz | 箱声 / muddiness，掩蔽上面三区 | shallow scoop −2~−3 dB |

更关键的是**听觉掩蔽的不对称性**：低频掩蔽高频远比反向有效，且掩蔽向上扩散。所以「切掉多余低频」比「提高频」更有效——提高频会把枪声一起变刺，切低频则凭空腾出信息空间。这也是所有竞技预设都配 `Preamp: -6.5 dB` 的原因：先留 headroom，再谈提升。

**中文 FxSound 三角洲预设与英文竞技预设看似矛盾**（前者 122/225/416 Hz 各 +4dB、4.89 kHz −2dB；后者 60/250 Hz 各 −4/−3dB、3.8k +5dB、6.5k +3.5dB）。辨析：

- 中文那套追求「脚步厚实 + 不刺耳」，把脚步当低频冲击、把刺耳归到高频；且 FxSound 自带 Dynamic Boost 压缩器，抬完低频又被压缩器拉平，掩蔽重新出现。
- 英文竞技那套追求「听声辨位」，而**方位与距离线索主要在中高频**（低频绕射、定位差），目标不同。
- 本项目选后者，但保留 Zone 1 的 220/420 Hz 两档给用户自己调，不搞一刀切。

## 三、v1.0 的差距与 v1.1 的修正

| # | v1.0 问题 | 依据 | v1.1 修正 |
|---|---|---|---|
| 1 | **稳态抵消、瞬态增益、去刺全部逐声道独立计算包络与增益**，L/R 被施加不同增益 → 改写 ILD → 直接破坏 HRTF 左右定位 | BinauralAssist `dsp.py`：「任何逐声道独立的压缩/限幅都会改变 ILD」 | 所有包络取 `max(|L|,|R|)`，低频抵消取两声道中置分量，高频分解用共同中置低频；所有增益为标量同时乘到 L/R。自检「纯联动」档 ILD 偏差 **0.000 dB** |
| 2 | 「安静段提升」是线性放大器 + 硬门限，会把底噪一起拉高，且硬门限会 pumping | DR_AudioRouter / BinauralAssist 的连续斜率向上压缩 | 改为 dB 域连续斜率：`(−24 − envDb) × (1 − 1/2.5)`，上限 +14dB，`−58dBFS` 底噪门，稳态平方门控；增益下降快 / 恢复慢。自检：底噪 **−4.8dB**（不放大）、远近层次仍保留 11.3 dB |
| 3 | 完全没有利用立体声差异做定位 | BinauralAssist `side_boost_db = 4.0` | 新增「侧向定位」滑块：只在脚步活动期抬 `L−R`（最多 +4dB），中置不动，不引入时延。自检侧信号 +1.10 dB |
| 4 | 9500 Hz 静态 −2.5dB 砍掉了 6–12kHz 的距离线索；去刺靠固定比例高频回削 | BinauralAssist `hf_cut_db = -9` 且只在枪声活动期 | 静态改为 10kHz 高架 −1dB；去刺改为「检测 2.5–9kHz 强瞬态 → 动态最多 −9dB」，attack 1.5ms / release 180ms 等效平滑 |
| 5 | 3ms attack 零前瞻压缩 + ±0.94 硬钳，枪声首峰靠硬钳兜住 | BinauralAssist 1.5ms lookahead + soft_clip | 改为 1.5ms（72 样本 @48k）前瞻联动限幅、0.2ms attack / 90ms release、tanh 软削波。自检枪声峰值 **1.038 → 0.779**（v1.0 是 1.020 → 0.898，且靠硬钳） |
| 6 | EQ 只有 140Hz 高通 + 五段全提，没有去浑浊、没有低架去掩蔽，Preamp 只有 −4dB | 三区模型 / 掩蔽不对称 / 社区 −6.5dB 共识 | 重做 9 段：HP 90→140Hz、120Hz 低架 −3.5dB、700Hz −2dB、220/420/1600/3200/6000 五段、10kHz 高架 −1dB，Preamp −6.5dB |
| 7 | 没有耳机自身频响校正概念，假设所有耳机是平的 | Hardline | 文档明确「先按测量曲线补偿，再叠本配置」，列为安装第一步 |
| 8 | 算法写在两个 HTML 里各自一份，自检又是第三份，容易漂移 | — | 抽出 `dsp-core.js` 单一真源，浏览器 `<script>` 与 Node `require` 共用，自检不可能与实现脱节 |

## 四、明确未采纳的（及原因）

- **物理回环硬件链路**（BinauralAssist）：效果与隔离性最好，但要 3.5mm 线 + 第二块声卡，普通用户门槛过高。
- **RNNoise / 神经网络内容降噪**：为语音设计，会误杀非语音游戏音效；且需要额外推理延迟与模型分发。
- **ML 事件分类器**（BinauralAssist 的可选模型）：需要先录标注数据，当前启发式检测器已够用，留作后续。
- **WASAPI 进程级 loopback / 按游戏进程自动启停**：需要 Rust/C++ 原生层与 Windows 权限，和本项目「配置下发器 + 试听器」的轻量定位不符。
- **每副耳机内置预设库**：需要可信的测量数据来源；改为在文档里指导用户用 AutoEq/REW 自行补偿。

## 五、可复现验证

```bash
node selftest.js
```

输出包含：三方向 RMS/峰值、纯联动 ILD、全链路 ILD、侧信号增益、远近层次、底噪门、配置导出一致性。全部 PASS 才允许发布。
