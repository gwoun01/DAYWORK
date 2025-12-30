// TypeScript/workspace/01_dashboard-trip-status.ts

type TripStatusItem = {
  trip_id: string;
  req_name: string;
  trip_date: string;
  depart_place: string;
  destination: string;
  depart_time: string;
  arrive_time: string;
  status: string; // REGISTERED / SETTLED
};

/**
 * 📌 대시보드 - 출장자 현황 + 오늘 출장 인원
 *  - 백엔드 /api/business-trip/status 에서 읽어옴
 *  - 08 / 09 파일에서 window.dispatchEvent("trip-status-refresh") 날리면 여기서 다시 로딩
 */
export function initDashboardTripStatus(API_BASE: string) {
  const kpiTripEl = document.getElementById("kpiTripToday");
  const tbody = document.getElementById(
    "tripStatusTbody"
  ) as HTMLTableSectionElement | null;
  const dateLabel = document.getElementById("tripStatusDateLabel");
  const searchInput = document.getElementById(
    "tripSearchInput"
  ) as HTMLInputElement | null;
  const filterSelect = document.getElementById(
    "tripFilterType"
  ) as HTMLSelectElement | null;
  const reloadBtn = document.getElementById(
    "btnTripReload"
  ) as HTMLButtonElement | null;

  // 🔹 필수 DOM 없으면 그냥 종료
  if (!kpiTripEl || !tbody) {
    console.warn("[대시보드] 출장자 현황용 요소를 찾지 못했습니다.");
    return;
  }

  // 👉 여기서부터는 tbody 가 null 이 아니라고 확정된 상태
  const tbodyEl = tbody as HTMLTableSectionElement;

  let lastItems: TripStatusItem[] = [];
  let currentDate: string | undefined; // YYYY-MM-DD (없으면 오늘)

  // -----------------------------
  // 🔹 테이블 렌더 함수
  // -----------------------------
  function renderTable() {
    const keyword = (searchInput?.value ?? "").trim().toLowerCase();
    const filter = filterSelect?.value ?? "all";

    let items = lastItems.slice();

    // (1) 종류 필터: 지금은 전부 국내 출장이라 all/domestic 만 사용
    if (filter === "overseas" || filter === "inhouse") {
      items = [];
    }

    // (2) 검색어 필터: 이름 / 고객사 / 출발지
    if (keyword) {
      items = items.filter((it) => {
        const name = it.req_name?.toLowerCase() ?? "";
        const dest = it.destination?.toLowerCase() ?? "";
        const place = it.depart_place?.toLowerCase() ?? "";
        return (
          name.includes(keyword) ||
          dest.includes(keyword) ||
          place.includes(keyword)
        );
      });
    }

    if (items.length === 0) {
      tbodyEl.innerHTML = `
        <tr>
          <td colspan="6" class="border px-2 py-3 text-center text-xs text-gray-400">
            등록된 출장 데이터가 없습니다.
          </td>
        </tr>
      `;
      return;
    }

    tbodyEl.innerHTML = "";

    items.forEach((it, idx) => {
      const tr = document.createElement("tr");
      tr.className = "border-t text-xs text-gray-700";

      const customer = it.destination || "-";
      const depart = it.depart_time || "-";
      const arrive = it.arrive_time || "-";

      const statusLabel =
        it.status === "SETTLED"
          ? `<span class="px-2 py-[2px] rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">정산완료</span>`
          : `<span class="px-2 py-[2px] rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">출장중</span>`;

      tr.innerHTML = `
        <td class="border px-2 py-2 text-center">${idx + 1}</td>
        <td class="border px-2 py-2 text-center font-semibold">${it.req_name || "-"}</td>
        <td class="border px-2 py-2 text-center">${customer}</td>
        <td class="border px-2 py-2 text-center">${depart}</td>
        <td class="border px-2 py-2 text-center">${arrive}</td>
        <td class="border px-2 py-2 text-center">${statusLabel}</td>
      `;
      tbodyEl.appendChild(tr);
    });
  }

  // -----------------------------
  // 🔹 서버에서 데이터 로딩
  // -----------------------------
  async function loadTripStatus(date?: string) {
    currentDate = date;

    if (dateLabel) {
      dateLabel.textContent = date ?? "오늘";
    }

    tbodyEl.innerHTML = `
      <tr>
        <td colspan="6" class="border px-2 py-3 text-center text-xs text-gray-400">
          데이터 로딩 중...
        </td>
      </tr>
    `;

    try {
      const params = new URLSearchParams();
      if (date) params.set("date", date);

      const url =
        params.toString().length > 0
          ? `${API_BASE}/api/business-trip/status?${params.toString()}`
          : `${API_BASE}/api/business-trip/status`;

      const res = await fetch(url);
      if (!res.ok) {
        console.error("[대시보드] /status 응답 오류:", res.status);
        tbodyEl.innerHTML = `
          <tr>
            <td colspan="6" class="border px-2 py-3 text-center text-xs text-red-500">
              서버 오류: HTTP ${res.status}
            </td>
          </tr>
        `;
        return;
      }

      const json = await res.json().catch(() => null);
      console.log("[대시보드] status 응답 =", json);
      const rows: TripStatusItem[] = json?.data ?? [];

      lastItems = rows;

      // KPI: 오늘 출장 인원 = 행 개수
      (kpiTripEl as HTMLElement).textContent = String(rows.length);

      renderTable();
    } catch (err: any) {
      console.error("[대시보드] 출장자 현황 로딩 실패:", err);
      tbodyEl.innerHTML = `
        <tr>
          <td colspan="6" class="border px-2 py-3 text-center text-xs text-red-500">
            데이터 로딩 중 오류가 발생했습니다.
          </td>
        </tr>
      `;
    }
  }

  // -----------------------------
  // 🔹 이벤트 바인딩
  // -----------------------------
  searchInput?.addEventListener("input", () => {
    renderTable();
  });

  filterSelect?.addEventListener("change", () => {
    renderTable();
  });

  reloadBtn?.addEventListener("click", () => {
    loadTripStatus(currentDate);
  });

  // ✅ 다른 화면(등록/정산)에서 이벤트 쏘면 여기서 다시 로딩
  window.addEventListener("trip-status-refresh", () => {
    loadTripStatus(currentDate);
  });

  // ✅ 최초 한 번 로딩 (오늘 기준)
  loadTripStatus();
}
