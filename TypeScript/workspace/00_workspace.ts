//import { initWorkAssignPanel } from "./01_work-assign";
import { initDomesticTripRegisterPanel } from "./08_domestic-trip-register";
import { initDomesticTripSettlementPanel } from "./09_domestic-trip-settlement";

const API_BASE =
  location.hostname === "gwoun01.github.io"
    ? "https://outwork.sel3.cloudtype.app"
    : "http://127.0.0.1:5050";

function initLocalTabNavigation() {
  const navButtons = document.querySelectorAll<HTMLButtonElement>(".nav-btn");
  const panels = document.querySelectorAll<HTMLElement>('[id^="panel-"]');
  const titleEl = document.getElementById("wsTitle") as HTMLHeadingElement | null;

  function showPanel(id: string) {
    panels.forEach((p) => p.classList.add("hidden"));

    const target = document.getElementById(id);
    if (target) target.classList.remove("hidden");

    navButtons.forEach((btn) => {
      const active = btn.dataset.panel === id;
      btn.classList.toggle("bg-[#7ce92f]", active);
      btn.classList.toggle("text-[#000000]", active);
      btn.classList.toggle("font-bold", active);
    });

    const curBtn = document.querySelector<HTMLButtonElement>(
      `.nav-btn[data-panel="${id}"]`
    );
    if (curBtn && titleEl) {
      titleEl.textContent = curBtn.textContent?.trim() ?? "";
    }
  }

  showPanel("panel-dashboard");
  return showPanel;
}

// ==============================================================
// 🔵 메인 초기화
// ==============================================================

document.addEventListener("DOMContentLoaded", async () => {
  console.debug("[INIT] DOMContentLoaded 시작");

  const showPanel = initLocalTabNavigation();

  const sidebarButtons =
    document.querySelectorAll<HTMLButtonElement>("#sidebar [data-panel]");

  sidebarButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.panel;
      if (!id) return;

      showPanel(id);

      // ✅ 출장 등록
      if (id === "panel-국내출장-출장등록") {
        await initDomesticTripRegisterPanel(API_BASE);
        console.log("국내출장-출장등록 init 완료");
      }

      // ✅ 정산서 등록 (🔥 핵심)
      if (id === "panel-국내출장-정산서등록") {
        await initDomesticTripSettlementPanel(API_BASE);
        console.log("국내출장-정산서등록 init 완료");
      }
    });
  });

  console.debug("[INIT] workspace 초기화 완료");
});
