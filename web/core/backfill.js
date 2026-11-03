// 옛날 봉 받기 (1.2.0 📥 2년치 받기 + 1.3.0에 복제본 FAKE TRADING trade/history.js에서 옮긴 것)
// - 📥 차트 봉 2년씩 받기: 누를 때마다 2년씩 더
//   · 바이낸스 무기한선물: 처음에는 봉마다 최근 4,500개뿐(5분봉 보름치) → 5·15·30분·1·4시간봉을 같은 날짜까지.
//     1분봉은 받지 않는다 (BTC 전부면 약 370만 봉. 리플레이 때 그 근처만 ensureMinutes)
//   · 국내 주식 + 토스 키: 토스 1분봉(약 4년 전까지, 삼성전자 2022-11)을 받아 1분·5분·1시간봉으로 저장 (야후는 1시간봉 2년까지)
// - 차트를 왼쪽 끝까지 밀면 그 앞을 더 받기 (fetchOlder, 바이낸스만) · 리플레이 시각까지 받기 (reachBack, ensureMinutes)
// 바이낸스는 공개 fapi/v1/klines만 (키 없음, 읽기 전용). 2년치 받기는 1,000봉 창(무게 5)으로 나눠 3개씩 함께,
// 1분 무게는 sources/binance.js가 한도의 절반까지만 쓴다 (전에는 1,500봉씩 하나씩 0.35초 쉬며 → 약 2배 빠름)
// 메타 `${id}|${tf}|listed` = 1 → 상장일까지 다 받았음 · `${id}|${tf}|first` = 거래소 첫 봉 시각 · `${id}|toss_from` = 토스로 여기부터 받았음 (0 = 토스 맨 앞까지)
import * as db from "./db.js";
import * as BN from "../sources/binance.js";
import * as TS from "../sources/toss.js";
import { TF_SEC } from "./bars.js";
import { DAY, ymd } from "./tz.js";
import { logInfo } from "../platform.js";

const PAGE = 1500; // 차트를 뒤로 밀 때·1분봉 받기 (한 번에 1,500봉)
const PAUSE_MS = 350;
const WIN = 1000; // 2년치 받기 창 (무게 5 = 1,500봉의 절반)
const WORKERS = 3;
const SEC_PER_WIN = 0.3; // 창 하나에 드는 시간 (한도의 절반 = 1분에 240번. 복제본에서 ETH 2년 316창 89초)
const SEC_PER_TOSS = 0.2; // 토스 한 쪽(1분봉 200개)에 드는 시간 (초당 6번쯤 → 2년 약 3~4분)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Math.floor(Date.now() / 1000);
export const CHART_TFS = ["5m", "15m", "30m", "1h", "4h"];
export const YEAR = 365 * DAY;
export const TF_KO = { "1m": "1분봉", "5m": "5분봉", "15m": "15분봉", "30m": "30분봉", "1h": "1시간봉", "4h": "4시간봉" };

/** 바이낸스 무기한선물인가 (Hyperliquid는 봉 종류마다 최근 5,000개뿐) */
export const canBackfill = (info) => info.kind === "perp" && info.daily === "binance";
/** 토스로 국내 1분봉을 받을 수 있나 (국내 주식·ETF + 토스 키) */
export const canToss = (info) => info.kind === "kr" && TS.tossable(info.id) && TS.hasKey() && !TS.isStandby();
/** 📥 2년치 받기가 되는 종목 */
export const canDownload = (info) => canBackfill(info) || canToss(info);

/** 2년치 받기가 안 되는 종목: 버튼 대신 보여 줄 이유 한 줄 */
export function noBackfillReason(info) {
  if (info.kind === "perp") return "Hyperliquid는 봉마다 최근 5,000개뿐이에요";
  if (info.intraday === "alpaca") return "미국 주식 5분봉은 알파카 키가 있으면 2016년부터 저절로 받아요";
  if (info.kind === "kr" && TS.tossable(info.id)) return "토스 키가 있으면 토스에서 받아요 (⚙ 설정 → 데이터). 지금은 야후라 5분봉 60일·1시간봉 2년까지";
  if (info.intraday === "yahoo") return "야후는 5분봉 60일·1시간봉 2년까지만 줘요";
  if (info.kind === "ratio") return "비율 차트는 두 종목의 봉으로 계산해요";
  return "이 종목은 분봉이 없어요";
}

