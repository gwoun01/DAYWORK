// src/TypeScript/workspace/02_trip-approval.ts
import { placeLabel } from "./utils/DistanceCalc";

type TripRow = {
    trip_id: string;
    req_name: string;
    trip_date: string;
    start_data: any | null;
    end_data: any | null;
    detail_json: {
        register?: any;
        settlement?: any;
    } | null;
    approve_status: "pending" | "approved" | "rejected" | null;
    approve_by?: string | null;
    approve_at?: string | null;
    approve_comment?: string | null;
};

type WeeklyGroup = {
    key: string;
    weekStart: string;
    weekEnd: string;
    req_name: string;
    company_part: string;
    rows: TripRow[];
};

function getEl<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`element not found: #${id}`);
    return el as T;
}

/** ISO 날짜 또는 문자열 → YYYY-MM-DD */
function formatDateLabel(value: string | null | undefined): string {
    if (!value) return "";
    if (value.length >= 10) return value.slice(0, 10);
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 특정 날짜가 속한 주(월~일) 구하기 */
function getWeekRange(dateStr: string): { start: string; end: string } {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
        return { start: formatDateLabel(dateStr), end: formatDateLabel(dateStr) };
    }
    const day = (d.getDay() + 6) % 7; // 월=0
    const monday = new Date(d);
    monday.setDate(d.getDate() - day);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
        start: monday.toISOString().slice(0, 10),
        end: sunday.toISOString().slice(0, 10),
    };
}

/** TripRow[] 를 직원+주간 단위로 묶기 */
function buildWeeklyGroups(rows: TripRow[]): WeeklyGroup[] {
    const map = new Map<string, WeeklyGroup>();

    for (const row of rows) {
        const { start, end } = getWeekRange(row.trip_date);
        const company_part = (row as any).company_part ?? "-";
        const key = `${row.req_name}__${company_part}__${start}`;

        let group = map.get(key);
        if (!group) {
            group = {
                key,
                weekStart: start,
                weekEnd: end,
                req_name: row.req_name,
                company_part,
                rows: [],
            };
            map.set(key, group);
        }
        group.rows.push(row);
    }

    return Array.from(map.values()).sort((a, b) => {
        if (a.weekStart !== b.weekStart) return a.weekStart.localeCompare(b.weekStart);
        if (a.company_part !== b.company_part) return a.company_part.localeCompare(b.company_part);
        return a.req_name.localeCompare(b.req_name);
    });
}

const API_BASE =
    location.hostname === "gwoun01.github.io"
        ? "https://outwork.sel3.cloudtype.app"
        : "http://127.0.0.1:5050";

let currentGroup: WeeklyGroup | null = null;

/** ✅ 차량값이 뭐로 오든 표준화 */
function normalizeVehicle(v: any): "corp" | "personal" | "other" | "public" | "" {
    const s = String(v ?? "").trim();
    if (!s) return "";
    if (s === "corp" || s === "corporate") return "corp";
    if (s === "personal") return "personal";
    if (s === "other" || s === "other_personal") return "other";
    if (s === "public") return "public";
    return "other";
}

/** ✅ 차량 표시 라벨 */
function vehicleLabel(v: any): string {
    const code = normalizeVehicle(v);
    if (code === "corp") return "법인";
    if (code === "personal") return "개인";
    if (code === "public") return "대중교통";
    if (code === "other") return "기타";
    return "-";
}

