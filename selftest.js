// DeltaSound DSP 核心自检（与 index.html 中 onProcess 算法一致，纯 Node 可跑）
// 用法: node selftest.js
// 合成 6s 信号: 稳态风声 / 脚步 / 枪声，验证「压风声 / 提脚步 / 压枪声」三个方向
const sr=48000, cl=(v,a,b)=>v<a?a:(v>b?b:v), tau=a=>1-Math.exp(-1/(sr*a));
const aLP=1-Math.exp(-2*Math.PI*250/sr), aLP2=1-Math.exp(-2*Math.PI*1800/sr);
const aFast=tau(0.0015),aSlow=tau(0.08),aLpF=tau(0.006),aLpS=tau(0.45),aHfF=tau(0.003),aHfS=tau(0.4),aAtk=tau(0.003),aRel=tau(0.12);
const S={lp:[0,0],lp2:[0,0],lpFast:[0,0],lpSlow:[0,0],allFast:[0,0],allSlow:[0,0],fast:[0,0],slow:[0,0],hfFast:[0,0],hfSlow:[0,0],comp:1};
function process(x,P){
  const wind=P.wind*0.9,foot=P.foot,quiet=P.quiet,boom=P.boom,thr=0.55-boom*0.30; const y=[];
  for(let i=0;i<x.length;i++){
    let out=[x[i],x[i]];
    for(let c=0;c<2;c++){
      let v=out[c];
      S.lp[c]+=aLP*(v-S.lp[c]); S.lp2[c]+=aLP2*(v-S.lp2[c]);
      const lp=S.lp[c],al=Math.abs(lp);
      S.allFast[c]+=aLpF*(Math.abs(v)-S.allFast[c]); S.allSlow[c]+=aLpS*(Math.abs(v)-S.allSlow[c]);
      const steadAll=cl(S.allSlow[c]/(S.allFast[c]+1e-6),0,1);
      S.lpFast[c]+=aLpF*(al-S.lpFast[c]); S.lpSlow[c]+=aLpS*(al-S.lpSlow[c]);
      const stead=cl(S.lpSlow[c]/(S.lpFast[c]+1e-6),0,1);
      let z=(v-wind*1.1*stead*lp)*(1-wind*0.8*steadAll);
      const hp=z-S.lp2[c];
      S.hfFast[c]+=aHfF*(Math.abs(hp)-S.hfFast[c]); S.hfSlow[c]+=aHfS*(Math.abs(hp)-S.hfSlow[c]);
      z-=boom*0.55*cl(S.hfFast[c]/(S.hfSlow[c]+1e-6)-1,0,3)*hp;
      S.fast[c]+=aFast*(Math.abs(z)-S.fast[c]); S.slow[c]+=aSlow*(Math.abs(z)-S.slow[c]);
      const tr=cl(S.fast[c]/(S.slow[c]+1e-5)-2.5,0,2);
      out[c]=z*(1+quiet*0.85*cl(1-S.slow[c]/0.05,0,1)*Math.pow(1-stead,2))*(1+foot*0.45*tr*(1-steadAll));
    }
    const pk=Math.max(Math.abs(out[0]),Math.abs(out[1]));
    let target=1; if(pk>thr) target=1-boom*(1-thr/pk);
    S.comp+=(target-S.comp)*(target<S.comp?aAtk:aRel);
    y.push(cl(out[0]*S.comp,-0.94,0.94));
  }
  return y;
}
let seed=7; const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296*2-1;};
const N=sr*2,x=new Float64Array(N*3); let brown=0;
for(let i=0;i<N;i++){brown=brown*0.985+rnd()*0.015;x[i]=brown*0.4+rnd()*0.004;}
for(let i=0;i<N;i++){const t=i/sr,s=t%0.5;let v=rnd()*0.002;
  if(s<0.12){const e=Math.exp(-s*36);v+=Math.sin(2*Math.PI*85*s)*0.30*e+rnd()*Math.exp(-s*70)*0.10;} x[N+i]=v;}
for(let i=0;i<N;i++){const t=i/sr;let v=rnd()*0.002;
  for(const g of [0.4,1.2]){const d=t-g;if(d>=0&&d<0.35){const e=Math.exp(-d*22);v+=rnd()*0.8*e+rnd()*0.4*Math.exp(-d*45)*Math.sin(2*Math.PI*4200*d);}} x[2*N+i]=v;}
const y=process(x,{wind:0.7,foot:0.5,quiet:0.5,boom:0.7});
const st=(a,s,e)=>{let r=0,p=0;for(let i=s;i<e;i++){r+=a[i]*a[i];p=Math.max(p,Math.abs(a[i]));}return{rms:Math.sqrt(r/(e-s)),peak:p};};
for(const [n,s,e] of [['风声',0,N],['脚步',N,2*N],['枪声',2*N,3*N]]){
  const a=st(x,s,e),b=st(y,s,e);
  console.log(n.padEnd(4),'RMS',a.rms.toFixed(5),'→',b.rms.toFixed(5),`(${(20*Math.log10(b.rms/a.rms)).toFixed(1)}dB)`,'| 峰值',a.peak.toFixed(3),'→',b.peak.toFixed(3));
}
console.log('NaN?',y.some(Number.isNaN),'clipped?',y.some(v=>Math.abs(v)>0.95));