/** 다음에 받을 곳 = 지금부터 2·4·6…년 전 중 가장 옛 봉보다 앞인 첫 곳 (1.95년 있으면 다 찬 2년으로 봄) */
export function nextYears(first, now, step = 2) {
  const have = Math.max(0, (now - first) / YEAR);
  return (Math.floor(have / step + 0.05) + 1) * step;
}

/** 바이낸스: 지금 저장된 것 (한꺼번에 묻는다): {tfs: [{tf, first, listed}], listedAt: 상장일(일봉을 상장일부터 다 받아 둔 종목만, 모르면 null)} */
async function stored(info) {
  const [tfs, l1d, r1d] = await Promise.all([
    Promise.all(
      CHART_TFS.map(async (tf) => {
        const [r, l] = await Promise.all([db.range(info.id, tf), db.metaGet(`${info.id}|${tf}|listed`)]);
        return { tf, first: r?.first ?? null, listed: l === 1 };
      })
    ),
    db.metaGet(`${info.id}|1D|listed`),
    db.range(info.id, "1D"),
  ]);
  return { tfs, listedAt: l1d === 1 ? (r1d?.first ?? null) : null };
}

/**
 * {src: "binance"|"toss", first: 가장 옛 분봉(없으면 null), years, next, all(더 옛날이 없음), listedAt(상장일, 모르면 null)} | null(받을 수 없는 종목)
 * 바이낸스 years = 상장일에 아직 안 닿은 봉 가운데 가장 짧은 것 (멈췄다가 다시 누르면 덜 받은 봉부터 이어지게)
 */
export async function chartCoverage(info) {
  const t = now();
  if (canToss(info)) {
    const from = await db.metaGet(`${info.id}|toss_from`);
    const first = Math.min(from || Infinity, (await db.range(info.id, "1m"))?.first ?? t);
    return { src: "toss", first, years: (t - first) / YEAR, next: nextYears(first, t), all: from === 0, listedAt: null, from };
  }
  if (!canBackfill(info)) return null;
  const s = await stored(info);
  const open = s.tfs.filter((x) => !x.listed);
  const from = open.length ? Math.max(...open.map((x) => x.first ?? t)) : (s.tfs[0].first ?? t);
  return { src: "binance", first: s.tfs[0].first, years: (t - from) / YEAR, next: nextYears(from, t), all: !open.length, listedAt: s.listedAt, stored: s };
}

/** 받을 것: [{tf, end(이 앞부터), pages(몇 번 받나), sec(한 번에 드는 시간)}] — 걸리는 시간 셈용. cov를 주면 저장소에 다시 묻지 않는다 */
export async function backfillPlan(info, years, cov = null) {
  const target = now() - years * YEAR;
  if (canToss(info)) {
    const from = cov ? cov.from : await db.metaGet(`${info.id}|toss_from`);
    const end = from || now();
    // 장이 열리는 날(주 5일)마다 1분봉 390개 = 토스 두 쪽
    return end > target ? [{ tf: "1m", end, pages: Math.ceil(((end - target) / DAY) * (5 / 7) * 2), sec: SEC_PER_TOSS }] : [];
  }
  const s = cov?.stored ?? (await stored(info));
  const floor = Math.max(target, s.listedAt ?? 0);
  return s.tfs
    .filter((x) => !x.listed && (x.first ?? now()) > target)
    .map(({ tf, first }) => {
      const end = first ?? now();
      return { tf, end, pages: Math.max(1, Math.ceil((end - floor) / TF_SEC[tf] / WIN)), sec: SEC_PER_WIN };
    });
}

/** 이번에 누르면 상장일까지 다 닿는지 */
export const reachesListing = (cov) => cov.listedAt != null && cov.listedAt > now() - cov.next * YEAR;

/** 걸리는 시간 글자: "약 2~3분" · "1분 안" */
export function etaText(plan) {
  const m = plan.reduce((s, p) => s + p.pages * p.sec, 0) / 60;
  if (m < 1) return "1분 안";
  const a = Math.floor(m);
  return `약 ${a}~${a + 1}분`;
}

