/* ══════════════════════════════════════════════════════════════════════
   계산 엔진 — 교사 화면과 학생 화면이 같은 파일을 쓴다.
   두 화면의 숫자가 어긋날 수 없도록 여기 한 곳에만 둔다.
   ══════════════════════════════════════════════════════════════════════ */
(function (W) {
  'use strict';
  var okey = function (team, round) { return team + ' ' + round; };

  /* ═══════════════════ 계산 엔진 ═══════════════════ */
  /* 라운드 r의 주문은 P(r-1)로 체결되고(r=0은 P(0)), P(r)로 평가된다.
     이자·배당은 라운드 시작 시점의 보유량 × 체결가 × 이율로 현금 지급.
     묶이는 자산(lock > 0, 예: 정기예금)은 산 묶음(lot)마다 이자를 쌓아 두었다가
     lock 라운드를 채우면 한꺼번에 주고, 그 뒤로는 라운드마다 준다.
     다 채우기 전에 팔면 쌓인 이자 중 early(예: 0.5 = 절반)만 받는다. 파는 순서는 오래된 묶음부터. */
  const cloneLots = (L) => L.map((a) => a.map((x) => ({ q: x.q, age: x.age, accr: x.accr })));
  function runEngine(cfg, orders) {
    const A = cfg.assets, NA = A.length, NR = cfg.prices.length - 1;
    const R = cfg.rules, teams = cfg.teams;
    const st = teams.map(() => ({ hold: new Array(NA).fill(0), cash: R.initialCash,
                                  lots: A.map(() => []) }));
    const lockOf = (i) => Math.max(0, A[i].lock | 0);
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

        let interest = 0;
        if (r > 0) {
          for (let i = 0; i < NA; i++) {
            const rate = A[i].rate || 0;
            if (!lockOf(i)) { interest += s.hold[i] * xp[i] * rate; continue; }
            for (const lot of s.lots[i]) {
              lot.age += 1;
              const amt = lot.q * xp[i] * rate;
              if (lot.age >= lockOf(i)) { interest += lot.accr + amt; lot.accr = 0; }
              else lot.accr += amt;
            }
          }
        }

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
        /* 묶음 정리 — 판 만큼 오래된 묶음부터 빼고, 만기 전이면 쌓인 이자의 일부만 준다 */
        let early = 0, forfeit = 0;
        for (let i = 0; i < NA; i++) {
          if (!lockOf(i)) continue;
          let sell = s.hold[i] - nh[i];
          const keep = A[i].early == null ? 0.5 : +A[i].early;
          while (sell > 0 && s.lots[i].length) {
            const lot = s.lots[i][0], take = Math.min(lot.q, sell), lost = lot.accr * take / lot.q;
            early += lost * keep; forfeit += lost * (1 - keep);
            lot.accr -= lost; lot.q -= take; sell -= take;
            if (lot.q <= 1e-9) s.lots[i].shift();
          }
          if (nh[i] > s.hold[i]) s.lots[i].push({ q: nh[i] - s.hold[i], age: 0, accr: 0 });
        }
        const pending = s.lots.reduce((acc, L) => acc + L.reduce((a2, x) => a2 + x.accr, 0), 0);
        const cash = s.cash + interest + early - buy - fee;

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
          early: early, forfeit: forfeit, pending: pending, lots: cloneLots(s.lots),
          buy: buy, fee: fee, cash: cash,
          totX: totX, totR: totR, mxX: mxX, mxR: mxR, swX: swX, swR: swR,
          nAssets: nAssets, submitted: submitted, count: count, exc: exc,
          reason: rec ? (rec.reason || '') : '',
          roles: rec && Array.isArray(rec.roles) ? rec.roles.slice() : null
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
    if (R.stockTotalCap && rec.swX > R.stockTotalCap + 1e-9) return '주식초과';
    if (rec.nAssets < R.minAssets) return '분산부족';
    if (rec.count > 1) return '중복제출';
    return '';
  }


  /* 안정성 점수 — 활동 중 가장 크게 잃은 폭(최고점 대비 최대 낙폭)으로 매긴다.
     낙폭 0% = 만점, zeroAt(기본 30%) 이상 = 0점. 곡선으로 깎아서 작은 흔들림은 조금, 큰 폭락은 많이 깎인다:
     점수 = 만점 × (1 − (낙폭 ÷ zeroAt)²). 예) 30% 기준: 낙폭 5% → 19.4, 10% → 17.8, 20% → 11.1. totals = [시작 자금, 라운드별 총자산…] */
  function stability(totals, rules) {
    const max = (rules && rules.stabilityMax) || 20, zero = (rules && rules.stabilityZeroAt) || 0.30;
    let peak = totals.length ? totals[0] : 0, mdd = 0;
    for (const v of totals) { peak = Math.max(peak, v); if (peak > 0) mdd = Math.min(mdd, v / peak - 1); }
    const k = Math.min(1, -mdd / zero);
    const score = Math.max(0, Math.min(max, max * (1 - k * k)));
    return { mdd: mdd, score: score, max: max };
  }

  /* 최종 점수 — 수익(우리 팀 수익률) + 안정성(최대 낙폭) + 판단 근거(교사 상·중·하) + 규칙 준수(위반 감점)
     grades = { 라운드: { 팀번호: '상'|'중'|'하' } }. 사유를 낸 라운드인데 아직 안 매겼으면 '중'으로 셈한다.
     사유가 없거나 제출하지 않은 라운드는 0점. 동점이면 안정성 점수 → 총자산 순. */
  const GRADE = { '상': 1, '중': 0.6, '하': 0.3 };
  function finalScores(eng, cfg, grades) {
    const R = cfg.rules, NR = eng.length - 1, G = grades || {};
    const num = (k, d) => (R[k] == null ? d : +R[k]);
    const rows = cfg.teams.map((team, t) => {
      const path = eng.map((r) => r[t]);
      const fin = path[NR].totR;
      const stab = stability([R.initialCash].concat(path.map((p) => p.totR)), R);
      let ungraded = 0, sum = 0;
      const judge = path.map((p, r) => {
        if (!p.submitted || !String(p.reason || '').trim()) return { r: r, g: '', pts: 0, none: true };
        const g = (G[r] || {})[t] || '';
        if (!g) ungraded++;
        const pts = GRADE[g || '중'];
        sum += pts;
        return { r: r, g: g, pts: pts };
      });
      /* 교사가 직접 더한 위반 (활동 중 검색 등) — cfg.penalty = { 팀번호: 횟수 } */
      const extra = Math.max(0, +((cfg.penalty || {})[t] || 0));
      const viol = path.filter((p) => warnOf(p, 'order', cfg)).length + extra;
      return { team: team, t: t, fin: fin, ret: fin / R.initialCash - 1, stab: stab, judge: judge,
               ungraded: ungraded, viol: viol, extra: extra,
               sJudge: num('scoreJudge', 30) * sum / (NR + 1),
               sRules: Math.max(0, num('scoreRules', 20) - num('rulePenalty', 4) * viol),
               sStab: stab.score };
    });
    const byFin = rows.slice().sort((a, b) => b.fin - a.fin);
    const hi = num('retFull', 0.15), lo = num('retZero', -0.15);
    byFin.forEach((x, i) => {
      x.retRank = (i > 0 && Math.abs(x.fin - byFin[i - 1].fin) < 0.5) ? byFin[i - 1].retRank : i + 1;   /* 교사 화면 참고용 */
      /* 수익 점수는 다른 팀과 견주지 않는다 — 우리 팀 수익률만으로 (예전 설정 scoreRetStep만 있으면 순위식) */
      x.sRet = (R.retFull == null && R.scoreRetStep != null)
        ? Math.max(0, num('scoreRet', 30) - num('scoreRetStep', 2) * (x.retRank - 1))
        : num('scoreRet', 30) * Math.max(0, Math.min(1, (x.ret - lo) / (hi - lo)));
    });
    rows.forEach((x) => { x.total = x.sRet + x.sStab + x.sJudge + x.sRules; });
    const key = (x) => [Math.round(x.total * 100), Math.round(x.sStab * 100), Math.round(x.fin)];
    const cmp = (a, b) => { const p = key(a), q = key(b); for (let i = 0; i < 3; i++) if (p[i] !== q[i]) return q[i] - p[i]; return 0; };
    const out = rows.slice().sort(cmp);
    out.forEach((x, i) => { x.rank = (i > 0 && cmp(x, out[i - 1]) === 0) ? out[i - 1].rank : i + 1; });
    return out;
  }

  W.MIENGINE = { runEngine: runEngine, warnOf: warnOf, okey: okey, stability: stability,
                 finalScores: finalScores, GRADE: GRADE };
})(window);
