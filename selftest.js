// DeltaSound DSP 自检 — 与 dsp-core.js 是同一份算法（require 引入，不存在漂移）
// 用法: node selftest.js
// 只测动态链；静态 EQ（Biquad 节点）在浏览器/Electron 图里，不参与本数值自检。
const D = require('./dsp-core.js');
const sr = 48000;
const N = sr * 2;
let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };

// ---------------- 合成信号 ----------------
function windSeg() {                       // 稳态低频风声
  const a = new Float64Array(N * 2); let brown = 0;
  for (let i = 0; i < N; i++) {
    brown = brown * 0.985 + rnd() * 0.015;
    const v = brown * 0.4 + rnd() * 0.004;
    a[2 * i] = v; a[2 * i + 1] = v * 0.98;
  }
  return a;
}
function stepSeg(amp, ild) {               // 三区脚步：撞击 / 材质 / 碎物，L/R 带 ILD
  const a = new Float64Array(N * 2);
  for (let i = 0; i < N; i++) {
    const s = (i / sr) % 0.5;
    let v = rnd() * 0.0015;
    if (s < 0.14) {
      v += Math.sin(2 * Math.PI * 150 * s) * 0.22 * Math.exp(-s * 30) * amp;   // Zone1
      v += Math.sin(2 * Math.PI * 1600 * s) * 0.10 * Math.exp(-s * 55) * amp;  // Zone2
      v += rnd() * 0.07 * Math.exp(-s * 95) * amp;                              // Zone3 宽带摩擦
    }
    a[2 * i] = v; a[2 * i + 1] = v * ild;
  }
  return a;
}
function gunSeg() {                        // 枪声：低频体 + 4.2kHz 刺耳
  const a = new Float64Array(N * 2);
  for (let i = 0; i < N; i++) {
    const t = i / sr; let v = rnd() * 0.002;
    for (const g of [0.4, 1.2]) {
      const d = t - g;
      if (d >= 0 && d < 0.35) {
        v += rnd() * 0.8 * Math.exp(-d * 22);
        v += rnd() * 0.4 * Math.exp(-d * 45) * Math.sin(2 * Math.PI * 4200 * d);
      }
    }
    a[2 * i] = v; a[2 * i + 1] = v;
  }
  return a;
}
function noiseFloorSeg() {                 // 极安静底噪，验证 -58dBFS 门
  const a = new Float64Array(N * 2);
  for (let i = 0; i < N; i++) { const v = rnd() * 0.00002; a[2 * i] = v; a[2 * i + 1] = v; }
  return a;
}

// ---------------- 跑链 ----------------
function run(interleaved, params) {
  const n = interleaved.length / 2;
  const L = new Float64Array(n), R = new Float64Array(n);
  for (let i = 0; i < n; i++) { L[i] = interleaved[2 * i]; R[i] = interleaved[2 * i + 1]; }
  const oL = new Float64Array(n), oR = new Float64Array(n);
  const p = Object.assign({}, D.DEFAULTS, params || {});
  const dsp = D.createProcessor(sr, () => p, () => false);
  dsp.process(L, R, oL, oR);
  return { L, R, oL, oR, n, dsp };
}
function rms(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); }
function peak(a) { let p = 0; for (let i = 0; i < a.length; i++) p = Math.max(p, Math.abs(a[i])); return p; }
const dB = (a, b) => 20 * Math.log10(b / Math.max(a, 1e-12));

const P = D.DEFAULTS;
let fail = 0;
const check = (name, ok, detail) => { console.log((ok ? '  PASS ' : '  FAIL ') + name.padEnd(30) + detail); if (!ok) fail++; };