/** 지금 상태 글자: "5분봉 2024-10-25부터 (약 2.0년)" · 1년이 안 되면 "110일" */
export function haveText(cov) {
  const what = cov.src === "toss" ? "분봉" : "5분봉";
  if (cov.first == null) return `${what}이 아직 없어요`;
  const days = (now() - cov.first) / DAY;
  return `${what} ${ymd(cov.first)}부터 (${days >= 365 ? `약 ${(days / 365).toFixed(1)}년` : `${Math.max(1, Math.round(days))}일`})`;
}

export const buttonText = (cov) => (cov.next <= 2 ? "📥 2년치 받기" : `📥 2년 더 받기 (${cov.next}년치까지)`);

/** 누르면 어떻게 되는지: "누르면 2022-10-31까지 · 약 2~3분 · 누를 때마다 2년씩 더" (2년이 안 된 종목은 "누르면 상장일 2026-04-20까지 전부 · 1분 안") */
export const nextText = (cov, plan) =>
  reachesListing(cov) ? `누르면 상장일 ${ymd(cov.listedAt)}까지 전부 · ${etaText(plan)}` : `누르면 ${ymd(now() - cov.next * YEAR)}까지 · ${etaText(plan)} · 누를 때마다 2년씩 더${cov.src === "toss" ? " (토스는 약 4년 전까지)" : ""}`;

/** 지금부터 years년 전까지 (이미 있는 가장 옛 봉 앞부터 이어서). onProgress(0~1, 글자), stop()이 true면 멈춤. 반환: 새로 받은 봉 수 */
export async function backfillChart(info, { years = 2, onProgress = () => {}, stop = () => false } = {}) {
  if (canToss(info)) return backfillToss(info, { days: years * 365, onProgress, stop });
  if (!canBackfill(info)) return 0;
  const want = now() - years * YEAR;
  const plan = [];
  for (const tf of CHART_TFS) {
    if ((await db.metaGet(`${info.id}|${tf}|listed`)) === 1) continue;
    const listed = await listedAt(info, tf);
    const target = Math.max(want, listed ?? 0);
    const end = (await db.range(info.id, tf))?.first ?? now();
    if (end > target) plan.push({ tf, end, target, toListing: listed != null && target === listed });
    else if (listed != null && end <= listed) await db.metaSet(`${info.id}|${tf}|listed`, 1);
  }
  const run = await spanPlan(info, plan, { onProgress, stop });
  for (const p of plan) if (p.toListing && p.done != null && p.done <= p.target) await db.metaSet(`${info.id}|${p.tf}|listed`, 1); // 상장일까지 왔다
  if (run.failed) throw run.failed;
  let added = run.added;
  // 그 사이에 빈 곳(앱을 오래 꺼 둔 때 등)이 있으면 메운다
  if (!stop()) added += await fillHoles(info, onProgress, CHART_TFS, want, stop);
  onProgress(1, stop() ? "멈췄어요 (다시 누르면 이어서 받아요)" : "다 받았어요");
  if (added) logInfo(`[binance] ${info.id} 차트 봉 ${years}년치까지 ${added}봉 받음 (${run.secs}초)`);
  return added;
}

/** 그 봉 종류의 첫 봉 시각 = 상장 (바이낸스에 처음부터 한 개만 물어봄, 무게 1). 진행률·끝을 정확히 알려고 */
async function listedAt(info, tf) {
  const key = `${info.id}|${tf}|first`;
  const m = await db.metaGet(key);
  if (m != null) return m;
  try {
    const t = (await BN.klines(info.symbol, tf, { startSec: 0, limit: 1 }))[0]?.t ?? null;
    if (t != null) await db.metaSet(key, t);
    return t;
  } catch {
    return null;
  }
}

/**
 * plan = [{tf, end, target}] 마다 end 앞에서 target까지 1,000봉 창으로 받는다 (전체 창 수로 진행률).
 * 24시간 종목이라 창마다 봉 수가 정해져 있어 창을 미리 나눌 수 있다 (앞 쪽 결과를 기다리지 않음).
 * 각 p에 p.done(여기부터 end까지 빈틈없이 받음)을 적는다. 반환 {added, failed(오류), secs}
 */
