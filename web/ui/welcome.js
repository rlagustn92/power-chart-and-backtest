// 처음 켰을 때 안내 (새 PC): ① 알파카 키 ② 토스 키(선택) ③ 관심종목 전체 받기 ④ 추천 화면 고르기
// 받아 둔 데이터가 이미 있는 PC에서는 뜨지 않는다. 설정 → 도움말 → "처음 안내 다시 보기"로 언제든.
import { h } from "./dom.js";
import * as db from "../core/db.js";
import * as A from "../sources/alpaca.js";
import * as TS from "../sources/toss.js";

export async function maybeWelcome(app, force = false) {
  const { cfg } = app;
  if (!force && cfg.first_run_done) return;
  if (!force) {
    const cov = await db.coverage().catch(() => []);
    if (cov.length > 5) {
      // 이미 쓰던 PC (데이터가 있음) → 안내 없이
      cfg.first_run_done = true;
      cfg.save();
      return;
    }
  }
  const done = () => {
    cfg.first_run_done = true;
    cfg.save();
    wrap.remove();
  };
  const ok = (on) => h(`span.wel-ok${on ? ".on" : ""}`, on ? "✓" : "○");
  const step = (n, title, on, ...body) => h("div.wel-step", h("div.wel-head", ok(on), h("b", `${n}. ${title}`)), h("div.wel-body", ...body));

  const prog = h("p.hint");
  const dl = h("button.primary", {
    onclick: async () => {
      dl.disabled = true;
      const t0 = Date.now();
      await app.data.downloadAll(cfg.watchlist, (i, n, info) => {
        const left = i > 1 ? Math.round((((Date.now() - t0) / (i - 1)) * (n - i + 1)) / 60000) : null;
        prog.textContent = `${i}/${n} ${info.label} 받는 중${left != null ? (left < 1 ? " · 1분 안 남음" : ` · 남은 시간 약 ${left}분`) : ""} (창을 닫아도 계속 받아요)`;
      });
      prog.textContent = "다 받았어요 ✓";
      dl.textContent = "다시 받기";
      dl.disabled = false;
    },
  }, "관심종목 전체 받기");

  const layouts = Object.keys(cfg.grid.layouts).map((name) =>
    h("button", { onclick: () => (app.grid.setLayout(name), done()) }, `${name} (${cfg.grid.layouts[name].cells?.length ?? 1}칸)`)
  );

  // 키를 넣으러 설정을 열면 안내는 잠깐 숨었다가(설정 창을 가리지 않게), 설정을 닫으면 ✓ 표시를 새로 그려서 다시 보인다
  const goKeys = () => {
    wrap.hidden = true;
    app.openSettings("데이터", () => {
      wrap.hidden = false;
      paintKeys();
    });
  };
  const keySteps = h("div");
  const paintKeys = () =>
    keySteps.replaceChildren(
      step(1, "알파카 키 넣기 (미국 주식 분봉·실시간)", A.hasKey(), h("button", { onclick: goKeys }, "키 넣으러 가기"), h("span.hint", "무료 키면 돼요")),
      step(2, "토스 키 (국내·미국 실시간, 선택)", TS.hasKey(), h("button", { onclick: goKeys }, "키 넣으러 가기"), h("span.hint", "Market Board에 넣어 뒀으면 자동으로 같이 써요"))
    );
  paintKeys();

  const wrap = h(
    "div.overlay.dialog",
    h(
      "div.panel.center.welcome",
      h("h2", "👋 POWER CHART 시작하기"),
      h("p.hint", "새 PC면 아래 순서대로 해 주세요. 다른 PC에서 쓰던 데이터가 있으면 ⚙ 설정 → 데이터 → '📂 파일에서 가져오기'로 한 번에 옮길 수 있어요."),
      keySteps,
      step(3, "관심종목 받기", false, dl, prog, h("p.hint", "일봉은 몇 초, 미국 분봉(2016년부터)은 종목당 1분 안팎이에요. 받는 동안에도 차트를 볼 수 있어요.")),
      step(4, "화면 고르기", false, h("div.wel-layouts", layouts)),
      h("div.row", h("button.primary", { onclick: done }, "시작하기"))
    )
  );
  document.body.append(wrap);
}
