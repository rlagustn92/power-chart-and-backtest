// 📥 차트 봉 2년씩 받기 화면 쪽: 받는 중 상태 · 진행 상자(⏸ 멈추기) · 설정 칸 · 차트를 뒤로 밀었을 때 알림
// 바이낸스 코인(1.2.0) + 토스 키가 있는 국내 주식(1.3.0)
import * as BF from "../core/backfill.js";
import * as db from "../core/db.js";
import { TF_SEC } from "../core/bars.js";
import { DAY } from "../core/tz.js";
import { h } from "./dom.js";
import { toast } from "./dialog.js";
import { logInfo } from "../platform.js";

const nameOf = (info) => info.label.replace(/ 24h$/, "");

/** onDone(info): 받기가 끝나거나 멈췄을 때 (그 종목 차트 칸을 다시 읽기) */
export function createBackfill({ onDone = () => {} } = {}) {
  const jobs = new Map(); // id → {info, years, pct, text, stop}
  const subs = new Set();
  const offered = new Set(); // 차트 끝 알림은 종목마다 한 번
  const checking = new Set();
  const float = h("div.bf-float", { hidden: true });
  document.body.append(float);

  const changed = () => {
    paintFloat();
    subs.forEach((f) => f());
  };

  const progressText = (j) => (j.stop ? "멈추는 중…" : `${Math.round(j.pct * 100)}% · ${j.text}`);
  const stopBtn = (j) => h("button", { onclick: () => stop(j.info.id), disabled: j.stop }, "⏸ 멈추기");

  function paintFloat() {
    float.hidden = !jobs.size;
    float.replaceChildren(...[...jobs.values()].map((j) => h("div.bf-row", h("span", `📥 ${nameOf(j.info)} ${j.years}년치 받는 중 · ${progressText(j)}`), stopBtn(j))));
  }

  async function start(info) {
    if (jobs.has(info.id)) return;
    if (!BF.canDownload(info)) return toast(`${nameOf(info)}: ${BF.noBackfillReason(info)}`, 6000);
    const cov = await BF.chartCoverage(info);
    if (cov.all) return toast(cov.src === "toss" ? `${nameOf(info)}: 토스에 있는 만큼 전부 받아 뒀어요 · 더 옛날 분봉은 없어요` : `${nameOf(info)}: 상장일부터 전부 받아 뒀어요 · 더 옛날 봉은 없어요`, 6000);
    const job = { info, years: cov.next, pct: 0, text: "준비 중", stop: false };
    jobs.set(info.id, job);
    changed();
    const t0 = Date.now();
    try {
      const n = await BF.backfillChart(info, {
        years: job.years,
        stop: () => job.stop,
        onProgress: (f, text) => {
          job.pct = f;
          job.text = text;
          changed();
        },
      });
      logInfo(`[${cov.src}] ${info.id} ${job.years}년치 받기 ${job.stop ? "멈춤" : "끝"} · ${n}봉 · ${Math.round((Date.now() - t0) / 1000)}초`);
      if (job.stop) toast(`${nameOf(info)} 받기를 멈췄어요 · 다시 누르면 이어서 받아요`, 6000);
      else if ((await BF.chartCoverage(info))?.all) toast(`${nameOf(info)} 차트 봉을 ${cov.src === "toss" ? "토스에 있는 만큼" : "상장일까지"} 다 받았어요 · 차트를 뒤로 밀어 보세요`, 10000);
      else toast(`${nameOf(info)} 차트 봉을 ${job.years}년 전까지 받았어요 · 차트를 뒤로 밀어 보세요`, 10000);
    } catch (e) {
      logInfo(`[${cov.src}] ${info.id} ${job.years}년치 받기 끊김 · ${e?.message ?? e}`);
      toast(`${nameOf(info)} 받다가 끊겼어요 (${e?.message ?? e}) · 다시 누르면 이어서 받아요`, 8000);
    } finally {
      jobs.delete(info.id);
      changed();
      onDone(info); // 멈췄거나 끊겼어도 받은 만큼은 바로 볼 수 있게
    }
  }

  function stop(id) {
    const j = jobs.get(id);
    if (!j) return;
    j.stop = true;
    changed();
  }

  /** 설정 → 데이터에 들어가는 한 종목 칸: 지금 상태 · 버튼 · 누르면 어떻게 되는지 (받는 중이면 진행 · 멈추기) */
  function box(info) {
    if (!BF.canDownload(info)) return h("span.hint", BF.noBackfillReason(info));
    const el = h("div.bf-box");
    let mounted = false;
    let seq = 0;
    const paint = async () => {
      const my = ++seq;
      const cov = await BF.chartCoverage(info);
      const j = jobs.get(info.id);
      const plan = j || cov.all ? null : await BF.backfillPlan(info, cov.next, cov);
      if (my !== seq) return;
      const have = h("span.bf-have", BF.haveText(cov));
      if (j) el.replaceChildren(have, h("span.bf-prog", `${j.years}년치 받는 중 · ${progressText(j)}`), stopBtn(j));
      else if (cov.all) el.replaceChildren(have, h("span.hint", cov.src === "toss" ? "토스에 있는 만큼 전부 (약 4년)" : "상장일부터 전부 · 더 옛날 봉은 없어요"));
      else el.replaceChildren(have, h("button.primary", { onclick: () => start(info) }, BF.buttonText(cov)), h("span.hint", BF.nextText(cov, plan)));
    };
    const sub = () => {
      if (el.isConnected) mounted = true;
      else if (mounted) return subs.delete(sub); // 설정 창을 닫았거나 다른 탭으로
      paint();
    };
    subs.add(sub);
    paint();
    return el;
  }

  /**
   * 차트를 뒤로 밀어 더 받았을 때 (바이낸스 5분·15분봉, main.js fetchOlder): 한 번에 4,500봉(5분봉 약 15일)씩이라
   * 종목마다 한 번 "📥 2년치 받기" 알림 (복제본 사용자 요청 2026-10-30: "계속 차트 뒤로 땡기고 땡기고 받는데")
   */
  async function offer(info, tf) {
    const id = info.id;
    if (!BF.canBackfill(info) || !BF.CHART_TFS.includes(tf) || offered.has(id) || jobs.has(id) || checking.has(id)) return;
    checking.add(id);
    try {
      if ((await db.metaGet(`${id}|${tf}|listed`)) === 1) return; // 진짜 첫 봉(상장일)이라 더 받을 게 없다
      const cov = await BF.chartCoverage(info);
      if (cov.all) return;
      offered.add(id);
      const eta = BF.etaText(await BF.backfillPlan(info, cov.next, cov));
      const what = BF.reachesListing(cov) ? "상장일부터 전부" : "한 번에 2년치를";
      const days = Math.round((4500 * TF_SEC[tf]) / DAY);
      toast(`${nameOf(info)} ${BF.TF_KO[tf]}은 뒤로 밀 때마다 약 ${days}일씩 받아요\n${what} 받을 수 있어요 (5분·15분·30분·1시간·4시간봉, ${eta})`, 15000, { label: BF.buttonText(cov), onclick: () => start(info) });
    } finally {
      checking.delete(id);
    }
  }

  /** 국내 주식 분봉 왼쪽 끝 (야후가 1시간봉 2년까지만 줌) + 토스 키 → "📥 토스로 2년 받기" 알림 (종목마다 한 번). 알렸으면 true */
  function offerToss(info, text) {
    if (!BF.canToss(info) || offered.has(info.id) || jobs.has(info.id)) return false;
    offered.add(info.id);
    toast(`${text}\n토스에서 2년치씩 받으면 더 뒤로 보여요 (토스 1분봉은 약 4년 전까지)`, 12000, { label: "📥 토스로 2년 받기", onclick: () => start(info) });
    return true;
  }

  return { start, stop, box, offer, offerToss, running: (id) => jobs.has(id) };
}