async function spanPlan(info, plan, { onProgress = () => {}, stop = () => false } = {}) {
  const t0 = Date.now();
  for (const p of plan) {
    p.wins = [];
    for (let e = p.end; e > p.target; e -= WIN * TF_SEC[p.tf]) p.wins.push({ s: Math.max(p.target, e - WIN * TF_SEC[p.tf]), e, ok: false });
  }
  const total = plan.reduce((s, p) => s + p.wins.length, 0) || 1;
  let n = 0;
  let added = 0;
  let failed = null;
  for (const p of plan) {
    if (stop() || failed) break;
    let next = 0;
    let oldest = p.end;
    const worker = async () => {
      while (!failed && !stop() && next < p.wins.length) {
        const w = p.wins[next++];
        try {
          const rows = (await win(info.symbol, p.tf, w, stop)).filter((k) => k.t >= w.s && k.t < w.e);
          if (rows.length) await db.putBars(info.id, p.tf, rows);
          added += rows.length;
          w.ok = true;
          oldest = Math.min(oldest, w.s);
          onProgress(Math.min(0.99, ++n / total), `${TF_KO[p.tf]} ${ymd(oldest)}까지`);
        } catch (e) {
          failed = e;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(WORKERS, p.wins.length) }, worker));
    // 지금 쪽부터 끊김 없이 받은 곳 (멈추거나 실패하면 거기까지만 → 다음에 이어서)
    p.done = p.end;
    for (const w of p.wins) {
      if (!w.ok) break;
      p.done = w.s;
    }
  }
  return { added, failed, secs: Math.round((Date.now() - t0) / 1000) };
}

/** 창 하나 받기 (끊기면 3초·10초 쉬고 두 번 더) */
async function win(symbol, tf, w, stop) {
  for (let i = 0; ; i++) {
    try {
      return await BN.klines(symbol, tf, { startSec: w.s, endSec: w.e - 1, limit: WIN, bulk: true });
    } catch (e) {
      if (i >= 2 || stop()) throw e;
      await sleep(i ? 10000 : 3000);
    }
  }
}

/** 빈 곳 메우기 (24시간 시장이라 봉 사이가 벌어지면 빠진 것). after = 이 시각 뒤의 빈 곳만 */
async function fillHoles(info, onProgress, tfs, after, stop) {
  let added = 0;
  for (const tf of tfs) {
    const gaps = (await db.gaps(info.id, tf, Math.max(30 * 60, 3 * TF_SEC[tf])).catch(() => [])).filter(([, b]) => b > after);
    for (const [a, b] of gaps.slice(0, 40)) {
      let start = a + TF_SEC[tf];
      for (let i = 0; i < 30 && start < b && !stop(); i++) {
        const rows = (await BN.klines(info.symbol, tf, { startSec: start, limit: WIN, bulk: true })).filter((k) => k.t < b);
        if (!rows.length) break;
        await db.putBars(info.id, tf, rows);
        added += rows.length;
        start = rows[rows.length - 1].t + TF_SEC[tf];
        onProgress(0.99, `빈 곳 메우는 중 (${TF_KO[tf]})`);
      }
    }
  }
  return added;
}

// ── 차트를 뒤로 밀 때·리플레이 때 (바이낸스만, 1.3.0) ──

/**
 * 차트를 왼쪽 끝까지 밀었는데 저장된 봉이 끝났을 때 (복제본 사용자 요청 2026-10-30: 5분봉을 뒤로 밀어도 보름치뿐):
 * 저장된 가장 옛 봉 앞을 거래소에서 더 받는다. 한 번에 pages번(1,500봉씩, 5분봉이면 약 15일). 반환: 새로 받은 봉 수 (0 = 상장일까지 왔음)
 */
export async function fetchOlder(info, tf, pages = 3) {
  if (!canBackfill(info) || !BN.TF[tf]) return 0;
  const r = await db.range(info.id, tf);
  if (!r) return 0;
  let end = r.first;
  let added = 0;
  for (let i = 0; i < pages; i++) {
    const rows = (await BN.klines(info.symbol, tf, { endSec: end - 1, limit: PAGE })).filter((k) => k.t < end);
    if (rows.length) await db.putBars(info.id, tf, rows);
    added += rows.length;
    if (rows.length < PAGE) {
      await db.metaSet(`${info.id}|${tf}|listed`, 1); // 상장일까지 왔다 (📥 2년치 받기가 이 봉은 건너뛴다)
      break;
    }
    end = rows[0].t;
    await sleep(PAUSE_MS);
  }
  if (added) logInfo(`[binance] ${info.id} ${tf} 차트 뒤로 ${added}봉 더 받음`);
  return added;
}

