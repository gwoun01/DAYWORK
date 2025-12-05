import { initWorkAssignPanel } from "./01_work-assign";


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

// =====================================================
// 🔵 메인 초기화
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
    console.debug("[INIT] DOMContentLoaded 시작");

    const showPanel = initLocalTabNavigation();

    // 👤 사용자 이름 (하드코딩 예시)
    const userName = document.getElementById("userName")?.textContent?.trim() ?? "Guest";

    const sidebarButtons = document.querySelectorAll<HTMLButtonElement>("#sidebar [data-panel]");

    const id = sidebarButtons.item;
    sidebarButtons.forEach((btn) => {

        btn.addEventListener("click", async () => {
            const id = btn.dataset.panel;

            if (id?.includes("panel-업무할당")) {
                initWorkAssignPanel();
                console.log("dddddd");
            }




        });



        console.debug("[INIT] workspace 초기화 완료");
    });

});