export function initTripApprovalPanel(_panelId: string) {
    const fromInput = getEl<HTMLInputElement>("appr_from");
    const toInput = getEl<HTMLInputElement>("appr_to");
    const statusSelect = getEl<HTMLSelectElement>("appr_status");
    const searchBtn = getEl<HTMLButtonElement>("appr_search");
    const resultMsg = getEl<HTMLDivElement>("appr_result_msg");
    const tbody = getEl<HTMLTableSectionElement>("approve_result_tbody");

    // 기본 조회 기간: 이번 주
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    fromInput.value = monday.toISOString().slice(0, 10);
    toInput.value = sunday.toISOString().slice(0, 10);

    // 🔍 조회 버튼
    searchBtn.addEventListener("click", async () => {
        const from = fromInput.value;
        const to = toInput.value;
        const status = statusSelect.value;

        if (!from || !to) {
            alert("시작일과 종료일을 모두 선택해주세요.");
            return;
        }

        resultMsg.textContent = "조회 중입니다...";
        tbody.innerHTML = `
      <tr>
        <td colspan="5" class="border px-2 py-3 text-center text-gray-400">
          조회 중...
        </td>
      </tr>`;

        try {
            const url = new URL("/api/business-trip/settlements-range-admin", API_BASE);
            url.searchParams.set("from", from);
            url.searchParams.set("to", to);
            url.searchParams.set("status", status);

            const res = await fetch(url.toString(), { credentials: "include" });
            const json = await res.json();

            if (!json.ok) {
                resultMsg.textContent = json.message ?? "조회 실패";
                tbody.innerHTML = `
          <tr>
            <td colspan="5" class="border px-2 py-3 text-center text-gray-400">
              조회 실패: ${json.message ?? "알 수 없는 오류"}
            </td>
          </tr>`;
                return;
            }

            const rows: TripRow[] = json.data ?? [];
            if (rows.length === 0) {
                resultMsg.textContent = "해당 기간에 조회된 출장 내역이 없습니다.";
                tbody.innerHTML = `
          <tr>
            <td colspan="5" class="border px-2 py-3 text-center text-gray-400">
              조회된 출장 내역이 없습니다.
            </td>
          </tr>`;
                return;
            }

            const groups = buildWeeklyGroups(rows);
            resultMsg.textContent = `총 ${groups.length}개 주간 묶음 / ${rows.length}건 조회되었습니다.`;
            tbody.innerHTML = "";

            groups.forEach((g) => {
                const tr = document.createElement("tr");

                // 기간
                const tdPeriod = document.createElement("td");
                tdPeriod.className = "border px-2 py-1 text-center";
                tdPeriod.textContent = `${formatDateLabel(g.weekStart)} ~ ${formatDateLabel(g.weekEnd)}`;
                tr.appendChild(tdPeriod);

                // 소속팀
                const tdTeam = document.createElement("td");
                tdTeam.className = "border px-2 py-1 text-center";
                tdTeam.textContent = g.company_part;
                tr.appendChild(tdTeam);

                // 이름
                const tdName = document.createElement("td");
                tdName.className = "border px-2 py-1 text-center";
                tdName.textContent = g.req_name;
                tr.appendChild(tdName);

                // 건수
                const tdCount = document.createElement("td");
                tdCount.className = "border px-2 py-1 text-center";
                tdCount.textContent = String(g.rows.length);
                tr.appendChild(tdCount);

                // 상세 버튼
                const tdDetail = document.createElement("td");
                tdDetail.className = "border px-2 py-1 text-center";
                const btn = document.createElement("button");
                btn.type = "button";
                btn.textContent = "주간 상세";
                btn.className = "px-2 py-1 rounded-lg bg-indigo-500 text-white text-[11px] hover:bg-indigo-600";
                btn.addEventListener("click", () => openWeeklyDetailModal(g));
                tdDetail.appendChild(btn);
                tr.appendChild(tdDetail);

                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error(err);
            resultMsg.textContent = "서버 오류가 발생했습니다.";
            tbody.innerHTML = `
        <tr>
          <td colspan="5" class="border px-2 py-3 text-center text-gray-400">
            서버 오류가 발생했습니다.
          </td>
        </tr>`;
        }
    });

    // 모달 관련 이벤트
    const modal = getEl<HTMLDivElement>("appr_modal");
    const modalCloseBtn = getEl<HTMLButtonElement>("appr_modal_close");
    const btnApprove = getEl<HTMLButtonElement>("appr_btn_approve");
    const btnReject = getEl<HTMLButtonElement>("appr_btn_reject");

    modalCloseBtn.addEventListener("click", () => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    });

    // ✅ 주간 승인
    btnApprove.addEventListener("click", async () => {
        if (!currentGroup) return;
        const comment = getEl<HTMLTextAreaElement>("appr_comment").value.trim();

        if (!confirm("이 주간의 모든 출장 건을 승인하시겠습니까?")) return;

        try {
            const approver = (window as any).CURRENT_USER_NAME ?? null;
            let failed = 0;

            for (const row of currentGroup.rows) {
                if (row.approve_status === "approved") continue;
                const res = await fetch(`${API_BASE}/api/business-trip/${encodeURIComponent(row.trip_id)}/approve`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ approver, comment }),
                });
                const json = await res.json();
                if (!json.ok) {
                    failed++;
                    console.error("승인 실패", row.trip_id, json);
                }
            }

            if (failed > 0) alert(`일부(${failed}건)는 승인에 실패했습니다. 콘솔을 확인해주세요.`);
            else alert("해당 주간 출장 건이 모두 승인되었습니다.");

            modal.classList.add("hidden");
            modal.classList.remove("flex");
            getEl<HTMLButtonElement>("appr_search").click();
        } catch (e) {
            console.error(e);
            alert("서버 오류로 승인에 실패했습니다.");
        }
    });

    // ✅ 주간 반려
    btnReject.addEventListener("click", async () => {
        if (!currentGroup) return;
        const comment = getEl<HTMLTextAreaElement>("appr_comment").value.trim();
        if (!comment) {
            if (!confirm("반려 사유가 없습니다. 그래도 반려하시겠습니까?")) return;
        }

        try {
            const approver = (window as any).CURRENT_USER_NAME ?? null;
            let failed = 0;

            for (const row of currentGroup.rows) {
                if (row.approve_status === "rejected") continue;
                const res = await fetch(`${API_BASE}/api/business-trip/${encodeURIComponent(row.trip_id)}/reject`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ approver, comment }),
                });
                const json = await res.json();
                if (!json.ok) {
                    failed++;
                    console.error("반려 실패", row.trip_id, json);
                }
            }

            if (failed > 0) alert(`일부(${failed}건)는 반려에 실패했습니다. 콘솔을 확인해주세요.`);
            else alert("해당 주간 출장 건이 모두 반려되었습니다.");

            modal.classList.add("hidden");
            modal.classList.remove("flex");
            getEl<HTMLButtonElement>("appr_search").click();
        } catch (e) {
            console.error(e);
            alert("서버 오류로 반려에 실패했습니다.");
        }
    });
}