/**
 * 리플레이 시각 t 앞 300봉까지 저장돼 있게: 저장된 맨 앞부터 이어서 뒤로 받는다 (구멍 없이).
 * 리플레이 중에 봉을 바꾸거나(15분 → 4시간) 분할 화면의 다른 칸이 같이 갈 때. 한 번에 4,500봉씩 최대 maxCalls번
 */
export async function reachBack(info, tf, t, { maxCalls = 30 } = {}) {
  if (!canBackfill(info) || !BN.TF[tf] || !TF_SEC[tf]) return 0;
  const want = t - 300 * TF_SEC[tf];
  let added = 0;
  for (let i = 0; i < maxCalls; i++) {
    const r = await db.range(info.id, tf);
    if (!r || r.first <= want) break;
    const n = await fetchOlder(info, tf);
    if (!n) break; // 상장일까지 왔다
    added += n;
  }
  return added;
}

/**
 * from~to 1분봉이 저장돼 있게: 옛날 구간에서 리플레이를 시작할 때, 재생하다 받아 둔 끝·빈 곳에 닿을 때.
 * 1분봉이 있어야 리플레이가 1분씩 흘러가고 진행 중인 봉이 자란다. 거의 다 있으면 받지 않는다. 반환: 새로 받은 봉 수
 */
const minuteJobs = new Map(); // 종목 → 받는 중. 같은 빈 곳을 동시에 받지 않게 차례로 (뒤에 온 쪽은 이미 있으면 안 받는다)
export async function ensureMinutes(info, from, to) {
  const prev = minuteJobs.get(info.id);
  if (prev) await prev.catch(() => {});
  const p = ensureMinutesNow(info, from, to);
  minuteJobs.set(info.id, p);
  try {
    return await p;
  } finally {
    if (minuteJobs.get(info.id) === p) minuteJobs.delete(info.id);
  }
}
async function ensureMinutesNow(info, from, to) {
  if (!canBackfill(info)) return 0;
  from = Math.floor(from / 60) * 60;
  to = Math.min(to, Math.floor(Date.now() / 1000 / 60) * 60 - 60);
  if (!(to > from)) return 0;
  const have = await db.getBars(info.id, "1m", { after: from, before: to, limit: 20000 });
  if (have.length >= ((to - from) / 60) * 0.98) return 0;
  let start = from;
  let added = 0;
  while (start < to) {
    const rows = (await BN.klines(info.symbol, "1m", { startSec: start, limit: PAGE })).filter((k) => k.t >= start && k.t < to);
    if (!rows.length) break;
    await db.putBars(info.id, "1m", rows);
    added += rows.length;
    start = rows[rows.length - 1].t + 60;
    if (start < to) await sleep(PAUSE_MS);
  }
  if (added) logInfo(`[binance] ${info.id} 1분봉 ${new Date(from * 1000).toISOString().slice(0, 16)}부터 ${added}개 받음 (리플레이)`);
  return added;
}

// ── 토스 국내 1분봉 (1.3.0, 복제본 0.7.0: 삼성전자 4시간봉이 야후 2년치뿐 → 토스 1분봉은 약 4년) ──

/** 1분봉 → sec초 봉 (묶음 시작 = sec로 나눈 시각. 한국 시각 정시 = UTC 정시라 야후 1시간·5분봉과 같은 자리) */
export function bucketRows(rows, sec) {
  const out = [];
  let cur = null;
  for (const k of rows) {
    const t = Math.floor(k.t / sec) * sec;
    if (!cur || cur.t !== t) {
      cur = { t, o: k.o, h: k.h, l: k.l, c: k.c, v: k.v ?? 0 };
      out.push(cur);
    } else {
      if (k.h > cur.h) cur.h = k.h;
      if (k.l < cur.l) cur.l = k.l;
      cur.c = k.c;
      cur.v += k.v ?? 0;
    }
  }
  return out;
}

