/* ══════════════════════════════════════════════════════════════════════
   계산 엔진 — 교사 화면과 학생 화면이 같은 파일을 쓴다.
   두 화면의 숫자가 어긋날 수 없도록 여기 한 곳에만 둔다.
   ══════════════════════════════════════════════════════════════════════ */
(function (W) {
  'use strict';
  var okey = function (team, round) { return team + ' ' + round; };

  /* ═══════════════════ 계산 엔진 ═══════════════════ */
  /* 라운드 r의 주문은 P(r-1)로 체결되고(r=0은 P(0)), P(r)로 평가된다.
     이자·배당은 라운드 시작 시점의 보유량 × 체결가 × 이율로 현금 지급. */
  function runEngine(cfg, orders) {
    const A = cfg.assets, NA = A.length, NR = cfg.prices.length - 1;
    const R = cfg.rules, teams = cfg.teams;
    const st = teams.map(() => ({ hold: new Array(NA).fill(0), cash: R.initialCash }));
    const out = [];

    for (let r = 0; r <= NR; r++) {
      const xp = cfg.prices[Math.max(0, r - 1)];
      const rp = cfg.prices[r];
      const row = [];
      for (let t = 0; t < teams.length; t++) {
        const s = st[t];
        const rec = orders[okey(teams[t], r)];
        const submitted = !!rec;
        const count = rec ? (rec.count || 1) : 0;

        const interest = r === 0 ? 0
          : s.hold.reduce((acc, h, i) => acc + h * xp[i] * (A[i].rate || 0), 0);

        const net = new Array(NA).fill(0);
        if (rec) {
          for (const o of rec.items) {
            const i = A.findIndex((a) => a.name === o.asset);
            if (i >= 0) net[i] += (o.side === '매도' ? -o.qty : o.qty);
          }
        }
        const nh = s.hold.map((h, i) => Math.max(0, h + net[i]));
        const exc = r === 0 ? 0
          : nh.reduce((c, h, i) => c + (h > s.hold[i] + net[i] ? 1 : 0), 0);
        const buy = nh.reduce((acc, h, i) => acc + (h - s.hold[i]) * xp[i], 0);
        const fee = r === 0 ? 0
          : nh.reduce((acc, h, i) => acc + Math.max(0, s.hold[i] - h) * xp[i] * (A[i].fee || 0), 0);
        const cash = s.cash + interest - buy - fee;

        const valX = nh.reduce((acc, h, i) => acc + h * xp[i], 0);
        const valR = nh.reduce((acc, h, i) => acc + h * rp[i], 0);
        const totX = valX + cash, totR = valR + cash;

        const stkX = nh.map((h, i) => A[i].kind === '주식' ? h * xp[i] : 0);
        const stkR = nh.map((h, i) => A[i].kind === '주식' ? h * rp[i] : 0);
        const mxX = totX ? Math.max.apply(null, stkX) / totX : 0;
        const mxR = totR ? Math.max.apply(null, stkR) / totR : 0;
        const swX = totX ? stkX.reduce((a, b) => a + b, 0) / totX : 0;
        const swR = totR ? stkR.reduce((a, b) => a + b, 0) / totR : 0;
        const nAssets = nh.filter((q) => q > 0).length;

        row.push({
          team: teams[t], round: r, hold: nh.slice(), interest: interest,
          buy: buy, fee: fee, cash: cash,
          totX: totX, totR: totR, mxX: mxX, mxR: mxR, swX: swX, swR: swR,
          nAssets: nAssets, submitted: submitted, count: count, exc: exc,
          reason: rec ? (rec.reason || '') : ''
        });
        s.hold = nh; s.cash = cash;
      }
      out.push(row);
    }
    // 경고는 표시 시점(체결가/결과가)에 따라 달라지므로 함수로 뽑는다
    return out;
  }

  function warnOf(rec, phase, cfg) {
    const R = cfg.rules;
    /* 한 종목 한도는 주문할 때 가격(체결가)으로만 판정한다 — 결과 공개 뒤 값이 올라 넘친 것은 위반이 아니다 */
    const mx = rec.mxX;
    if (rec.cash < 0) return '자금초과';
    if (rec.exc > 0) return '매도초과';
    if (!rec.submitted) return '';
    if (mx > R.stockCap) return '한도초과';
    if (rec.nAssets < R.minAssets) return '분산부족';
    if (rec.count > 1) return '중복제출';
    return '';
  }


  W.MIENGINE = { runEngine: runEngine, warnOf: warnOf, okey: okey };
})(window);