/** 🔍 주간 상세 모달 */
function openWeeklyDetailModal(group: WeeklyGroup) {
    currentGroup = group;

    const modal = getEl<HTMLDivElement>("appr_modal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");

    getEl<HTMLDivElement>("appr_d_name").textContent = group.req_name;
    getEl<HTMLDivElement>("appr_d_date").textContent = `${formatDateLabel(group.weekStart)} ~ ${formatDateLabel(group.weekEnd)}`;

    const tbody = getEl<HTMLTableSectionElement>("appr_detail_tbody");
    tbody.innerHTML = "";

    const sorted = [...group.rows].sort((a, b) => a.trip_date.localeCompare(b.trip_date));

    function td(text: string, cls = "border px-2 py-1 text-center") {
        const el = document.createElement("td");
        el.className = cls;
        el.textContent = text || "";
        return el;
    }

    const mealText = (m: any) => {
        if (!m || !m.checked) return "-";
        if (m.owner === "corp") return "법인";
        if (m.owner === "personal") return "개인";
        return "사용";
    };

    for (const row of sorted) {
        const reg = (row.detail_json?.register || row.start_data || {}) as any;
        const set = (row.detail_json?.settlement || row.end_data || {}) as any;

        const workTime =
            reg.depart_time && set.work_end_time ? `${reg.depart_time} ~ ${set.work_end_time}` : "";

        const meals = set.meals || {};

        const tr = document.createElement("tr");
        tr.appendChild(td(formatDateLabel(row.trip_date))); // 일자
        tr.appendChild(td(placeLabel(reg.depart_place ?? ""))); // ✅ 출발지 한글표기
        tr.appendChild(td(reg.destination ?? "")); // 출장지
        tr.appendChild(td(reg.depart_time ?? "")); // 출발시간
        tr.appendChild(td(reg.arrive_time ?? "")); // 도착시간
        tr.appendChild(td(workTime)); // 업무시간
        tr.appendChild(td(placeLabel(set.return_place ?? ""))); // ✅ 복귀지 한글표기
        tr.appendChild(td(vehicleLabel(set.vehicle))); // ✅ 차량 표기 통일
        tr.appendChild(td(mealText(meals.breakfast))); // 조식
        tr.appendChild(td(mealText(meals.lunch))); // 중식
        tr.appendChild(td(mealText(meals.dinner))); // 석식
        tr.appendChild(td(reg.purpose ?? "", "border px-2 py-1 text-left whitespace-pre-wrap")); // 목적

        tbody.appendChild(tr);
    }

    // 💰 금액 요약 (주간 전체 합계)
    let totalMealsAmount = 0;
    let totalFuelAmount = 0;

    for (const row of group.rows) {
        const set = (row.detail_json?.settlement || row.end_data || {}) as any;
        const c = set.calc || {};
        totalMealsAmount += c.meals_personal_amount ?? 0;
        totalFuelAmount += c.fuel_amount ?? 0;
    }

    const amountBox = getEl<HTMLDivElement>("appr_amount_box");
    const sum = totalMealsAmount + totalFuelAmount;
    amountBox.textContent = `식대(개인) ${totalMealsAmount.toLocaleString()}원 / 유류비 ${totalFuelAmount.toLocaleString()}원 / 합계 ${sum.toLocaleString()}원`;

    // 승인/반려 상태 요약
    const total = group.rows.length;
    const pending = group.rows.filter((r) => !r.approve_status || r.approve_status === "pending").length;
    const approved = group.rows.filter((r) => r.approve_status === "approved").length;
    const rejected = group.rows.filter((r) => r.approve_status === "rejected").length;

    const footer = getEl<HTMLDivElement>("appr_footer_info");
    footer.textContent = `총 ${total}건 / 대기 ${pending}건 / 승인 ${approved}건 / 반려 ${rejected}건`;

    // 의견 초기화
    getEl<HTMLTextAreaElement>("appr_comment").value = group.rows[0]?.approve_comment ?? "";
}
