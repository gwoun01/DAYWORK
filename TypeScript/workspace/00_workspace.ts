//import { initWorkAssignPanel } from "./01_work-assign";
import { initDomesticTripRegisterPanel } from "./08_domestic-trip-register";
import { initDomesticTripSettlementPanel } from "./09_domestic-trip-settlement";

type TripStatusItem = {
  trip_id: string;
  req_name: string;
  destination: string;   // 고객사
  depart_time: string;   // 출발시간
  arrive_time: string;   // 도착시간
};

const API_BASE =
  location.hostname === "gwoun01.github.io"
    ? "https://outwork.sel3.cloudtype.app"
    : "http://127.0.0.1:5050";

/**
 * ✅ 출장자 현황: 표(tbody)에 로딩
 * - No | 이름 | 고객사 | 출발시간 | 도착시간 | 상태(출장 고정)
 */
async function renderTripStatusTable(date?: string) {
  const tbody = document.getElementById("tripStatusTbody");
  const label = document.getElementById("tripStatusDateLabel");

  if (!tbody) return;
  if (label) label.textContent = date ? date : "오늘";

  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="border px-2 py-3 text-center text-xs text-gray-400">
        데이터 로딩 중...
      </td>
    </tr>
  `;

  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  const res = await fetch(`${API_BASE}/api/business-trip/status${qs}`);

  if (!res.ok) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="border px-2 py-3 text-center text-xs text-rose-600">
          불러오기 실패 (HTTP ${res.status})
        </td>
      </tr>
    `;
    return;
  }

  const json = await res.json();
  const items: TripStatusItem[] = json?.data ?? [];

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="border px-2 py-3 text-center text-xs text-gray-400">
          등록된 출장 데이터가 없습니다.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = "";

  items.forEach((it, idx) => {
    const tr = document.createElement("tr");
    tr.className = "border-t text-xs text-gray-700";

    const customer = it.destination || "-";
    const depart = it.depart_time || "-";
    const arrive = it.arrive_time || "-";

    // ✅ 상태는 "출장" 고정
    const statusHtml =
      `<span class="px-2 py-[2px] rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">출장</span>`;

    tr.innerHTML = `
      <td class="border px-2 py-2 text-center">${idx + 1}</td>
      <td class="border px-2 py-2 text-center font-semibold">${it.req_name || "-"}</td>
      <td class="border px-2 py-2 text-center">${customer}</td>
      <td class="border px-2 py-2 text-center">${depart}</td>
      <td class="border px-2 py-2 text-center">${arrive}</td>
      <td class="border px-2 py-2 text-center">${statusHtml}</td>
    `;

    tbody.appendChild(tr);
  });
}

/**
 * ✅ 오늘 출장 인원 KPI 업데이트
 * - /status 결과 개수를 kpiTripToday에 표시
 */
async function updateKpiTripToday(date?: string) {
  const elTrip = document.getElementById("kpiTripToday");
  if (!elTrip) return;

  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  const res = await fetch(`${API_BASE}/api/business-trip/status${qs}`);

  if (!res.ok) {
    elTrip.textContent = "0";
    return;
  }

  const json = await res.json();
  const items = json?.data ?? [];

  elTrip.textContent = String(items.length);
}

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

  // ✅ 정산 저장 성공 후 이벤트가 오면: 표 + KPI 갱신
  window.addEventListener("trip-status-refresh", () => {
    renderTripStatusTable();
    updateKpiTripToday();
  });

  const sidebarButtons =
    document.querySelectorAll<HTMLButtonElement>("#sidebar [data-panel]");

  sidebarButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.panel;
      if (!id) return;

      showPanel(id);

      if (id === "panel-국내출장-출장등록") {
        await initDomesticTripRegisterPanel(API_BASE);
        console.log("국내출장-출장등록 init 완료");
      }

      if (id === "panel-국내출장-정산서등록") {
        await initDomesticTripSettlementPanel(API_BASE);
        console.log("국내출장-정산서등록 init 완료");
      }
    });
  });

  // ✅ 최초 로딩(오늘 기준): 표 + KPI
  await renderTripStatusTable();
  await updateKpiTripToday();

  console.debug("[INIT] workspace 초기화 완료");
});
