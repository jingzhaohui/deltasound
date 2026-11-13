/* ============================================================================
 * DeltaSound DSP core — single source of truth
 * ----------------------------------------------------------------------------
 * 浏览器 <script src="dsp-core.js"> → window.DeltaSoundDSP
 * Node  require('./dsp-core.js')   → 同一套 API（selftest.js 使用）
 *
 * 设计要点（对齐开源同类项目的共识，见 docs/RESEARCH.md）：
 *  1. 立体声联动：所有包络取自 max(|L|,|R|)，所有增益标量同时乘到 L/R。
 *     逐声道独立压缩会改写 ILD，直接破坏 HRTF 的左右定位线索。
 *  2. 连续斜率向上压缩：只抬低于 -32dBFS 的微弱声，越弱补得越多但有
 *     上限与 -58dBFS 底噪门；增益下降快、恢复慢，避免 pumping 与拉高底噪。
 *  3. 侧信号(L-R)增强：只在脚步活动期抬侧信号，不动中置，不改 ITD。
 *  4. 枪声动态去刺：只在检测到 2.5–9kHz 强瞬态时衰减高频，而非静态砍死
 *     6–12kHz 的距离线索。
 *  5. 1.5ms 前瞻 + 0.2ms attack 的联动限幅 + tanh 软削波，压住首峰且
 *     不引入硬钳谐波失真。
 * ==========================================================================*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DeltaSoundDSP = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var cl = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var db2lin = function (d) { return Math.pow(10, d / 20); };
  var lin2db = function (x) { return 20 * Math.log10(Math.max(x, 1e-7)); };
  var sig = function (x, w) { return 1 / (1 + Math.exp(-cl(x / w, -60, 60))); };

  // 默认参数（0–1 归一化）；dB 上限见 DEFS 的 max
  var DEFAULTS = { body: 0.35, foot: 0.5, quiet: 0.6, surface: 0.6,
                   detail: 0.4, side: 0.5, wind: 0.7, boom: 0.7 };

  // 静态 EQ：低频掩蔽抑制 + 三区脚步模型 + 距离线索保留
  var EQ = {
    preampDb: -6.5,
    hpBaseHz: 90,          // 只切 <90Hz 的 rumble，保留 150–450Hz 脚步体感/楼层线索
    hpWindHz: 50,          // 风声滑块额外抬高高通拐点
    lowShelfHz: 120, lowShelfDb: -3.5, lowShelfQ: 0.70,
    mudHz: 700, mudDb: -2.0, mudQ: 1.40,          // shallow scoop 去浑浊
    bands: [
      { key: 'body',    hz: 220,  q: 1.10, maxDb: 3.0 },  // Zone1 撞击/垂直
      { key: 'foot',    hz: 420,  q: 1.20, maxDb: 3.5 },  // Zone1 上沿
      { key: 'quiet',   hz: 1600, q: 1.00, maxDb: 3.0 },  // Zone2 表面材质
      { key: 'surface', hz: 3200, q: 1.40, maxDb: 4.0 },  // Zone2/3 瞬态与方位（主提升）
      { key: 'detail',  hz: 6000, q: 1.00, maxDb: 2.5 }   // Zone3 碎物/距离
    ],
    highShelfHz: 10000, highShelfDb: -1.0, highShelfQ: 0.70
  };

  // 动态链常量（dBFS / 秒）
  var C = {
    // 阈值按「全带宽慢包络」标定（BinauralAssist 用带通包络 -32dBFS，
    // 尺度不同故取 -24dBFS）， Ratio 2.5 / 上限 +14dB / 底噪门 -58dBFS
    upThrDb: -24, upRatio: 2.5, gateDb: -58, maxUpDb: 14,
    gunThrDb: -26, gunTransDb: 5, gunCutMax: 0.65,
    limLookMs: 1.5, limAttackS: 0.0002, limReleaseS: 0.09,
    ceiling: 0.89
  };

  var softClip = function (v) {
    var c = C.ceiling, k = 1 - c, a = Math.abs(v);
    if (a <= c) return v;
    return Math.sign(v) * (c + k * Math.tanh((a - c) / k));
  };

  /**
   * @param {number} sr 采样率
   * @param {function} getParams 返回归一化参数对象
   * @param {function} isBypassed 返回是否旁路
   */
  function createProcessor(sr, getParams, isBypassed) {
    var tau = function (t) { return 1 - Math.exp(-1 / (sr * t)); };
    var coef = function (fc) { return 1 - Math.exp(-2 * Math.PI * fc / sr); };
    var aLP = coef(250), aLP2 = coef(1800);
    var aLpF = tau(0.006), aLpS = tau(0.45);
    var aFast = tau(0.0015), aSlow = tau(0.08);
    var aHfF = tau(0.003), aHfS = tau(0.40);
    var aGunA = tau(0.002), aGunR = tau(0.15);
    var aLimA = tau(C.limAttackS), aLimR = tau(C.limReleaseS);

    var LOOK = Math.max(1, Math.round(sr * C.limLookMs / 1000));
    var dl = new Float64Array(LOOK), dr = new Float64Array(LOOK);
    var w = 0;

    var S = {
      lp: [0, 0], lp2: [0, 0], lpFast: 0, lpSlow: 0,
      allFast: 0, allSlow: 0, fast: 0, slow: 0,
      hfFast: 0, hfSlow: 0, gunAct: 0, upGain: 1, limGain: 1,
      peakIn: 0, windAmt: 0, gr: 0
    };

    function process(L, R, oL, oR) {
      var N = L.length;
      if (isBypassed()) {
        oL.set(L); oR.set(R);
        dl.fill(0); dr.fill(0);
        S.peakIn = 0; S.windAmt = 0; S.gr = 0;
        return;
      }
      var P = getParams();
      var wind = P.wind, foot = P.foot, quiet = P.quiet, boom = P.boom, side = P.side;
      var maxUp = quiet * C.maxUpDb;
      var limThr = 0.55 - boom * 0.30;
      var peakIn = 0, windSum = 0, grSum = 0, n = 0;

      for (var i = 0; i < N; i++) {
        var xl = L[i], xr = R[i];
        var m = Math.max(Math.abs(xl), Math.abs(xr));
        if (m > peakIn) peakIn = m;

        // --- 低频稳态（风声）估计：取两声道低频的「中置分量」做抵消 ---
        S.lp[0] += aLP * (xl - S.lp[0]);
        S.lp[1] += aLP * (xr - S.lp[1]);
        S.lp2[0] += aLP2 * (xl - S.lp2[0]);
        S.lp2[1] += aLP2 * (xr - S.lp2[1]);
        var lpMid = (S.lp[0] + S.lp[1]) * 0.5, al = Math.abs(lpMid);
        S.lpFast += aLpF * (al - S.lpFast);
        S.lpSlow += aLpS * (al - S.lpSlow);
        var stead = cl(S.lpSlow / (S.lpFast + 1e-7), 0, 1);       // 长期≈短期 → 稳态
        S.allFast += aLpF * (m - S.allFast);
        S.allSlow += aLpS * (m - S.allSlow);
        var steadAll = cl(S.allSlow / (S.allFast + 1e-7), 0, 1);
        var cut = wind * 1.1 * stead * lpMid;                       // 共同量，L/R 同减
        windSum += Math.abs(cut);
        var wGain = 1 - wind * 0.8 * steadAll;
        var a = (xl - cut) * wGain, b = (xr - cut) * wGain;

        // --- 枪声检测：>1.8kHz 高频带的电平 + 瞬态，双 sigmoid 给出连续活动度 ---
        // 高频分解必须用「共同的中置低频」，逐声道 lp2 会改写 L−R 比例
        var lp2Mid = (S.lp2[0] + S.lp2[1]) * 0.5;
        var hpMid = ((a - lp2Mid) + (b - lp2Mid)) * 0.5;
        S.hfFast += aHfF * (Math.abs(hpMid) - S.hfFast);
        S.hfSlow += aHfS * (Math.abs(hpMid) - S.hfSlow);
        var hfDb = lin2db(S.hfFast), hfSlowDb = lin2db(S.hfSlow);
        var gunGate = sig(hfDb - C.gunThrDb, 3) * sig((hfDb - hfSlowDb) - C.gunTransDb, 2);
        S.gunAct += (gunGate > S.gunAct ? aGunA : aGunR) * (gunGate - S.gunAct);

        // --- 动态去刺：仅枪声活动期削 2.5–9kHz，系数联动，不破坏 ILD ---
        var deess = 1 - boom * C.gunCutMax * S.gunAct;
        var oneMinus = 1 - deess;
        a -= oneMinus * (a - lp2Mid);
        b -= oneMinus * (b - lp2Mid);

        // --- 瞬态（脚步）+ 连续斜率向上压缩（静步），全部联动 ---
        var am = Math.max(Math.abs(a), Math.abs(b));
        S.fast += aFast * (am - S.fast);
        S.slow += aSlow * (am - S.slow);
        var tr = cl(S.fast / (S.slow + 1e-5) - 2.5, 0, 2);
        // 用慢包络而非瞬时样本判定「有多弱」：脚步事件整体被抬，
        // 而不是只抬起音后的尾音或间隙噪声，听感更稳、层次更清楚
        var envDb = lin2db(S.slow + 1e-7);
        var gate = sig(envDb - C.gateDb, 3) * (1 - 0.85 * S.gunAct);
        // 平方门控：稳态风声/底噪几乎拿不到提升，脚步瞬态不受影响
        var noiseGate = (1 - steadAll) * (1 - steadAll);
        var upDb = cl((C.upThrDb - envDb) * (1 - 1 / C.upRatio), 0, maxUp)
                   * gate * noiseGate;
        var targetUp = db2lin(upDb);
        // 增益下降快、恢复慢 → 枪声瞬间立刻退让，不产生抽气感
        S.upGain += (targetUp < S.upGain ? 0.01 : 0.0005) * (targetUp - S.upGain);
        var tg = 1 + foot * 0.45 * tr * (1 - steadAll) * (1 - 0.85 * S.gunAct);
        a *= S.upGain * tg; b *= S.upGain * tg;

        // --- 侧信号增强：只抬 L−R，中置不动；脚步活动期生效 ---
        var footAct = cl(tr * 0.5 + 0.3 * cl(am / 0.05, 0, 1), 0, 1) * (1 - S.gunAct);
        var sg = 1 + side * 0.585 * footAct;        // 上限约 +4dB
        var mid = (a + b) * 0.5, sd = (a - b) * 0.5 * sg;
        a = mid + sd; b = mid - sd;

        // --- 前瞻联动限幅：用「当前」峰值压「LOOK 之前」的样本 ---
        var pk = Math.max(Math.abs(a), Math.abs(b));
        var target = 1;
        if (pk > limThr) target = 1 - boom * (1 - limThr / pk);
        S.limGain += (target < S.limGain ? aLimA : aLimR) * (target - S.limGain);
        grSum += -20 * Math.log10(Math.max(S.limGain, 1e-4));
        var r = (w + 1) % LOOK;
        oL[i] = softClip(dl[r] * S.limGain);
        oR[i] = softClip(dr[r] * S.limGain);
        dl[w] = a; dr[w] = b; w = r;
        n++;
      }
      S.peakIn = S.peakIn * 0.7 + peakIn * 0.3;
      S.windAmt = n ? cl(windSum / (n * 0.02), 0, 1) : 0;
      S.gr = n ? grSum / n : 0;
    }

    return { process: process, state: S, lookahead: LOOK, sampleRate: sr };
  }

  /** 生成 Equalizer APO 的 config.txt（静态 EQ；动态部分见注释） */
  function buildConfigText(P) {
    var f = function (x) { return x.toFixed(1); };
    var hp = Math.round(EQ.hpBaseHz + P.wind * EQ.hpWindHz);
    var g = function (key) { return f(P[key] * EQ.bands.filter(function (b) { return b.key === key; })[0].maxDb); };
    return [
      '# DeltaSound · 由 DeltaSound 导出（' + new Date().toLocaleString('zh-CN') + '）',
      '# 覆盖到 C:\\Program Files\\EqualizerAPO\\config\\config.txt',
      '# 曲线依据「三区脚步频段模型」与低频向上掩蔽原理，详见 docs/RESEARCH.md',
      '# 只处理静态 EQ；风声抵消 / 向上压缩 / 动态去刺 / 前瞻限幅需实时链或 VST',
      '',
      'Preamp: ' + EQ.preampDb.toFixed(1) + ' dB',
      '',
      '# 切次低频 rumble（20–80Hz 是最强掩蔽源），保留 150–450Hz 脚步体感与楼层线索',
      'Filter 1: ON HPQ Fc ' + hp + ' Hz Q 0.707',
      '# 低架衰减：削减低频向上掩蔽，比提高频更有效且不会让枪声变刺',
      'Filter 2: ON LSC Fc ' + EQ.lowShelfHz + ' Hz Gain ' + EQ.lowShelfDb.toFixed(1) + ' dB Q ' + EQ.lowShelfQ.toFixed(2),
      '# shallow scoop：500–800Hz 浑浊/箱声区',
      'Filter 3: ON PK Fc ' + EQ.mudHz + ' Hz Gain ' + EQ.mudDb.toFixed(1) + ' dB Q ' + EQ.mudQ.toFixed(2),
      '# Zone1 撞击 / Zone2 材质 / Zone2-3 瞬态方位 / Zone3 碎物距离',
      'Filter 4: ON PK Fc 220 Hz Gain ' + g('body') + ' dB Q 1.10',
      'Filter 5: ON PK Fc 420 Hz Gain ' + g('foot') + ' dB Q 1.20',
      'Filter 6: ON PK Fc 1600 Hz Gain ' + g('quiet') + ' dB Q 1.00',
      'Filter 7: ON PK Fc 3200 Hz Gain ' + g('surface') + ' dB Q 1.40',
      'Filter 8: ON PK Fc 6000 Hz Gain ' + g('detail') + ' dB Q 1.00',
      '# 6–12kHz 承载距离线索，只做 1dB 轻架；刺耳声交给动态去刺',
      'Filter 9: ON HSC Fc ' + EQ.highShelfHz + ' Hz Gain ' + EQ.highShelfDb.toFixed(1) + ' dB Q ' + EQ.highShelfQ.toFixed(2),
      '',
      '# 动态处理（Equalizer APO 原生不支持），两条路二选一：',
      '#  (a) Peace GUI 挂 VST：ReaComp(thr -18dB, 4:1, atk 3ms, rel 120ms)',
      '#      → ReaLimit(ceiling -1.0dB, lookahead 1.5ms)',
      '#  (b) 用同目录 index.html 的实时链 + VB-Cable / BlackHole 虚拟声卡',
      '#  完整参数：向上压缩 -24dBFS(全带宽慢包络) / 2.5:1 / 上限 +14dB / 底噪门 -58dBFS；',
      '#            枪声动态去刺 2.5–9kHz 最多 -9dB；侧信号最多 +4dB',
      '# 风声压制=' + Math.round(P.wind * 100) + '%  防炸耳=' + Math.round(P.boom * 100) + '%  侧向定位=' + Math.round(P.side * 100) + '%',
      ''
    ].join('\n');
  }

  return { DEFAULTS: DEFAULTS, EQ: EQ, C: C, createProcessor: createProcessor,
           buildConfigText: buildConfigText, softClip: softClip };
});