/** 정규장(09:00~15:30 한국 시각)만: 야후 국내 분봉과 맞춘다 (토스가 넥스트레이드 시간도 줄 수 있어서) */
export const krRegular = (k) => {
  const m = Math.floor(((k.t + 9 * 3600) % DAY) / 60);
  return m >= 9 * 60 && m <= 15 * 60 + 30;
};

/**
 * 토스로 국내 1분봉을 days일 전(null = 받을 수 있는 만큼, 약 4년)까지 뒤로 받아 1분·5분·1시간봉으로 저장한다.
 * 15분·30분봉은 5분봉, 4시간봉은 1시간봉을 묶어 그린다.
 * - 이미 있는 봉(야후: 1분 30일·5분 60일·1시간 2년)보다 옛날 것만 넣는다 → 야후 봉과 섞이지 않게
 * - 한 번에 200개(반나절). 요청 사이는 Rust 관문이 띄운다 → 초당 6번쯤 (토스 한도의 3분의 1, Market Board 몫을 남긴다)
 * - 메타 `종목|toss_from` = 여기부터 지금까지 받았음 (0 = 토스에 있는 맨 앞까지) → 중간에 멈춰도 이어서
 */
export async function backfillToss(info, { days = null, onProgress = () => {}, stop = () => false } = {}) {
  if (!canToss(info)) return 0;
  const t = now();
  const target = days == null ? 0 : t - days * DAY;
  const done = await db.metaGet(`${info.id}|toss_from`);
  if (done === 0 || (done != null && done <= target)) return onProgress(1, "다 받았어요"), 0;
  const first = {};
  for (const tf of ["1m", "5m", "1h"]) first[tf] = (await db.range(info.id, tf))?.first ?? Infinity;
  const span = t - (target || t - 4 * 365 * DAY);
  let before = done ?? t;
  let saved = before; // 여기부터 지금까지는 저장했음
  let buf = []; // 아직 1시간이 다 차지 않은 앞쪽 1분봉
  let added = 0;
  let pages = 0;
  let reached = false;
  const flush = async (cut) => {
    const ready = buf.filter((k) => k.t >= cut);
    buf = buf.filter((k) => k.t < cut);
    if (ready.length) {
      const m1 = ready.filter((k) => k.t < first["1m"]);
      const m5 = bucketRows(ready, 300).filter((k) => k.t < first["5m"]);
      const h1 = bucketRows(ready, 3600).filter((k) => k.t < first["1h"]);
      if (m1.length) await db.putBars(info.id, "1m", m1);
      if (m5.length) await db.putBars(info.id, "5m", m5);
      if (h1.length) await db.putBars(info.id, "1h", h1);
      added += m1.length;
    }
    if (cut < saved) saved = cut;
  };
  while (before > target && !stop()) {
    const { rows } = await TS.candlesPage(info.id, { interval: "1m", count: 200, before });
    const page = rows.filter((k) => k.t <= before);
    if (!page.length) {
      reached = true; // 토스에 있는 맨 앞까지 왔다
      break;
    }
    buf = [...page.filter(krRegular), ...buf];
    before = page[0].t - 60;
    // 1시간이 다 찬 부분만 저장 (그 앞 1분봉은 다음 쪽에서 더 온다)
    await flush(Math.ceil(page[0].t / 3600) * 3600);
    if (++pages % 20 === 0) await db.metaSet(`${info.id}|toss_from`, saved);
    onProgress(Math.min(0.99, (t - page[0].t) / span), `${new Date((page[0].t + 9 * 3600) * 1000).toISOString().slice(0, 10)}까지`);
  }
  // 맨 앞까지 왔으면 남은 것도 저장 · 정한 날짜에서 멈췄으면 덜 찬 1시간은 버린다 (다음에 더 옛날을 받을 때 다시 온다)
  if (reached) await flush(-Infinity);
  await db.metaSet(`${info.id}|toss_from`, reached ? 0 : saved);
  onProgress(1, stop() ? "멈췄어요 (다시 누르면 이어서 받아요)" : "다 받았어요");
  if (added) logInfo(`[toss] ${info.id} 토스 1분봉 ${added}개 받음 (${pages}번)`);
  return added;
}
