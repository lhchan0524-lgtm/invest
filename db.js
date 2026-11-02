/* ══════════════════════════════════════════════════════════════════════
   MIDB — 화면들을 잇는 얇은 층
     · 파이어베이스가 설정돼 있으면  → 기기와 기기를 잇는다 (진짜 실시간)
     · 비어 있으면                  → 한 브라우저 안에서만 잇는다 (연습 모드)
   두 경우 모두 바깥에서 보이는 사용법은 똑같다.
   ══════════════════════════════════════════════════════════════════════ */
(function (W) {
  'use strict';

  var CFG   = (W.MI_CONFIG || {});
  var FB    = CFG.firebase || {};
  var ROOM  = String(CFG.roomId || 'room').replace(/[.#$\[\]\/]/g, '-');
  var USE_FB = !!(FB.databaseURL && FB.apiKey);

  var cbs = { state: [], orders: [], pub: [], signup: [], reflect: [], status: [] };
  var cache = { state: null, orders: {}, pub: null, signup: {}, reflect: {} };
  var status = { state: USE_FB ? 'connecting' : 'local', msg: '', at: 0 };

  function fire(k, v) { cbs[k].forEach(function (f) { try { f(v); } catch (e) {} }); }
  function setStatus(s, m) {
    status = { state: s, msg: m || '', at: Date.now() };
    fire('status', status);
  }
  function on(k) { return function (cb) { cbs[k].push(cb); if (cache[k === 'pub' ? 'pub' : k] != null) { try { cb(cache[k === 'pub' ? 'pub' : k]); } catch (e) {} } }; }

  /* ───────────────────── 연습 모드 (한 브라우저 안) ───────────────────── */
  var LK = 'mockinvest.room.' + ROOM;
  var BC = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel(LK) : null;

  /* 갈래(state · orders · pub · signup)마다 저장 칸을 따로 둔다.
     한 칸에 통째로 쓰면, 한 창이 자기 갈래를 저장하는 순간 다른 창이 막 넣은
     주문을 옛 값으로 덮어쓰는 일이 생긴다. */
  var KEYS = ['state', 'orders', 'pub', 'signup', 'reflect'];
  function lkey(k) { return LK + '.' + k; }
  function lreadKey(k) {
    try {
      var v = localStorage.getItem(lkey(k));
      return v == null ? undefined : JSON.parse(v);
    } catch (e) { return undefined; }
  }
  function lread() {
    var d = {};
    KEYS.forEach(function (k) { var v = lreadKey(k); if (v !== undefined) d[k] = v; });
    return d;
  }
  function lwrite(patch) {
    Object.keys(patch).forEach(function (k) {
      try { localStorage.setItem(lkey(k), JSON.stringify(patch[k])); } catch (e) {}
    });
    if (BC) { try { BC.postMessage(patch); } catch (e) {} }     // 바뀐 갈래만 알린다
    lapply(patch);
  }
  /* 읽고-고치고-쓰기는 다른 창이 쓴 최신 값에서 시작한다 */
  function lfresh(k) {
    var v = lreadKey(k);
    return JSON.parse(JSON.stringify(v !== undefined && v !== null ? v : (cache[k] || {})));
  }
  function lapply(d) {
    ['state', 'orders', 'pub', 'signup', 'reflect'].forEach(function (k) {
      if (!(k in d)) return;                                   // 안 건드린 갈래는 그대로
      if (JSON.stringify(d[k]) === JSON.stringify(cache[k])) return;
      cache[k] = d[k];
      fire(k, cache[k]);
    });
  }
  if (!USE_FB) {
    if (BC) BC.onmessage = function (e) { lapply(e.data || {}); };
    W.addEventListener('storage', function (e) {
      if (!e.key || e.key.indexOf(LK + '.') !== 0) return;
      var k = e.key.slice(LK.length + 1), o = {};
      try { o[k] = e.newValue == null ? null : JSON.parse(e.newValue); } catch (x) { return; }
      lapply(o);
    });
    setTimeout(function () { lapply(lread()); }, 0);
  }

  /* ───────────────────── 파이어베이스 모드 ───────────────────── */
  var fdb = null, pending = [];
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error(src)); };
      document.head.appendChild(s);
    });
  }
  function initFb() {
    var V = 'https://www.gstatic.com/firebasejs/10.12.0/';
    loadScript(V + 'firebase-app-compat.js')
      .then(function () { return loadScript(V + 'firebase-database-compat.js'); })
      .then(function () {
        W.firebase.initializeApp(FB);
        fdb = W.firebase.database();
        var base = fdb.ref('rooms/' + ROOM);
        base.child('state').on('value', function (s) {
          cache.state = s.val() || null; if (cache.state) fire('state', cache.state);
        });
        base.child('orders').on('value', function (s) {
          cache.orders = s.val() || {}; fire('orders', cache.orders);
        });
        base.child('pub').on('value', function (s) {
          cache.pub = s.val() || null; if (cache.pub) fire('pub', cache.pub);
        });
        base.child('signup').on('value', function (s) {
          cache.signup = s.val() || {}; fire('signup', cache.signup);
        });
        base.child('reflect').on('value', function (s) {
          cache.reflect = s.val() || {}; fire('reflect', cache.reflect);
        });
        fdb.ref('.info/connected').on('value', function (s) {
          setStatus(s.val() ? 'online' : 'offline',
                    s.val() ? '' : '연결이 끊겼습니다. 잠시 뒤 자동으로 다시 붙습니다.');
        });
        pending.splice(0).forEach(function (f) { f(); });
      })
      .catch(function (e) {
        setStatus('error', '파이어베이스에 연결하지 못했습니다. 주소·인터넷을 확인하세요.');
      });
  }
  function fbDo(f) { if (fdb) f(); else pending.push(f); }
  if (USE_FB) initFb();

  /* ───────────────────── 공개 사용법 ───────────────────── */
  function teamKey(i) { return 't' + i; }

  W.MIDB = {
    mode: USE_FB ? 'firebase' : 'local',
    roomId: ROOM,
    teamKey: teamKey,
    status: function () { return status; },
    onStatus: function (cb) { cbs.status.push(cb); try { cb(status); } catch (e) {} },
    onState:  on('state'),
    onOrders: on('orders'),
    onPublic: on('pub'),
    onSignups: on('signup'),

    setState: function (st) {
      st = Object.assign({}, st, { at: Date.now() });
      if (USE_FB) fbDo(function () { fdb.ref('rooms/' + ROOM + '/state').set(st); });
      else lwrite({ state: st });
    },

    setPublic: function (p) {
      if (USE_FB) fbDo(function () { fdb.ref('rooms/' + ROOM + '/pub').set(p); });
      else lwrite({ pub: p });
    },

    /* 학생이 주문을 낸다 */
    submitOrder: function (round, teamIdx, payload) {
      var rec = Object.assign({}, payload, { at: Date.now() });
      var path = 'r' + round + '/' + teamKey(teamIdx);
      if (USE_FB) {
        return new Promise(function (res, rej) {
          fbDo(function () {
            fdb.ref('rooms/' + ROOM + '/orders/' + path).set(rec)
               .then(function () { res(true); }, function (e) { rej(e); });
          });
          setTimeout(function () { rej(new Error('시간이 초과되었습니다.')); }, 12000);
        });
      }
      var o = lfresh('orders');
      if (!o['r' + round]) o['r' + round] = {};
      o['r' + round][teamKey(teamIdx)] = rec;
      lwrite({ orders: o });
      return Promise.resolve(true);
    },

    clearOrder: function (round, teamIdx) {
      var path = 'r' + round + '/' + teamKey(teamIdx);
      if (USE_FB) { fbDo(function () { fdb.ref('rooms/' + ROOM + '/orders/' + path).remove(); }); return; }
      var o = lfresh('orders');
      if (o['r' + round]) delete o['r' + round][teamKey(teamIdx)];
      lwrite({ orders: o });
    },

    /* ── 참가 신청 ──────────────────────────────────────────
       활동 진행 데이터와 따로 보관한다. 진행을 초기화해도 명단은 남는다. */
    addSignup: function (rec) {
      var r = Object.assign({}, rec, { at: Date.now() });
      if (USE_FB) {
        return new Promise(function (res, rej) {
          fbDo(function () {
            var ref = fdb.ref('rooms/' + ROOM + '/signup').push();
            ref.set(r).then(function () { res(ref.key); }, rej);
          });
          setTimeout(function () { rej(new Error('시간이 초과되었습니다.')); }, 12000);
        });
      }
      var id = 'L' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      var o = lfresh('signup');
      o[id] = r;
      lwrite({ signup: o });
      return Promise.resolve(id);
    },

    removeSignup: function (id) {
      if (USE_FB) { fbDo(function () { fdb.ref('rooms/' + ROOM + '/signup/' + id).remove(); }); return; }
      var o = lfresh('signup');
      delete o[id];
      lwrite({ signup: o });
    },

    clearSignups: function () {
      if (USE_FB) { fbDo(function () { fdb.ref('rooms/' + ROOM + '/signup').remove(); }); return; }
      lwrite({ signup: {} });
    },

    /* ── 개인 성찰지 ─────────────────────────────────────────
       학생이 활동 뒤 자기 휴대폰으로 낸다. 학번 하나에 하나 — 다시 내면 덮어쓴다.
       교사가 콘솔로 옮겨 담은 뒤 [성찰지 지우기]로 파이어베이스에서 지운다. */
    onReflect: on('reflect'),
    submitReflect: function (sid, rec) {
      var key = 's' + String(sid).replace(/[^0-9A-Za-z]/g, '');
      var r = Object.assign({}, rec, { at: Date.now() });
      if (USE_FB) {
        return new Promise(function (res, rej) {
          fbDo(function () { fdb.ref('rooms/' + ROOM + '/reflect/' + key).set(r).then(function () { res(true); }, rej); });
          setTimeout(function () { rej(new Error('시간이 초과되었습니다.')); }, 12000);
        });
      }
      var o = lfresh('reflect'); o[key] = r; lwrite({ reflect: o });
      return Promise.resolve(true);
    },
    clearReflect: function () {
      if (USE_FB) { fbDo(function () { fdb.ref('rooms/' + ROOM + '/reflect').remove(); }); return; }
      lwrite({ reflect: {} });
    },

    /* 교사 화면 사본 — 진행 단계·채점·직접 넣은 주문 (시세·뉴스·해설은 넣지 않는다)
       교사 노트북이 꺼져도 다른 컴퓨터에서 시세표만 다시 불러오면 이어 할 수 있게 */
    saveTeacher: function (obj) {
      if (USE_FB) fbDo(function () { fdb.ref('rooms/' + ROOM + '/teacher').set(obj); });
      else { try { localStorage.setItem(lkey('teacher'), JSON.stringify(obj)); } catch (e) {} }
    },
    loadTeacher: function () {
      if (!USE_FB) return Promise.resolve(lreadKey('teacher') || null);
      return new Promise(function (res) {
        var done = false;
        fbDo(function () {
          fdb.ref('rooms/' + ROOM + '/teacher').once('value').then(function (s) { done = true; res(s.val()); }, function () { done = true; res(null); });
        });
        setTimeout(function () { if (!done) res(null); }, 8000);
      });
    },

    clearAll: function () {
      /* 진행 상태만 지운다 — 참가 신청 명단은 남긴다 */
      if (USE_FB) {
        fbDo(function () {
          ['state', 'orders', 'pub', 'teacher'].forEach(function (k) {
            fdb.ref('rooms/' + ROOM + '/' + k).remove();
          });
        });
        return;
      }
      try { localStorage.removeItem(lkey('teacher')); } catch (e) {}
      lwrite({ state: null, orders: {}, pub: null });
    }
  };
})(window);
