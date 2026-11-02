/* ══════════════════════════════════════════════════════════════════════
   MIRECORD — 학생 한 명의 활동 기록으로 창체 특기사항 초안을 만든다
     · 자율·자치활동용 / 진로활동용 두 가지
     · 근거: 교사 관찰(태그·메모) > 라운드 역할·팀 기록 > 학생 성찰지(보조)
     · 외부로 보내지 않는다 — 이 파일 안의 틀로만 조합한다
     · 초안일 뿐이다: 담임 선생님이 학생을 아는 만큼 고쳐 쓴다
   ══════════════════════════════════════════════════════════════════════ */
(function (W) {
  'use strict';

  /* 받침이 있으면 앞, 없으면 뒤 — josa('분산투자', '을', '를') */
  function josa(word, a, b) {
    const w = String(word || '').replace(/[^가-힣A-Za-z0-9]+$/, '');
    const c = w.charCodeAt(w.length - 1);
    if (c >= 0xAC00 && c <= 0xD7A3) return word + (((c - 0xAC00) % 28) ? a : b);
    return word + (/[013678]$/.test(w) ? a : b);
  }
  /* 나이스 글자 세기 — 한글 3바이트, 영문·숫자·기호 1바이트, 줄바꿈 2바이트 */
  function bytes(t) {
    let n = 0;
    for (const ch of String(t || '')) n += ch === '\n' ? 2 : (ch.charCodeAt(0) > 127 ? 3 : 1);
    return n;
  }
  const chars = (t) => [...String(t || '').replace(/\n/g, '')].length;

  /* 생활기록부에 쓰면 안 되는 말 — 대회 성격·순위, 기관·회사 이름 */
  const BAN = ['대회', '우승', '준우승', '순위', '등수', '1위', '2위', '3위', '수상', '시상', '상금', '입상',
    'KDI', '한국개발연구원', '현대차', '현대자동차', 'SK하이닉스', '하이닉스', '이마트', 'LG화학', 'KB금융', '한화솔루션', '코스피를 이긴'];
  function banned(t) { return BAN.filter((w) => String(t || '').indexOf(w) >= 0); }

  /* 글자 3개 묶음으로 본 두 글의 겹침 (0~1) */
  function grams(t) { const s = String(t || '').replace(/\s+/g, ''); const g = new Set(); for (let i = 0; i + 3 <= s.length; i++) g.add(s.slice(i, i + 3)); return g; }
  function similarity(a, b) {
    const A = grams(a), B = grams(b); if (!A.size || !B.size) return 0;
    let n = 0; A.forEach((x) => { if (B.has(x)) n++; });
    return n / (A.size + B.size - n);
  }
  /* 같은 꼴의 문장이라도 학생마다 다른 표현을 고르게 — 학번으로 정해지는 고정 선택 */
  function pick(list, seed, k) {
    let h = 7; const s = String(seed) + '|' + k; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return list[h % list.length];
  }

  const ROLE = {
    '뉴스 분석가': [
      (n, kw) => '뉴스 분석 역할을 ' + n + '차례 맡아 라운드마다 제시된 여러 뉴스 가운데 자산 가격에 영향이 큰 소식과 관련 없는 소식을 가려내고' + (kw ? ', ' + josa(kw, '을', '를') + ' 근거로' : '') + ' 팀의 판단 방향을 제안함.',
      (n, kw) => '뉴스 분석가로 ' + n + '차례 활동하며 방향이 서로 다른 뉴스들의 무게를 비교하고' + (kw ? ' ' + kw + ' 등의 변수를' : ' 핵심 변수를') + ' 짚어 팀 토의의 출발점을 마련함.'],
    '위험 관리자': [
      (n) => '위험 관리 역할을 ' + n + '차례 맡아 종목별·자산군별 비중이 한도를 넘지 않는지 계산하고, 예상이 빗나갈 때의 손실을 먼저 따져 비중 조정을 제안함.',
      (n) => '위험 관리자로 ' + n + '차례 활동하며 한 종목에 쏠린 비중과 최대 손실 폭을 점검해 팀이 분산을 유지하도록 이끎.'],
    '기록자': [
      (n) => '기록 역할을 ' + n + '차례 맡아 팀원들의 의견을 모아 매매 사유를 \'근거-예상-행동\' 순서로 정리함.',
      (n) => '기록자로 ' + n + '차례 활동하며 라운드마다 예상과 실제 결과를 나란히 적어 팀이 판단을 되돌아보게 함.'],
    '주문 담당': [
      (n) => '주문 담당을 ' + n + '차례 맡아 팀이 합의한 수량을 정확히 입력하고, 제출 전 남는 현금과 규칙 위반 여부를 확인함.',
      (n) => '주문 담당으로 ' + n + '차례 활동하며 합의된 결정을 실행하기 전 수량과 비중을 다시 점검함.']
  };
  const TAG = {
    '근거 제시 주도': ['뉴스와 수치를 근거로 들어 팀 토의를 이끎.', '판단마다 근거를 먼저 제시하여 팀의 논의를 구체화함.'],
    '위험을 먼저 짚음': ['예상이 틀렸을 때의 손실을 먼저 짚어 팀이 비중을 조정하도록 제안함.', '한 종목에 몰리는 위험을 먼저 지적하며 분산을 제안함.'],
    '의견 조율': ['의견이 갈릴 때 각자의 근거를 비교해 합의안을 만드는 데 기여함.', '서로 다른 의견을 정리해 절충안을 제시함.'],
    '계산이 정확함': ['매수·매도 수량과 비중을 정확히 계산해 규칙을 지키는 데 기여함.', '남는 현금과 비중 변화를 꼼꼼히 계산함.'],
    '해설을 다음 판단에 연결': ['앞 라운드의 결과 해설에서 배운 내용을 다음 판단에 적용함.', '결과 해설을 바탕으로 예상이 빗나간 이유를 찾아 다음 판단을 고침.'],
    '꼼꼼한 기록': ['팀의 판단 과정을 빠짐없이 기록해 근거 있는 매매 사유를 쓰는 데 기여함.', '라운드마다 예상과 결과를 비교해 기록함.'],
    '질문이 날카로움': ['결과를 두고 \'왜 그렇게 움직였는가\'를 끝까지 묻고 답을 찾으려 함.', '핵심을 짚는 질문으로 팀의 논의를 깊게 함.'],
    '맡은 역할 이상 참여': ['맡은 역할 밖의 일에도 적극적으로 참여하며 팀을 도움.', '자신의 역할을 마친 뒤 다른 역할을 맡은 팀원을 도움.']
  };
  /* 팀 매매 사유에서 무엇을 근거로 삼았는지 — 글을 옮기지 않고 주제만 뽑는다 */
  const KW = [[/금리/, '금리 변화'], [/환율/, '환율'], [/관세/, '관세 정책'], [/반도체|메모리|HBM/i, '반도체 업황'], [/배당|주주/, '주주환원'],
    [/분산|나눠|나누/, '분산투자'], [/유가|기름/, '국제유가'], [/전쟁|중동/, '지정학적 위험'], [/정부|정책|법/, '정부 정책'], [/수출/, '수출 여건'],
    [/소비|내수|장보/, '내수 소비'], [/전기차|배터리/, '전기차 산업'], [/태양광|친환경/, '친환경 에너지 정책'], [/채권|국채|예금/, '채권·예금의 안정성'],
    [/실적|이익|매출/, '기업 실적'], [/외국인/, '외국인 자금 흐름'], [/로봇/, '신산업 기대']];
  function keywords(texts) {
    const all = (texts || []).join(' '), out = [];
    KW.forEach(([re, w]) => { if (re.test(all) && out.indexOf(w) < 0) out.push(w); });
    return out;
  }
  /* 희망 진로 → 활동에서 이어 볼 지점 */
  const FIELD = [
    [/반도체|전자|컴퓨터|소프트웨어|공학|AI|인공지능|IT|데이터|프로그래/i,
      '메모리 반도체 업황 뉴스가 기업 실적 기대와 주가에 반영되는 과정을 따라가며, 실적이 좋아도 주가가 떨어질 수 있는 \'기대의 선반영\'에 관심을 보임.'],
    [/경영|경제|회계|금융|무역|마케팅|창업|세무|증권|은행/,
      '기업의 이익과 주주환원 정책이 주가에 미치는 영향을 살피고, 같은 뉴스라도 산업마다 손익이 갈리는 점을 정리함.'],
    [/화학|환경|에너지|신소재|기계|자동차|건축|토목|조선/,
      '전기차·친환경 지원 정책의 변화가 소재·에너지 기업의 가치에 미치는 영향을 비교하며 산업과 정책의 연결 고리를 탐색함.'],
    [/법|행정|정치|외교|경찰|공무|국제/,
      '관세 부과와 주주 권리 관련 법 개정 같은 제도 변화가 기업과 투자자에게 미치는 영향을 비교하며 정책의 파급 효과에 관심을 보임.'],
    [/의사|의학|간호|약학|약사|보건|생명|바이오|수의/,
      '불확실한 정보 속에서 위험과 이익을 함께 따져 결정하는 과정을 경험하며, 근거에 바탕을 둔 판단의 중요성을 자신의 관심 분야와 연결함.'],
    [/교육|교사|사범|상담|심리|사회복지/,
      '또래와 함께 금융 개념을 익히는 과정을 겪으며 금융 이해력 교육의 필요성과 어려운 개념을 쉽게 설명하는 방법에 관심을 보임.'],
    [/디자인|미술|음악|체육|예술|미디어|방송|언론|영상|광고/,
      '뉴스 제목과 전달 방식이 사람들의 판단에 주는 영향을 체감하며, 정보를 전하는 방식의 책임에 관심을 보임.']];
  const GENERAL = '경제 뉴스가 일상과 여러 산업에 미치는 영향을 살피며 자신의 관심 분야와 이어질 지점을 탐색함.';
  const SKILL = { '뉴스 분석가': '여러 정보 가운데 중요한 것을 가려내는 경험', '위험 관리자': '위험을 수치로 따져 보는 경험',
    '기록자': '팀의 생각을 근거 중심으로 정리하는 경험', '주문 담당': '합의된 결정을 정확히 실행하고 점검하는 경험' };

  const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  const end = (t) => { t = clean(t); return !t ? '' : /[.!?。]$/.test(t) ? t : t + '.'; };

  /* 글자 수 안에 들어올 때까지 뒤쪽(덜 중요한) 문장부터 뺀다 */
  function fit(parts, max) {
    const keep = parts.filter((p) => p && p.t);
    const join = (xs) => xs.map((p) => p.t).join(' ');
    let xs = keep.slice();
    while (xs.length > 1 && chars(join(xs)) > max) {
      let lo = -1, lp = 1e9; xs.forEach((p, i) => { if (p.p < lp) { lp = p.p; lo = i; } });
      xs.splice(lo, 1);
    }
    return join(xs);
  }

  /* ctx: { sid, name, program:{name, when, hours}, roleCounts:{역할:횟수}, roleRounds, tags:[], memo,
            reflect:{concepts:[], qCareer, qLink, qNext}, career:{title, obs},
            team:{ mdd, viol, rounds, keywords:[] }, max:{auto, career} } */
  function build(ctx) {
    const P = ctx.program || {}, sid = ctx.sid;
    const prog = clean(P.name || '모의투자 프로젝트');
    const when = clean(P.when || '');
    const intro = prog + (when || P.hours ? '(' + [when, P.hours ? P.hours + '시간' : ''].filter(Boolean).join(', ') + ')' : '') +
      '에 참여하여 팀원들과 ' + (ctx.team && ctx.team.rounds ? ctx.team.rounds + '차례' : '여러 차례') + ' 투자 판단을 내림.';
    const roles = Object.entries(ctx.roleCounts || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    const kl = ((ctx.team && ctx.team.keywords) || []).slice(0, 2);
    const kwP = kl.length > 1 ? josa(kl[0], '과', '와') + ' ' + kl[1] : (kl[0] || '');
    const parts = [];
    if (roles[0]) parts.push({ p: 9, t: pick(ROLE[roles[0][0]], sid, 'r1')(roles[0][1], kwP) });
    if (roles[1] && ROLE[roles[1][0]]) parts.push({ p: 4, t: '또한 ' + pick(ROLE[roles[1][0]], sid, 'r2')(roles[1][1], '').replace(/^.+?(맡아|활동하며) /, roles[1][0] + ' 역할에서는 ') });
    (ctx.tags || []).filter((t) => TAG[t]).slice(0, 2).forEach((t, i) => parts.push({ p: 8 - i, t: pick(TAG[t], sid, t) }));
    /* 교사 메모의 'R3에서' 같은 진행 용어는 빼고 넣는다 */
    const memo = clean(String(ctx.memo || '').replace(/\bR\d+\s*(에서|때|부터)?\s*/g, '').replace(/^[,·\s]+/, ''));
    if (memo) parts.push({ p: 10, t: end(memo) });
    const tm = ctx.team || {};
    if (tm.mdd != null && tm.mdd > -0.1) parts.push({ p: 3, t: '가격이 크게 흔들린 라운드에서도 자산을 나눠 담아 최대 손실을 ' + Math.max(1, Math.ceil(-tm.mdd * 100)) + '% 안으로 관리하는 데 함께함.' });
    else if (tm.viol === 0) parts.push({ p: 3, t: '비중 한도 규칙을 끝까지 지키며 위험을 나누는 투자를 실천함.' });
    const rf = ctx.reflect || {};
    const cs = (rf.concepts || []).slice(0, 2);
    if (cs.length) parts.push({ p: 5, t: '활동 후 ' + (cs.length > 1 ? josa(cs[0], '과', '와') + ' ' + cs[1] : cs[0]) + '의 의미를 자신의 말로 정리함.' });
    if (clean(rf.qNext)) parts.push({ p: 2, t: '자신의 판단을 되돌아보며 다음에 고칠 점을 구체적으로 찾음.' });
    const auto = fit([{ p: 99, t: intro }].concat(parts), (ctx.max && ctx.max.auto) || 500);

    /* 진로 */
    const car = clean(rf.qCareer);
    const field = (FIELD.find(([re]) => re.test(car + ' ' + (rf.qLink || ''))) || [null, GENERAL])[1];
    const cparts = [];
    cparts.push({ p: 99, t: (car && !/정하지|모르|없음/.test(car) ? josa(car, '에', '에') + ' 관심을 둔 학생으로, ' : '') + prog + '에 참여함.' });
    cparts.push({ p: 9, t: field });
    if (roles[0] && SKILL[roles[0][0]]) cparts.push({ p: 7, t: roles[0][0] + ' 역할로 ' + josa(SKILL[roles[0][0]], '을', '를') + (car ? ' 희망 진로에 필요한 역량과 연결 지어 되돌아봄.' : ' 자신이 키우고 싶은 역량과 연결 지어 되돌아봄.') });
    const lk = keywords([rf.qLink || '']);
    if (lk.length) cparts.push({ p: 6, t: '특히 ' + (lk.length > 1 ? josa(lk[0], '과', '와') + ' ' + lk[1] : lk[0]) + '에 대해 더 알아보고 싶다는 탐구 의지를 보임.' });
    const cr = ctx.career || {};
    if (clean(cr.title)) cparts.push({ p: 10, t: '후속 탐구로 ' + josa('\'' + clean(cr.title) + '\'', '을', '를') + ' 주제로 조사함.' + (clean(cr.obs) ? ' ' + end(cr.obs) : '') });
    (ctx.tags || []).filter((t) => t === '질문이 날카로움' || t === '해설을 다음 판단에 연결').slice(0, 1)
      .forEach((t) => cparts.push({ p: 5, t: pick(TAG[t], sid, 'c' + t) }));
    const career = fit(cparts, (ctx.max && ctx.max.career) || 700);
    return { auto: auto, career: career, intro: intro };
  }

  W.MIRECORD = { build: build, bytes: bytes, chars: chars, banned: banned, similarity: similarity, keywords: keywords, josa: josa };
})(typeof window !== 'undefined' ? window : globalThis);