console.log('=== 1. 三方向（风声 / 脚步 / 枪声 / 底噪）===');
const segs = [['风声', windSeg()], ['脚步', stepSeg(1, 0.72)], ['枪声', gunSeg()], ['底噪', noiseFloorSeg()]];
for (const [name, seg] of segs) {
  const r = run(seg, P);
  const a = rms(r.L), b = rms(r.oL);
  const d = dB(a, b);
  console.log('  ' + name.padEnd(4) + ' RMS ' + a.toFixed(6) + ' → ' + b.toFixed(6) +
              ' (' + (d >= 0 ? '+' : '') + d.toFixed(1) + ' dB)' +
              '  峰值 ' + peak(r.L).toFixed(3) + ' → ' + peak(r.oL).toFixed(3));
  if (name === '风声') check('风声被压低', d < -1.0, d.toFixed(1) + ' dB');
  if (name === '脚步') check('脚步被抬起', d > 0.5, '+' + d.toFixed(1) + ' dB');
  if (name === '枪声') { check('枪声被削平', d < -2.0, d.toFixed(1) + ' dB');
                         check('输出峰值不过冲', peak(r.oL) <= D.C.ceiling + 1e-6, peak(r.oL).toFixed(3)); }
  if (name === '底噪') check('底噪不被拉高', d < 1.5, d.toFixed(2) + ' dB');
  check(name + ' 无 NaN', !r.oL.some(Number.isNaN) && !r.oR.some(Number.isNaN), '');
}

console.log('=== 2. ILD（左右电平差）保持 ===');
{
  const seg = stepSeg(1, 0.60);                     // 输入 ILD = 20log10(0.60) ≈ -4.44dB
  const inIld = 20 * Math.log10(0.60);
  const ild = r => 20 * Math.log10(rms(r.oR) / rms(r.oL));
  // 2a 纯机制：关掉去刺与风声抵消，只留联动增益，ILD 应严格不变
  const pure = run(seg, { side: 0, boom: 0, wind: 0 });
  const pureIld = ild(pure);
  // 2b 默认全开：去刺会保留「共同低频」，ILD 小幅向 0 收敛属预期
  const full = run(seg, { side: 0 });
  const sided = run(seg, { side: 0.5 });
  console.log('  输入 ' + inIld.toFixed(2) + ' dB | 纯联动 ' + pureIld.toFixed(2) +
              ' dB | 全链路 ' + ild(full).toFixed(2) + ' dB | 开侧向定位 ' + ild(sided).toFixed(2) + ' dB');
  check('纯联动严格保 ILD', Math.abs(pureIld - inIld) < 0.05,
        '偏差 ' + Math.abs(pureIld - inIld).toFixed(3) + ' dB');
  check('全链路 ILD 偏移可控', Math.abs(ild(full) - inIld) < 0.6,
        '偏差 ' + Math.abs(ild(full) - inIld).toFixed(3) + ' dB');
  check('侧向定位确实放大 L-R', ild(sided) < ild(full) - 0.2,
        '差值 ' + (ild(full) - ild(sided)).toFixed(2) + ' dB');
}

console.log('=== 3. 远近层次（连续斜率向上压缩，不被拉平）===');
{
  const near = run(stepSeg(1.0, 1.0), P), far = run(stepSeg(0.25, 1.0), P);
  const inRatio = rms(near.L) / rms(far.L), outRatio = rms(near.oL) / rms(far.oL);
  console.log('  输入近/远 ' + (20 * Math.log10(inRatio)).toFixed(1) + ' dB → 输出 ' +
              (20 * Math.log10(outRatio)).toFixed(1) + ' dB');
  check('远脚步被抬得更多', outRatio < inRatio, '压缩量 ' + (20 * Math.log10(inRatio / outRatio)).toFixed(1) + ' dB');
  check('远近仍可区分', outRatio > 1.6, '输出比 ' + outRatio.toFixed(2));
}

console.log('=== 4. 配置导出 ===');
{
  const txt = D.buildConfigText(P);
  const ok = txt.includes('Preamp: -6.5 dB') && txt.includes('Filter 9: ON HSC') && txt.includes('ON LSC');
  check('config.txt 含新曲线', ok, txt.split('\n').length + ' 行');
}

console.log('\n' + (fail ? '✗ ' + fail + ' 项未通过' : '✓ 全部通过') + '  | 采样率 ' + sr +
            ' Hz | 前瞻 ' + D.createProcessor(sr, () => P, () => false).lookahead + ' 样本');
process.exit(fail ? 1 : 0);
