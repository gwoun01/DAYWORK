// TypeScript/workspace/10_domestic-trip-history.ts

function getEl<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`element not found: #${id}`);
    return el as T;
}

type RegisterBlock = {
    trip_type?: string;
    req_name?: string;
    depart_place?: string;
    destination?: string;
    start_date?: string;
    work_start_time?: string;
    depart_time?: string;
    arrive_time?: string;
    purpose?: string;
};

type SettlementBlock = {
    work_end_time?: string;
    return_time?: string;
    return_place?: string;
    vehicle?: string;
    meals?: {
        breakfast?: { checked?: boolean; owner?: string };
        lunch?: { checked?: boolean; owner?: string };
        dinner?: { checked?: boolean; owner?: string };
    };
};

type BusinessTripRow = {
    trip_id: string;
    req_name: string;
    trip_date: string;
    detail_json: {
        register?: RegisterBlock;
        settlement?: SettlementBlock;
    };
    created_at: string;
};

function formatYmd(isoDate: string | Date): string {
    const d = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
    if (Number.isNaN(d.getTime())) return "-";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// 🌟 정산 내역 보기 패널 초기화
export function initDomesticTripHistoryPanel(API_BASE: string) {
    const panel = document.getElementById("panel-국내출장-정산서등록");
    if (!panel) return;

    const searchBtn = getEl<HTMLButtonElement>("settle_search");

    // 중복 바인딩 방지
    if ((searchBtn as any)._bound) return;
    (searchBtn as any)._bound = true;

    const fromInput = getEl<HTMLInputElement>("settle_from");
    const toInput = getEl<HTMLInputElement>("settle_to");
    const onlyMeCheckbox = getEl<HTMLInputElement>("settle_only_me");
    const resultMsg = getEl<HTMLDivElement>("settle_result_msg");
    const tbody = getEl<HTMLTableSectionElement>("settle_result_tbody");

    // 기본값: 이번 주 정도로 넣고 싶으면 여기서 세팅 가능
    if (!fromInput.value || !toInput.value) {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        const todayStr = `${y}-${m}-${d}`;
        fromInput.value = todayStr;
        toInput.value = todayStr;
    }

    async function fetchHistory() {
        const from = fromInput.value;
        const to = toInput.value;

        if (!from || !to) {
            resultMsg.textContent = "시작일과 종료일을 모두 선택하세요.";
            return;
        }

        if (from > to) {
            resultMsg.textContent = "시작일이 종료일보다 늦을 수 없습니다.";
            return;
        }

        // 로그인 사용자 이름(나의 정산만 체크 시 사용)
        let reqNameParam = "";
        if (onlyMeCheckbox.checked) {
            try {
                const stored = localStorage.getItem("user");
                if (stored) {
                    const user = JSON.parse(stored);
                    if (user?.name) {
                        reqNameParam = user.name;
                    }
                }
            } catch {
                // 무시
            }
        }

        resultMsg.textContent = "정산 내역을 조회 중입니다...";
        tbody.innerHTML = `
      <tr>
        <td colspan="7" class="border px-2 py-3 text-center text-gray-400">
          조회 중...
        </td>
      </tr>
    `;

        const qs = new URLSearchParams();
        qs.set("from", from);
        qs.set("to", to);
        if (reqNameParam) qs.set("req_name", reqNameParam);

        try {
            const res = await fetch(
                `${API_BASE}/api/business-trip/settlements-range?${qs.toString()}`,
                { method: "GET" }
            );

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`HTTP ${res.status} / ${text}`);
            }

            const json = await res.json();
            const rows: BusinessTripRow[] = json?.data ?? [];

            if (!rows.length) {
                tbody.innerHTML = `
          <tr>
            <td colspan="7" class="border px-2 py-3 text-center text-gray-400">
              조회된 정산 내역이 없습니다.
            </td>
          </tr>
        `;
                resultMsg.textContent = "조회된 정산 내역이 없습니다.";
                return;
            }

            // 렌더링
            tbody.innerHTML = "";
            rows.forEach((row) => {
                const r = row.detail_json?.register ?? {};
                const s = row.detail_json?.settlement ?? {};

                const dateStr = formatYmd(row.trip_date);
                const name = row.req_name || "-";
                const dest = r.destination || "-";
                const depart = r.depart_time || "-";
                const arrive = r.arrive_time || "-";
                const workStart = r.work_start_time || "-";
                const workEnd = s.work_end_time || "-";
                const vehicle = s.vehicle || "-";

                const meals = s.meals || {};
                const mealStrs: string[] = [];
                if (meals.breakfast?.checked) {
                    mealStrs.push(`조식(${meals.breakfast.owner === "corp" ? "법인" : "개인"})`);
                }
                if (meals.lunch?.checked) {
                    mealStrs.push(`중식(${meals.lunch.owner === "corp" ? "법인" : "개인"})`);
                }
                if (meals.dinner?.checked) {
                    mealStrs.push(`석식(${meals.dinner.owner === "corp" ? "법인" : "개인"})`);
                }
                const mealsText = mealStrs.length ? mealStrs.join(", ") : "-";

                const tr = document.createElement("tr");
                tr.innerHTML = `
          <td class="border px-2 py-1 text-center">${dateStr}</td>
          <td class="border px-2 py-1 text-center">${name}</td>
          <td class="border px-2 py-1 text-center">${dest}</td>
          <td class="border px-2 py-1 text-center">${depart} ~ ${arrive}</td>
          <td class="border px-2 py-1 text-center">${workStart} ~ ${workEnd}</td>
          <td class="border px-2 py-1 text-center">${vehicle}</td>
          <td class="border px-2 py-1 text-center">${mealsText}</td>
        `;
                tbody.appendChild(tr);
            });

            resultMsg.textContent = `총 ${rows.length}건의 정산 내역이 조회되었습니다.`;
        } catch (err: any) {
            console.error(err);
            resultMsg.textContent = `조회 실패: ${err?.message ?? "알 수 없는 오류"}`;
            tbody.innerHTML = `
        <tr>
          <td colspan="7" class="border px-2 py-3 text-center text-rose-500">
            조회 실패: ${err?.message ?? "알 수 없는 오류"}
          </td>
        </tr>
      `;
        }
    }

    // 버튼 이벤트 연결
    searchBtn.addEventListener("click", () => {
        fetchHistory();
    });
}
