//import { initWorkAssignPanel } from "./01_work-assign";
import { initDomesticTripRegisterPanel } from "./08_domestic-trip-register";
import { initDomesticTripSettlementPanel } from "./09_domestic-trip-settlement";
import { initDomesticTripHistoryPanel } from "./10_domestic-trip-history";

/** 🔹 REGISTER 쪽에서 localStorage에 넣는 구조랑 맞춰줌 */
type DomesticTripRegisterPayload = {
  trip_type: "domestic";
  req_name: string;
  depart_place: string;      // 출발지
  destination: string;       // 출장지(고객사/지역)
  start_date: string;        // YYYY-MM-DD
  work_start_time: string;   // HH:mm
  depart_time: string;       // HH:mm
  arrive_time: string;       // HH:mm
  purpose: string;
};

type StoredBusinessTrip = DomesticTripRegisterPayload & {
  id: number;
  status: "예정" | "진행중" | "완료";
  created_at: string;
};

const API_BASE =
  location.hostname === "gwoun01.github.io"
    ? "https://outwork.sel3.cloudtype.app"
    : "http://127.0.0.1:5050";

/** 오늘 날짜 YYYY-MM-DD */
function getTodayYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * ✅ 출장자 현황: 로컬스토리지에서 읽어서 표(tbody)에 로딩
 * - No | 이름 | 고객사 | 출발시간 | 도착시간 | 상태(출장 고정)
 */
async function renderTripStatusTable(date?: string) {
  const tbody = document.getElementById("tripStatusTbody");
  const label = document.getElementById("tripStatusDateLabel");

  if (!tbody) return;

  const today = getTodayYmd();
  const baseDate = date || today;

  if (label) label.textContent = date ? date : "오늘";

  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="border px-2 py-3 text-center text-xs text-gray-400">
        데이터 로딩 중...
      </td>
    </tr>
  `;

  // 🔹 1) 로컬에서 리스트 읽기
  const listKey = "businessTripList";
  const storedRaw = localStorage.getItem(listKey);

  let list: StoredBusinessTrip[] = [];
  if (storedRaw) {
    try {
      list = JSON.parse(storedRaw) as StoredBusinessTrip[];
    } catch (e) {
      console.error("[대시보드] businessTripList JSON 파싱 실패:", e);
      list = [];
    }
  }

  // 🔹 2) 기준 날짜 + 국내출장만 필터
  const items = list.filter(
    (t) => t.start_date === baseDate && t.trip_type === "domestic"
  );

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
 * - localStorage businessTripList 기준으로 개수 세기
 */
async function updateKpiTripToday(date?: string) {
  const elTrip = document.getElementById("kpiTripToday");
  if (!elTrip) return;

  const today = getTodayYmd();
  const baseDate = date || today;

  const listKey = "businessTripList";
  const storedRaw = localStorage.getItem(listKey);

  let list: StoredBusinessTrip[] = [];
  if (storedRaw) {
    try {
      list = JSON.parse(storedRaw) as StoredBusinessTrip[];
    } catch (e) {
      console.error("[대시보드] businessTripList JSON 파싱 실패:", e);
      list = [];
    }
  }

  const todays = list.filter(
    (t) => t.start_date === baseDate && t.trip_type === "domestic"
  );

  elTrip.textContent = String(todays.length);
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

  // ✅ 기본 패널은 대시보드
  showPanel("panel-dashboard");
  return showPanel;
}

// ==============================================================
// 🔵 메인 초기화
// ==============================================================

document.addEventListener("DOMContentLoaded", async () => {
  console.debug("[INIT] DOMContentLoaded 시작");

  const showPanel = initLocalTabNavigation();

  // ✅ 등록/정산 쪽에서
  //    window.dispatchEvent(new Event("trip-status-refresh"));
  //    호출하면 여기서 대시보드를 다시 그림
  window.addEventListener("trip-status-refresh", () => {
    console.debug("[EVENT] trip-status-refresh → 대시보드 갱신");
    renderTripStatusTable();
    updateKpiTripToday();
  });

  // ❌ (기존에 있던 open-trip-settlement 이벤트는 이제 안 씀)
  // window.addEventListener("open-trip-settlement", ... ) 부분 제거

  const sidebarButtons =
    document.querySelectorAll<HTMLButtonElement>("#sidebar [data-panel]");

  sidebarButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.panel;
      if (!id) return;

      showPanel(id);

      // ✅ 대시보드 버튼 눌렀을 때도 항상 최신 로컬 데이터 다시 가져오기
      if (id === "panel-dashboard") {
        await renderTripStatusTable();
        await updateKpiTripToday();
      }

      // ✅ 국내출장 - 출장등록 클릭 시
      //    → 등록 + 정산 패널 둘 다 초기화 (이때 bt_save에 이벤트가 걸림)
      if (id === "panel-국내출장-출장등록") {
        await initDomesticTripRegisterPanel(API_BASE);
        await initDomesticTripSettlementPanel(API_BASE);
        console.log("국내출장-출장등록 & 정산 init 완료");
      }

      // ✅ 국내출장 - 출장내역(정산 내역 조회)
      if (id === "panel-국내출장-정산서등록") {
        await initDomesticTripHistoryPanel(API_BASE);
        console.log("국내출장-정산내역 조회 init 완료");
      }
    });
  });

  // ✅ 최초 로딩(오늘 기준): 표 + KPI
  await renderTripStatusTable();
  await updateKpiTripToday();

  console.debug("[INIT] workspace 초기화 완료");
});
