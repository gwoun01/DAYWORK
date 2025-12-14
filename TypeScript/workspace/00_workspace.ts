import { initWorkAssignPanel } from "./01_work-assign";
import { initDomesticTripRequestPanel } from "./08_domestic-trip-request"; // ✅ 추가

const API_BASE =
  location.hostname === "tgyeo.github.io"
    ? "https://port-0-innomax-mghorm7bef413a34.sel3.cloudtype.app"
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
   

document.addEventListener("DOMContentLoaded", async () => {
  console.debug("[INIT] DOMContentLoaded 시작");

  const showPanel = initLocalTabNavigation();

  const sidebarButtons =
    document.querySelectorAll<HTMLButtonElement>("#sidebar [data-panel]");

  sidebarButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.panel;
      if (!id) return;

      // ✅ 1) 먼저 패널 화면 전환
      showPanel(id);

      // ✅ 2) 패널별 초기화(로직 연결)
      if (id.includes("panel-업무할당")) {
        await initWorkAssignPanel();
        console.log("업무할당 init 완료");
      }

      if (id.includes("panel-국내출장요청")) {
        await initDomesticTripRequestPanel(API_BASE);
        console.log("국내출장요청 init 완료");
      }
    });
  });

  console.debug("[INIT] workspace 초기화 완료");
});
