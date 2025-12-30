/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./TypeScript/workspace/01_dashboard-trip-status.ts":
/*!**********************************************************!*\
  !*** ./TypeScript/workspace/01_dashboard-trip-status.ts ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initDashboardTripStatus: () => (/* binding */ initDashboardTripStatus)
/* harmony export */ });
// TypeScript/workspace/01_dashboard-trip-status.ts
/**
 * 📌 대시보드 - 출장자 현황 + 오늘 출장 인원
 *  - 백엔드 /api/business-trip/status 에서 읽어옴
 *  - 08 / 09 파일에서 window.dispatchEvent("trip-status-refresh") 날리면 여기서 다시 로딩
 */
function initDashboardTripStatus(API_BASE) {
    const kpiTripEl = document.getElementById("kpiTripToday");
    const tbody = document.getElementById("tripStatusTbody");
    const dateLabel = document.getElementById("tripStatusDateLabel");
    const searchInput = document.getElementById("tripSearchInput");
    const filterSelect = document.getElementById("tripFilterType");
    const reloadBtn = document.getElementById("btnTripReload");
    // 🔹 필수 DOM 없으면 그냥 종료
    if (!kpiTripEl || !tbody) {
        console.warn("[대시보드] 출장자 현황용 요소를 찾지 못했습니다.");
        return;
    }
    // 👉 여기서부터는 tbody 가 null 이 아니라고 확정된 상태
    const tbodyEl = tbody;
    let lastItems = [];
    let currentDate; // YYYY-MM-DD (없으면 오늘)
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
                return (name.includes(keyword) ||
                    dest.includes(keyword) ||
                    place.includes(keyword));
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
            const statusLabel = it.status === "SETTLED"
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
    async function loadTripStatus(date) {
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
            if (date)
                params.set("date", date);
            const url = params.toString().length > 0
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
            const rows = json?.data ?? [];
            lastItems = rows;
            // KPI: 오늘 출장 인원 = 행 개수
            kpiTripEl.textContent = String(rows.length);
            renderTable();
        }
        catch (err) {
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


/***/ }),

/***/ "./TypeScript/workspace/02_trip-approval.ts":
/*!**************************************************!*\
  !*** ./TypeScript/workspace/02_trip-approval.ts ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initTripApprovalPanel: () => (/* binding */ initTripApprovalPanel)
/* harmony export */ });
// src/TypeScript/workspace/02_trip-approval.ts
function getEl(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`element not found: #${id}`);
    return el;
}
/** ISO 날짜 또는 문자열 → YYYY-MM-DD */
function formatDateLabel(value) {
    if (!value)
        return "";
    if (value.length >= 10)
        return value.slice(0, 10);
    const d = new Date(value);
    if (isNaN(d.getTime()))
        return value;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** 특정 날짜가 속한 주(월~일) 구하기 */
function getWeekRange(dateStr) {
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
function buildWeeklyGroups(rows) {
    const map = new Map();
    for (const row of rows) {
        const { start, end } = getWeekRange(row.trip_date);
        const company_part = row.company_part ?? "-";
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
    // 보기 좋게 정렬
    return Array.from(map.values()).sort((a, b) => {
        if (a.weekStart !== b.weekStart) {
            return a.weekStart.localeCompare(b.weekStart);
        }
        if (a.company_part !== b.company_part) {
            return a.company_part.localeCompare(b.company_part);
        }
        return a.req_name.localeCompare(b.req_name);
    });
}
const API_BASE = location.hostname === "gwoun01.github.io"
    ? "https://outwork.sel3.cloudtype.app"
    : "http://127.0.0.1:5050";
let currentGroup = null;
function initTripApprovalPanel(_panelId) {
    const fromInput = getEl("appr_from");
    const toInput = getEl("appr_to");
    const statusSelect = getEl("appr_status");
    const searchBtn = getEl("appr_search");
    const resultMsg = getEl("appr_result_msg");
    const tbody = getEl("approve_result_tbody");
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
            const rows = json.data ?? [];
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
                btn.className =
                    "px-2 py-1 rounded-lg bg-indigo-500 text-white text-[11px] hover:bg-indigo-600";
                btn.addEventListener("click", () => openWeeklyDetailModal(g));
                tdDetail.appendChild(btn);
                tr.appendChild(tdDetail);
                tbody.appendChild(tr);
            });
        }
        catch (err) {
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
    const modal = getEl("appr_modal");
    const modalCloseBtn = getEl("appr_modal_close");
    const btnApprove = getEl("appr_btn_approve");
    const btnReject = getEl("appr_btn_reject");
    modalCloseBtn.addEventListener("click", () => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    });
    // ✅ 주간 승인
    btnApprove.addEventListener("click", async () => {
        if (!currentGroup)
            return;
        const comment = getEl("appr_comment").value.trim();
        if (!confirm("이 주간의 모든 출장 건을 승인하시겠습니까?"))
            return;
        try {
            const approver = window.CURRENT_USER_NAME ?? null;
            let failed = 0;
            for (const row of currentGroup.rows) {
                if (row.approve_status === "approved")
                    continue; // 이미 승인된 건은 패스
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
            if (failed > 0) {
                alert(`일부(${failed}건)는 승인에 실패했습니다. 콘솔을 확인해주세요.`);
            }
            else {
                alert("해당 주간 출장 건이 모두 승인되었습니다.");
            }
            modal.classList.add("hidden");
            modal.classList.remove("flex");
            getEl("appr_search").click();
        }
        catch (e) {
            console.error(e);
            alert("서버 오류로 승인에 실패했습니다.");
        }
    });
    // ✅ 주간 반려
    btnReject.addEventListener("click", async () => {
        if (!currentGroup)
            return;
        const comment = getEl("appr_comment").value.trim();
        if (!comment) {
            if (!confirm("반려 사유가 없습니다. 그래도 반려하시겠습니까?"))
                return;
        }
        try {
            const approver = window.CURRENT_USER_NAME ?? null;
            let failed = 0;
            for (const row of currentGroup.rows) {
                if (row.approve_status === "rejected")
                    continue; // 이미 반려된 건은 패스
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
            if (failed > 0) {
                alert(`일부(${failed}건)는 반려에 실패했습니다. 콘솔을 확인해주세요.`);
            }
            else {
                alert("해당 주간 출장 건이 모두 반려되었습니다.");
            }
            modal.classList.add("hidden");
            modal.classList.remove("flex");
            getEl("appr_search").click();
        }
        catch (e) {
            console.error(e);
            alert("서버 오류로 반려에 실패했습니다.");
        }
    });
}
/** 🔍 주간 상세 모달 */
function openWeeklyDetailModal(group) {
    currentGroup = group;
    const modal = getEl("appr_modal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    // 첫 번째 행 기준으로 출장지/차량 상단 요약
    const firstRow = group.rows[0];
    const firstReg = (firstRow.detail_json?.register || firstRow.start_data || {});
    const firstSet = (firstRow.detail_json?.settlement || firstRow.end_data || {});
    getEl("appr_d_name").textContent = group.req_name;
    getEl("appr_d_date").textContent = `${formatDateLabel(group.weekStart)} ~ ${formatDateLabel(group.weekEnd)}`;
    // 본문 테이블: 주간 전체 행
    const tbody = getEl("appr_detail_tbody");
    tbody.innerHTML = "";
    // 일자순 정렬
    const sorted = [...group.rows].sort((a, b) => a.trip_date.localeCompare(b.trip_date));
    function td(text, cls = "border px-2 py-1 text-center") {
        const el = document.createElement("td");
        el.className = cls;
        el.textContent = text || "";
        return el;
    }
    const mealText = (m) => {
        if (!m || !m.checked)
            return "-";
        if (m.owner === "corp")
            return "법인";
        if (m.owner === "personal")
            return "개인";
        return "사용";
    };
    for (const row of sorted) {
        const reg = (row.detail_json?.register || row.start_data || {});
        const set = (row.detail_json?.settlement || row.end_data || {});
        const workTime = reg.depart_time && set.work_end_time ? `${reg.depart_time} ~ ${set.work_end_time}` : "";
        const meals = set.meals || {};
        const tr = document.createElement("tr");
        tr.appendChild(td(formatDateLabel(row.trip_date))); // 일자
        tr.appendChild(td(reg.depart_place ?? "")); // 출발지
        tr.appendChild(td(reg.destination ?? "")); // 출장지
        tr.appendChild(td(reg.depart_time ?? "")); // 출발시간
        tr.appendChild(td(reg.arrive_time ?? "")); // 도착시간
        tr.appendChild(td(workTime)); // 업무시간
        tr.appendChild(td(set.return_place ?? "")); // 복귀지
        tr.appendChild(td(set.vehicle === "corp" ? "법인" : set.vehicle === "personal" ? "개인" : "-")); // 차량
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
        const set = (row.detail_json?.settlement || row.end_data || {});
        const c = set.calc || {};
        totalMealsAmount += c.meals_personal_amount ?? 0;
        totalFuelAmount += c.fuel_amount ?? 0;
    }
    const amountBox = getEl("appr_amount_box"); // HTML에 div 하나 만들어두기
    const sum = totalMealsAmount + totalFuelAmount;
    amountBox.textContent = `식대(개인) ${totalMealsAmount.toLocaleString()}원 / 유류비 ${totalFuelAmount.toLocaleString()}원 / 합계 ${sum.toLocaleString()}원`;
    // 승인/반려 상태 요약
    const total = group.rows.length;
    const pending = group.rows.filter((r) => !r.approve_status || r.approve_status === "pending")
        .length;
    const approved = group.rows.filter((r) => r.approve_status === "approved").length;
    const rejected = group.rows.filter((r) => r.approve_status === "rejected").length;
    const footer = getEl("appr_footer_info");
    footer.textContent = `총 ${total}건 / 대기 ${pending}건 / 승인 ${approved}건 / 반려 ${rejected}건`;
    // 의견 초기화
    getEl("appr_comment").value =
        group.rows[0]?.approve_comment ?? "";
}


/***/ }),

/***/ "./TypeScript/workspace/04_user-manage.ts":
/*!************************************************!*\
  !*** ./TypeScript/workspace/04_user-manage.ts ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initUserManagePanel: () => (/* binding */ initUserManagePanel)
/* harmony export */ });
// 04_user-manage.ts
const PERM_KEYS = ["출장승인", "출장내역관리", "출장등록", "출장내역", "사용자관리"];
/** 서버에서 온 row(any 형태)를 InnomaxUser 로 변환 */
function mapRawUser(row) {
    return {
        no: Number(row.no ?? row.No ?? 0),
        id: String(row.id ?? row.ID ?? ""),
        name: String(row.name ?? row.Name ?? ""),
        email: row.email ?? null,
        company_part: row.company_part ?? null,
        // permissions: jsonb / text / null 어떤 형태로 와도 처리
        permissions: (() => {
            let perms = row.permissions ?? null;
            if (!perms)
                return null;
            if (typeof perms === "string") {
                try {
                    perms = JSON.parse(perms);
                }
                catch {
                    return null;
                }
            }
            if (typeof perms === "object" && !Array.isArray(perms)) {
                return perms;
            }
            return null;
        })(),
    };
}
/** 폼의 permission select 값들 → 객체로 모으기 */
function collectPermissionsFromForm() {
    const perms = {};
    PERM_KEYS.forEach((key) => {
        const el = document.getElementById(key);
        if (el)
            perms[key] = el.value;
    });
    return perms;
}
/** 폼 select 들을 주어진 permission 값으로 채우기 */
function fillPermissionSelects(perms) {
    PERM_KEYS.forEach((key) => {
        const el = document.getElementById(key);
        if (!el)
            return;
        const v = perms?.[key];
        if (v)
            el.value = v;
        else
            el.value = "접근 불가"; // 기본값(너가 쓰던 기본값으로 바꿔도 됨)
    });
}
/** 👁 버튼용 비밀번호 표시/숨기기 */
function togglePassword() {
    const input = document.getElementById("modalPassword");
    if (!input)
        return;
    input.type = input.type === "password" ? "text" : "password";
}
// HTML에서 onclick="togglePassword()" 쓸 수 있게 전역에 올리기
window.togglePassword = togglePassword;
function initUserManagePanel(API_BASE) {
    console.log("[사용자관리] initUserManagePanel 시작");
    const tbodyEl = document.getElementById("userTableBody");
    const userModal = document.getElementById("userModal");
    const userForm = document.getElementById("userForm");
    const modalTitle = document.getElementById("modalTitle");
    const modalMode = document.getElementById("modalMode"); // add / edit
    const modalNo = document.getElementById("modalNo");
    const inputName = document.getElementById("modalName");
    const inputID = document.getElementById("modalID");
    const inputPassword = document.getElementById("modalPassword");
    const inputEmail = document.getElementById("modalEmail");
    const inputCompany = document.getElementById("modalCompanyPart");
    const btnAdd = document.getElementById("userAddBtn");
    const btnModalClose = document.getElementById("userModalCancelBtn"); // 모달 안 "취소" 버튼
    // 필수 DOM 없으면 초기화 스킵
    if (!tbodyEl || !userModal || !userForm) {
        console.warn("[사용자관리] 필수 DOM 요소를 찾지 못했습니다. (tbodyEl, userModal, userForm 중 하나 없음)");
        return;
    }
    const tbody = tbodyEl;
    // 이미 초기화된 경우 또 하지 않기 (사이드바 이동 시 중복 방지)
    if (tbody._bound) {
        console.debug("[사용자관리] 이미 초기화된 상태이므로 다시 바인딩하지 않음");
        return;
    }
    tbody._bound = true;
    /** 모달 열기 */
    function openModal(mode, user) {
        if (!userModal || !modalMode || !modalTitle)
            return;
        modalMode.value = mode;
        if (mode === "add") {
            modalTitle.textContent = "사용자 추가";
            if (modalNo)
                modalNo.value = "";
            if (inputID)
                inputID.value = "";
            if (inputName)
                inputName.value = "";
            if (inputPassword)
                inputPassword.value = "";
            if (inputEmail)
                inputEmail.value = "";
            if (inputCompany)
                inputCompany.value = "이노맥스";
            fillPermissionSelects(null);
        }
        else {
            modalTitle.textContent = "사용자 수정";
            if (user && modalNo)
                modalNo.value = String(user.no);
            if (inputID)
                inputID.value = user?.id ?? "";
            if (inputName)
                inputName.value = user?.name ?? "";
            if (inputPassword)
                inputPassword.value = ""; // 수정 시에만 입력
            if (inputEmail)
                inputEmail.value = user?.email ?? "";
            if (inputCompany)
                inputCompany.value = user?.company_part ?? "이노맥스";
            fillPermissionSelects(user?.permissions ?? {});
        }
        userModal.classList.remove("hidden");
    }
    /** 모달 닫기 */
    function closeModal() {
        if (!userModal)
            return;
        userModal.classList.add("hidden");
    }
    // 모달 "취소" 버튼
    btnModalClose?.addEventListener("click", () => {
        closeModal();
    });
    // 상단 "사용자 추가" 버튼
    console.log("[사용자관리] userAddBtn =", btnAdd);
    btnAdd?.addEventListener("click", () => {
        console.log("[사용자관리] 추가 버튼 클릭");
        openModal("add");
    });
    /** 사용자 목록 다시 로딩 */
    async function loadUsers() {
        tbody.innerHTML = `
      <tr>
        <td colspan="8" class="px-3 py-2 text-center text-xs text-gray-400">
          사용자 목록 로딩 중...
        </td>
      </tr>
    `;
        try {
            const res = await fetch(`${API_BASE}/api/users`, {
                credentials: "include",
            });
            if (!res.ok) {
                throw new Error(`status = ${res.status}`);
            }
            const rows = await res.json();
            console.log("[사용자관리] 서버 응답 =", rows);
            const users = Array.isArray(rows)
                ? rows.map(mapRawUser)
                : [];
            if (!users.length) {
                tbody.innerHTML = `
          <tr>
            <td colspan="8" class="px-3 py-2 text-center text-xs text-gray-400">
              등록된 사용자가 없습니다.
            </td>
          </tr>
        `;
                return;
            }
            tbody.innerHTML = "";
            users.forEach((u, idx) => {
                const tr = document.createElement("tr");
                tr.className = "divide-y divide-gray-200 text-xs";
                // 권한 텍스트 만들기
                let permText = "권한없음";
                if (u.permissions) {
                    const parts = Object.entries(u.permissions).map(([k, v]) => `${k}:${v}`);
                    permText = parts.join(", ");
                }
                tr.innerHTML = `
          <td class="px-3 py-2">${idx + 1}</td>
          <td class="px-3 py-2">${u.name}</td>
          <td class="px-3 py-2">${u.id}</td>
          <td class="px-3 py-2">****</td>
          <td class="px-3 py-2">${u.email ?? ""}</td>
          <td class="px-3 py-2">${u.company_part ?? ""}</td>
          <td class="px-3 py-2 text-center">${permText}</td>
          <td class="px-3 py-2 text-center space-x-1">
            <button 
              class="px-2 py-1 rounded bg-indigo-500 text-white text-[11px] btn-edit-user"
              data-no="${u.no}">
              수정
            </button>
            <button 
              class="px-2 py-1 rounded bg-red-500 text-white text-[11px] btn-del-user"
              data-no="${u.no}">
              삭제
            </button>
          </td>
        `;
                tbody.appendChild(tr);
            });
        }
        catch (err) {
            console.error("[사용자관리] 목록 로딩 실패:", err);
            tbody.innerHTML = `
        <tr>
          <td colspan="8" class="px-3 py-2 text-center text-xs text-red-500">
            목록 로딩 중 오류가 발생했습니다.
          </td>
        </tr>
      `;
        }
    }
    /** 테이블에서 수정/삭제 버튼 클릭 처리 (이벤트 위임) */
    tbody.addEventListener("click", async (e) => {
        const target = e.target;
        if (!target)
            return;
        // 수정 버튼
        if (target.classList.contains("btn-edit-user")) {
            const no = target.dataset.no;
            if (!no)
                return;
            try {
                const res = await fetch(`${API_BASE}/api/users/${no}`, {
                    credentials: "include",
                });
                if (!res.ok) {
                    alert("사용자 정보를 불러올 수 없습니다.");
                    return;
                }
                const raw = await res.json();
                const user = mapRawUser(raw);
                openModal("edit", user);
            }
            catch (err) {
                console.error("[사용자관리] 단일 조회 실패:", err);
            }
        }
        // 삭제 버튼
        if (target.classList.contains("btn-del-user")) {
            const no = target.dataset.no;
            if (!no)
                return;
            if (!confirm("정말 이 사용자를 삭제하시겠습니까?"))
                return;
            try {
                const res = await fetch(`${API_BASE}/api/users/${no}`, {
                    method: "DELETE",
                    credentials: "include",
                });
                if (!res.ok) {
                    alert("삭제 실패");
                    return;
                }
                await loadUsers();
            }
            catch (err) {
                console.error("[사용자관리] 삭제 실패:", err);
                alert("삭제 중 오류가 발생했습니다.");
            }
        }
    });
    /** 모달 안의 form submit → 추가 또는 수정 */
    userForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const mode = modalMode?.value === "edit" ? "edit" : "add";
        const no = modalNo?.value;
        const id = inputID?.value.trim() ?? "";
        const name = inputName?.value.trim() ?? "";
        const password = inputPassword?.value.trim() ?? "";
        const email = inputEmail?.value.trim() || null;
        const company_part = inputCompany?.value.trim() || null;
        const permissions = collectPermissionsFromForm();
        if (!id || !name || (mode === "add" && !password)) {
            alert("ID, 이름, 비밀번호(추가 시)는 필수입니다.");
            return;
        }
        try {
            if (mode === "add") {
                const res = await fetch(`${API_BASE}/api/users`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        // 백엔드가 기대하는 필드명
                        Name: name,
                        ID: id,
                        password,
                        email,
                        company_part,
                        permissions,
                    }),
                });
                const json = await res.json();
                if (!res.ok || json.ok === false) {
                    alert(json.error || "사용자 추가 실패");
                    return;
                }
            }
            else {
                if (!no) {
                    alert("수정 대상 사용자를 찾을 수 없습니다.");
                    return;
                }
                const payload = {
                    Name: name,
                    ID: id,
                    email,
                    company_part,
                    permissions,
                };
                if (password)
                    payload.password = password; // 비밀번호 입력했을 때만 변경
                const res = await fetch(`${API_BASE}/api/users/${no}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const json = await res.json();
                if (!res.ok || json.ok === false) {
                    alert(json.error || "사용자 수정 실패");
                    return;
                }
            }
            closeModal();
            await loadUsers();
        }
        catch (err) {
            console.error("[사용자관리] 저장 실패:", err);
            alert("저장 중 오류가 발생했습니다.");
        }
    });
    // 처음 한 번 목록 로딩
    loadUsers();
}


/***/ }),

/***/ "./TypeScript/workspace/05_business-master.ts":
/*!****************************************************!*\
  !*** ./TypeScript/workspace/05_business-master.ts ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initBusinessMasterPanel: () => (/* binding */ initBusinessMasterPanel)
/* harmony export */ });
// 10_business-master.ts
// 🚗 출장업무 관리 (거리 마스터 + 유류/환율/수당 설정) 프론트 코드
// ======================
// 유틸 함수
// ======================
function parseNumberOrNull(value) {
    if (!value)
        return null;
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
}
function mapRawDistance(row) {
    return {
        id: row.id != null ? Number(row.id) : null,
        from_place: String(row.from_place ?? ""),
        to_place: String(row.to_place ?? ""),
        distance_km: row.distance_km != null ? Number(row.distance_km) : null,
        remark: String(row.remark ?? ""),
    };
}
// ======================
// 메인 진입 함수 (export)
// ======================
function initBusinessMasterPanel(API_BASE) {
    console.log("[출장업무관리] initBusinessMasterPanel 시작");
    // 패널 루트 / 주요 DOM 요소들
    const panel = document.getElementById("panel-출장업무-관리");
    const distanceTbodyEl = document.getElementById("distanceTbody");
    const btnConfigSave = document.getElementById("btnConfigSave");
    const btnDistanceAddRow = document.getElementById("btnDistanceAddRow");
    const btnDistanceSave = document.getElementById("btnDistanceSave");
    // 설정 input 요소들
    const inputFuelPrice = document.getElementById("cfgFuelPrice");
    const inputKmPerLiter = document.getElementById("cfgKmPerLiter");
    const inputUsd = document.getElementById("cfgUsd");
    const inputJpy = document.getElementById("cfgJpy");
    const inputCny = document.getElementById("cfgCny");
    const inputDutyWeekday = document.getElementById("cfgDutyWeekday");
    const inputDutyWeekend = document.getElementById("cfgDutyWeekend");
    const selectOilType = document.getElementById("cfgOilType");
    const textareaNote = document.getElementById("cfgNote");
    // 필수 DOM 없으면 초기화 스킵 (다른 페이지에서 불려도 안전)
    if (!panel || !distanceTbodyEl) {
        console.warn("[출장업무관리] 필수 DOM 요소(panel-business-master, distanceTbody)를 찾지 못했습니다.");
        return;
    }
    // ✅ 여기서부터는 distanceTbodyEl 이 null 아님을 확정해서 새 변수에 담음
    const distanceTbody = distanceTbodyEl;
    // 이미 초기화된 경우 다시 초기화하지 않기 (사이드바 이동 시 중복 방지)
    if (panel._bound) {
        console.debug("[출장업무관리] 이미 초기화된 상태이므로 다시 바인딩하지 않음");
        return;
    }
    panel._bound = true;
    console.log("[출장업무관리] DOM 요소들 확인 완료, 이벤트 바인딩 시작");
    // 내부에서 관리할 상태
    let distanceRows = [];
    let deletedIds = [];
    // ======================
    // 설정 조회/표시
    // ======================
    async function loadConfig() {
        try {
            const res = await fetch(`${API_BASE}/api/business-master/config`, {
                credentials: "include",
            });
            if (!res.ok) {
                console.error("[출장업무관리] 설정 조회 실패 status =", res.status);
                return;
            }
            const data = (await res.json());
            console.log("[출장업무관리] 설정 조회 응답:", data);
            if (inputFuelPrice)
                inputFuelPrice.value =
                    data.fuel_price_per_liter?.toString() ?? "";
            if (inputKmPerLiter)
                inputKmPerLiter.value = data.km_per_liter?.toString() ?? "";
            if (inputUsd)
                inputUsd.value = data.exchange_rate_usd?.toString() ?? "";
            if (inputJpy)
                inputJpy.value = data.exchange_rate_jpy?.toString() ?? "";
            if (inputCny)
                inputCny.value = data.exchange_rate_cny?.toString() ?? "";
            if (inputDutyWeekday)
                inputDutyWeekday.value =
                    data.duty_allowance_weekday?.toString() ?? "";
            if (inputDutyWeekend)
                inputDutyWeekend.value =
                    data.duty_allowance_weekend?.toString() ?? "";
            if (selectOilType)
                selectOilType.value = data.default_oil_type || "휘발유";
            if (textareaNote)
                textareaNote.value = data.note || "";
        }
        catch (err) {
            console.error("[출장업무관리] 설정 조회 중 오류:", err);
        }
    }
    async function saveConfig() {
        const body = {
            fuel_price_per_liter: parseNumberOrNull(inputFuelPrice?.value ?? ""),
            km_per_liter: parseNumberOrNull(inputKmPerLiter?.value ?? ""),
            exchange_rate_usd: parseNumberOrNull(inputUsd?.value ?? ""),
            exchange_rate_jpy: parseNumberOrNull(inputJpy?.value ?? ""),
            exchange_rate_cny: parseNumberOrNull(inputCny?.value ?? ""),
            duty_allowance_weekday: parseNumberOrNull(inputDutyWeekday?.value ?? ""),
            duty_allowance_weekend: parseNumberOrNull(inputDutyWeekend?.value ?? ""),
            default_oil_type: selectOilType?.value || "휘발유",
            note: textareaNote?.value ?? "",
        };
        try {
            const res = await fetch(`${API_BASE}/api/business-master/config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                console.error("[출장업무관리] 설정 저장 실패 status =", res.status);
                alert("설정 저장 중 오류가 발생했습니다.");
                return;
            }
            const saved = await res.json();
            console.log("[출장업무관리] 설정 저장 완료:", saved);
            alert("설정이 저장되었습니다.");
        }
        catch (err) {
            console.error("[출장업무관리] 설정 저장 중 오류:", err);
            alert("설정 저장 중 오류가 발생했습니다.");
        }
    }
    // ======================
    // 거리 마스터 조회/표시
    // ======================
    async function loadDistances() {
        distanceTbody.innerHTML = `
      <tr>
        <td colspan="6" class="border px-2 py-2 text-center text-xs text-gray-400">
          거리 목록 로딩 중...
        </td>
      </tr>
    `;
        try {
            const res = await fetch(`${API_BASE}/api/business-master/distances`, {
                credentials: "include",
            });
            if (!res.ok) {
                console.error("[출장업무관리] 거리 목록 조회 실패 status =", res.status);
                return;
            }
            const rows = await res.json();
            console.log("[출장업무관리] 거리 목록 응답:", rows);
            const list = Array.isArray(rows)
                ? rows.map(mapRawDistance)
                : [];
            distanceRows = list;
            deletedIds = [];
            renderDistanceTable();
        }
        catch (err) {
            console.error("[출장업무관리] 거리 목록 조회 중 오류:", err);
        }
    }
    function renderDistanceTable() {
        distanceTbody.innerHTML = "";
        if (!distanceRows.length) {
            distanceTbody.innerHTML = `
        <tr>
          <td colspan="6" class="border px-2 py-2 text-center text-xs text-gray-400">
            등록된 거리 정보가 없습니다. [+ 행 추가] 버튼으로 추가하세요.
          </td>
        </tr>
      `;
            return;
        }
        distanceRows.forEach((row, index) => {
            const tr = document.createElement("tr");
            tr.dataset.index = String(index);
            tr.innerHTML = `
        <td class="border px-2 py-1 text-center">${index + 1}</td>
        <td class="border px-1 py-1">
          <input
            type="text"
            class="w-full border rounded px-1 py-[2px] text-xs from-input"
            value="${row.from_place ?? ""}"
          />
        </td>
        <td class="border px-1 py-1">
          <input
            type="text"
            class="w-full border rounded px-1 py-[2px] text-xs to-input"
            value="${row.to_place ?? ""}"
          />
        </td>
        <td class="border px-1 py-1">
          <input
            type="number"
            step="0.1"
            class="w-full border rounded px-1 py-[2px] text-right text-xs km-input"
            value="${row.distance_km ?? ""}"
          />
        </td>
        <td class="border px-1 py-1">
          <input
            type="text"
            class="w-full border rounded px-1 py-[2px] text-xs remark-input"
            value="${row.remark ?? ""}"
          />
        </td>
        <td class="border px-1 py-1 text-center">
          <button
            type="button"
            class="px-2 py-[2px] text-[11px] rounded bg-red-100 text-red-700 hover:bg-red-200 btn-row-delete"
          >
            삭제
          </button>
        </td>
      `;
            distanceTbody.appendChild(tr);
        });
    }
    /** 테이블 input 값 → distanceRows 배열에 반영 */
    function syncDistanceFromTable() {
        const rows = distanceTbody.querySelectorAll("tr");
        rows.forEach((tr) => {
            const idxStr = tr.dataset.index;
            if (idxStr == null)
                return;
            const idx = Number(idxStr);
            const row = distanceRows[idx];
            if (!row)
                return;
            const fromInput = tr.querySelector(".from-input");
            const toInput = tr.querySelector(".to-input");
            const kmInput = tr.querySelector(".km-input");
            const remarkInput = tr.querySelector(".remark-input");
            row.from_place = fromInput?.value ?? "";
            row.to_place = toInput?.value ?? "";
            row.distance_km = parseNumberOrNull(kmInput?.value ?? "");
            row.remark = remarkInput?.value ?? "";
        });
    }
    async function saveDistances() {
        // 먼저 화면 → 메모리 반영
        syncDistanceFromTable();
        // 필수값 체크
        for (const row of distanceRows) {
            if (!row.from_place || !row.to_place || row.distance_km == null) {
                alert("출발지, 도착지, 거리(km)는 모두 입력해야 합니다.");
                return;
            }
        }
        try {
            // 1) 삭제해야 할 id 삭제
            for (const id of deletedIds) {
                if (!id)
                    continue;
                const res = await fetch(`${API_BASE}/api/business-master/distances/${id}`, {
                    method: "DELETE",
                    credentials: "include",
                });
                if (!res.ok) {
                    console.error("[출장업무관리] 거리 삭제 실패 id =", id, "status =", res.status);
                }
            }
            deletedIds = [];
            // 2) 새 행 / 기존 행 저장
            for (const row of distanceRows) {
                const payload = {
                    from_place: row.from_place,
                    to_place: row.to_place,
                    distance_km: row.distance_km,
                    remark: row.remark,
                };
                if (row.id == null) {
                    // INSERT
                    const res = await fetch(`${API_BASE}/api/business-master/distances`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });
                    if (!res.ok) {
                        console.error("[출장업무관리] 거리 등록 실패 status =", res.status);
                    }
                }
                else {
                    // UPDATE
                    const res = await fetch(`${API_BASE}/api/business-master/distances/${row.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });
                    if (!res.ok) {
                        console.error("[출장업무관리] 거리 수정 실패 id =", row.id, "status =", res.status);
                    }
                }
            }
            alert("거리 마스터가 저장되었습니다.");
            await loadDistances();
        }
        catch (err) {
            console.error("[출장업무관리] 거리 저장 중 오류:", err);
            alert("거리 저장 중 오류가 발생했습니다.");
        }
    }
    function addEmptyRow() {
        distanceRows.push({
            id: null,
            from_place: "",
            to_place: "",
            distance_km: null,
            remark: "",
        });
        renderDistanceTable();
    }
    // ======================
    // 이벤트 바인딩
    // ======================
    btnConfigSave?.addEventListener("click", () => {
        console.log("[출장업무관리] 설정 저장 버튼 클릭");
        saveConfig();
    });
    btnDistanceAddRow?.addEventListener("click", () => {
        console.log("[출장업무관리] 거리 행 추가 버튼 클릭");
        addEmptyRow();
    });
    btnDistanceSave?.addEventListener("click", () => {
        console.log("[출장업무관리] 거리 저장 버튼 클릭");
        saveDistances();
    });
    // 테이블 내 삭제 버튼 (이벤트 위임)
    distanceTbody.addEventListener("click", (e) => {
        const target = e.target;
        if (!target)
            return;
        if (!target.classList.contains("btn-row-delete"))
            return;
        const tr = target.closest("tr");
        if (!tr)
            return;
        const idxStr = tr.dataset.index;
        if (idxStr == null)
            return;
        const idx = Number(idxStr);
        const row = distanceRows[idx];
        if (!row)
            return;
        if (row.id != null) {
            deletedIds.push(row.id);
        }
        distanceRows.splice(idx, 1);
        renderDistanceTable();
    });
    // ======================
    // 초기 데이터 로딩
    // ======================
    loadConfig();
    loadDistances();
}


/***/ }),

/***/ "./TypeScript/workspace/08_domestic-trip-register.ts":
/*!***********************************************************!*\
  !*** ./TypeScript/workspace/08_domestic-trip-register.ts ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initDomesticTripRegisterPanel: () => (/* binding */ initDomesticTripRegisterPanel)
/* harmony export */ });
/* harmony import */ var _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils/ModalUtil */ "./TypeScript/workspace/utils/ModalUtil.ts");
// TypeScript/workspace/08_domestic-trip-register.ts

function getEl(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`❌ element not found: #${id}`);
    return el;
}
function initDomesticTripRegisterPanel(API_BASE) {
    const panel = document.getElementById("panel-국내출장-출장등록");
    if (!panel)
        return;
    const saveBtn = getEl("reg_save");
    // 이미 바인딩 되었으면 재바인딩 방지
    if (saveBtn._bound)
        return;
    saveBtn._bound = true;
    const resetBtn = getEl("reg_reset");
    const resultBox = getEl("reg_result");
    // 🔹 이어작성 버튼
    const continueBtn = document.getElementById("reg_continue");
    // 🔹 같은 패널 안의 정산 작성 섹션 (숨겼다가 펼칠 영역)
    const settlementSection = document.getElementById("bt_settlement_section");
    const userNameEl = document.getElementById("userName");
    const reqNameInput = getEl("bt_req_name");
    const departPlaceInput = getEl("bt_place");
    const destinationInput = getEl("bt_destination");
    const startInput = getEl("bt_start");
    const departTimeInput = getEl("bt_depart_time");
    const arriveTimeInput = getEl("bt_arrive_time");
    const purposeInput = getEl("bt_purpose");
    // 요청자 자동 채우기
    reqNameInput.value = (userNameEl?.textContent ?? "").trim() || "사용자";
    // 초기: 이어작성 버튼/정산섹션 숨김
    if (continueBtn)
        continueBtn.classList.add("hidden");
    if (settlementSection)
        settlementSection.classList.add("hidden");
    // 🔹 폼 리셋
    resetBtn.addEventListener("click", () => {
        departPlaceInput.value = "";
        destinationInput.value = "";
        startInput.value = "";
        departTimeInput.value = "";
        arriveTimeInput.value = "";
        purposeInput.value = "";
        resultBox.textContent = "";
        // 리셋 시 이어작성 버튼/정산영역 숨기기
        if (continueBtn)
            continueBtn.classList.add("hidden");
        if (settlementSection)
            settlementSection.classList.add("hidden");
    });
    // 🔹 출장 등록
    saveBtn.addEventListener("click", async () => {
        const payload = {
            trip_type: "domestic",
            req_name: reqNameInput.value.trim(),
            depart_place: departPlaceInput.value.trim(),
            destination: destinationInput.value.trim(),
            start_date: startInput.value,
            depart_time: departTimeInput.value,
            arrive_time: arriveTimeInput.value,
            purpose: purposeInput.value.trim(),
        };
        console.log("[REGISTER] payload =", payload);
        // 필수값 체크 (이제 work_start_time 없음)
        if (!payload.req_name ||
            !payload.depart_place ||
            !payload.destination ||
            !payload.start_date ||
            !payload.depart_time ||
            !payload.arrive_time ||
            !payload.purpose) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "모든 항목은 필수입니다.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        try {
            saveBtn.disabled = true;
            resultBox.textContent = "서버에 저장 중...";
            const res = await fetch(`${API_BASE}/api/business-trip/domestic`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const text = await res.text();
                console.error("출장등록 실패 응답:", res.status, text);
                resultBox.textContent = `❌ 서버 저장 실패: HTTP ${res.status}`;
                await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                    type: "alert",
                    title: "저장 실패",
                    message: `서버 저장에 실패했습니다.\n(HTTP ${res.status})`,
                    showOk: true,
                    showCancel: false,
                });
                if (continueBtn)
                    continueBtn.classList.add("hidden");
                if (settlementSection)
                    settlementSection.classList.add("hidden");
                return;
            }
            const data = await res.json().catch(() => null);
            console.log("출장등록 성공 응답:", data);
            // 정산 화면에서 참고할 초안 저장
            localStorage.setItem("domesticTripDraft", JSON.stringify(payload));
            resultBox.textContent = "✅ 출장 등록 완료 (서버 저장 완료)";
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "저장 완료",
                message: "출장 등록 내용이 서버에 저장되었습니다.\n[이어 정산 작성] 버튼을 눌러 정산을 작성하세요.",
                showOk: true,
                showCancel: false,
            });
            if (continueBtn)
                continueBtn.classList.remove("hidden");
            if (settlementSection) {
                settlementSection.classList.add("hidden");
            }
            localStorage.setItem("settleTargetDate", payload.start_date);
            localStorage.setItem("settleTargetReqName", payload.req_name);
            window.dispatchEvent(new Event("trip-status-refresh"));
        }
        catch (err) {
            console.error("출장등록 중 오류:", err);
            resultBox.textContent = `❌ 저장 실패: ${err?.message ?? "알 수 없는 오류"}`;
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "저장 실패",
                message: resultBox.textContent,
                showOk: true,
                showCancel: false,
            });
            window.dispatchEvent(new Event("trip-status-refresh"));
            if (continueBtn)
                continueBtn.classList.add("hidden");
            if (settlementSection)
                settlementSection.classList.add("hidden");
        }
        finally {
            saveBtn.disabled = false;
        }
    });
    // 🔹 이어작성 버튼 클릭 → 정산 섹션 펼치기
    continueBtn?.addEventListener("click", () => {
        const date = startInput.value;
        const name = reqNameInput.value.trim();
        if (date)
            localStorage.setItem("settleTargetDate", date);
        if (name)
            localStorage.setItem("settleTargetReqName", name);
        if (settlementSection) {
            settlementSection.classList.remove("hidden");
            settlementSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        resultBox.textContent = "✏️ 이 출장건에 대한 정산 정보를 아래에서 이어서 작성하세요.";
    });
}


/***/ }),

/***/ "./TypeScript/workspace/09_domestic-trip-settlement.ts":
/*!*************************************************************!*\
  !*** ./TypeScript/workspace/09_domestic-trip-settlement.ts ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initDomesticTripSettlementPanel: () => (/* binding */ initDomesticTripSettlementPanel)
/* harmony export */ });
/* harmony import */ var _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils/ModalUtil */ "./TypeScript/workspace/utils/ModalUtil.ts");
// TypeScript/workspace/09_domestic-trip-settlement.ts

function getEl(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`❌ element not found: #${id}`);
    return el;
}
function getCheckedRadioValue(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked?.value ?? "";
}
/**
 * 국내출장 정산 입력 패널 초기화
 * - 00_workspace.ts 에서 initDomesticTripSettlementPanel(API_BASE)로 한 번만 호출
 */
function initDomesticTripSettlementPanel(API_BASE) {
    console.log("[정산] initDomesticTripSettlementPanel 호출");
    const section = document.getElementById("bt_settlement_section");
    if (!section) {
        console.warn("[정산] #bt_settlement_section 요소를 찾을 수 없습니다. HTML 구조를 확인하세요.");
        return;
    }
    const saveBtn = getEl("bt_save");
    // 중복 바인딩 방지
    if (saveBtn._bound) {
        console.log("[정산] 이미 바인딩된 상태이므로 다시 바인딩하지 않음");
        return;
    }
    saveBtn._bound = true;
    const resetBtn = getEl("bt_reset");
    const resultBox = getEl("bt_result");
    const workEndInput = getEl("bt_work_end_time");
    const returnTimeInput = getEl("bt_return_time");
    const returnPlaceInput = getEl("bt_return_place");
    const mealBreakfastCheck = getEl("bt_meal_breakfast");
    const mealLunchCheck = getEl("bt_meal_lunch");
    const mealDinnerCheck = getEl("bt_meal_dinner");
    const mealBreakfastOwner = getEl("bt_meal_breakfast_owner");
    const mealLunchOwner = getEl("bt_meal_lunch_owner");
    const mealDinnerOwner = getEl("bt_meal_dinner_owner");
    // 🔹 08_domestic-trip-register.ts 에서 저장해 둔 값 사용
    const baseDate = localStorage.getItem("settleTargetDate") ?? "";
    const baseReqName = localStorage.getItem("settleTargetReqName") ?? "";
    console.log("[정산] baseDate =", baseDate, "baseReqName =", baseReqName);
    // 🔹 리셋 버튼
    resetBtn.addEventListener("click", () => {
        workEndInput.value = "";
        returnTimeInput.value = "";
        returnPlaceInput.value = "";
        mealBreakfastCheck.checked = false;
        mealLunchCheck.checked = false;
        mealDinnerCheck.checked = false;
        mealBreakfastOwner.value = "";
        mealLunchOwner.value = "";
        mealDinnerOwner.value = "";
        resultBox.textContent = "정산 입력값이 초기화되었습니다.";
    });
    // 🔹 정산 저장 버튼
    saveBtn.addEventListener("click", async () => {
        console.log("[정산] 저장 버튼 클릭");
        const vehicleValue = getCheckedRadioValue("bt_vehicle");
        // 🚨 출발일/이름이 비어 있으면 어떤 건지 모름
        const trip_date = localStorage.getItem("settleTargetDate") ?? "";
        const req_name = localStorage.getItem("settleTargetReqName") ?? "";
        if (!trip_date || !req_name) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "정산 대상 없음",
                message: "어떤 출장건에 대한 정산인지 정보가 없습니다.\n먼저 [출장등록]에서 저장 후 [이어 정산 작성]으로 들어와 주세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        // 필수값 체크
        if (!workEndInput.value) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "업무 종료시간을 입력해주세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        if (!returnTimeInput.value) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "복귀시간을 입력해주세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        if (!returnPlaceInput.value.trim()) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "복귀지(회사/자택)를 입력해주세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        if (!vehicleValue) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "차량(정산용)을 선택해주세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        const settlement = {
            work_end_time: workEndInput.value,
            return_time: returnTimeInput.value,
            return_place: returnPlaceInput.value.trim(),
            vehicle: vehicleValue,
            meals: {
                breakfast: {
                    checked: mealBreakfastCheck.checked,
                    owner: mealBreakfastOwner.value,
                },
                lunch: {
                    checked: mealLunchCheck.checked,
                    owner: mealLunchOwner.value,
                },
                dinner: {
                    checked: mealDinnerCheck.checked,
                    owner: mealDinnerOwner.value,
                },
            },
        };
        // 🧠 백엔드 /settlement 는 req_name, trip_date, detail_json 전체를 받는다.
        // detail_json 안에 settlement 를 넣어서 보내야 함.
        const detail_json = {
            settlement,
        };
        try {
            saveBtn.disabled = true;
            resultBox.textContent = "정산 내용 저장 중...";
            const res = await fetch(`${API_BASE}/api/business-trip/settlement`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    req_name,
                    trip_date,
                    detail_json, // ✅ 백엔드가 기대하는 구조
                }),
            });
            console.log("[정산] 응답 status =", res.status);
            if (!res.ok) {
                const text = await res.text();
                resultBox.textContent = `❌ 정산 저장 실패: HTTP ${res.status} ${text}`;
                await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                    type: "alert",
                    title: "정산 저장 실패",
                    message: resultBox.textContent,
                    showOk: true,
                    showCancel: false,
                });
                return;
            }
            const data = await res.json().catch(() => null);
            console.log("[정산] 응답 data =", data);
            resultBox.textContent = "✅ 정산 정보가 저장되었습니다.";
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "정산 완료",
                message: "정산 정보가 성공적으로 저장되었습니다.",
                showOk: true,
                showCancel: false,
            });
            // 필요하면 초기화
            // resetBtn.click();
            // 대시보드/출장 현황 새로고침용
            window.dispatchEvent(new Event("trip-status-refresh"));
        }
        catch (err) {
            console.error("[정산] 저장 중 오류:", err);
            resultBox.textContent = `❌ 정산 저장 중 오류: ${err?.message ?? "알 수 없는 오류"}`;
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "정산 저장 오류",
                message: resultBox.textContent,
                showOk: true,
                showCancel: false,
            });
        }
        finally {
            saveBtn.disabled = false;
        }
    });
}


/***/ }),

/***/ "./TypeScript/workspace/10_domestic-trip-history.ts":
/*!**********************************************************!*\
  !*** ./TypeScript/workspace/10_domestic-trip-history.ts ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initDomesticTripHistoryPanel: () => (/* binding */ initDomesticTripHistoryPanel)
/* harmony export */ });
// TypeScript/workspace/10_domestic-trip-history.ts
function getEl(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`element not found: #${id}`);
    return el;
}
function formatYmd(isoDate) {
    const d = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
    if (Number.isNaN(d.getTime()))
        return "-";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
// 🌟 정산 내역 보기 패널 초기화
function initDomesticTripHistoryPanel(API_BASE) {
    const panel = document.getElementById("panel-국내출장-정산서등록");
    if (!panel)
        return;
    const searchBtn = getEl("settle_search");
    // 중복 바인딩 방지
    if (searchBtn._bound)
        return;
    searchBtn._bound = true;
    const fromInput = getEl("settle_from");
    const toInput = getEl("settle_to");
    const resultMsg = getEl("settle_result_msg");
    const tbody = getEl("settle_result_tbody");
    // 기본 날짜: 오늘
    if (!fromInput.value || !toInput.value) {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        const todayStr = `${y}-${m}-${d}`;
        fromInput.value = todayStr;
        toInput.value = todayStr;
    }
    // ✅ localStorage.user 에서 로그인한 사람의 name 가져오기
    function getLoginUserName() {
        try {
            const stored = localStorage.getItem("user");
            if (!stored)
                return null;
            const user = JSON.parse(stored);
            return user?.name ?? null;
        }
        catch {
            return null;
        }
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
        // ✅ 항상 로그인한 사람 이름으로만 조회
        const reqNameParam = getLoginUserName();
        if (!reqNameParam) {
            resultMsg.textContent = "로그인 정보에서 사용자 이름을 찾을 수 없습니다.";
            tbody.innerHTML = `
        <tr>
          <td colspan="7" class="border px-2 py-3 text-center text-rose-500">
            로그인 정보가 없어 정산 내역을 조회할 수 없습니다.
          </td>
        </tr>
      `;
            return;
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
        qs.set("req_name", reqNameParam); // 👈 항상 로그인 사용자 이름
        try {
            const res = await fetch(`${API_BASE}/api/business-trip/settlements-range?${qs.toString()}`, { method: "GET" });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`HTTP ${res.status} / ${text}`);
            }
            const json = await res.json();
            const rows = json?.data ?? [];
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
                const mealStrs = [];
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
        }
        catch (err) {
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


/***/ }),

/***/ "./TypeScript/workspace/utils/ModalUtil.ts":
/*!*************************************************!*\
  !*** ./TypeScript/workspace/utils/ModalUtil.ts ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ModalUtil: () => (/* binding */ ModalUtil)
/* harmony export */ });
const ModalUtil = {
    el: null,
    ensureElement() {
        if (this.el)
            return this.el;
        const div = document.createElement("div");
        div.id = "globalSimpleModal";
        div.className =
            "hidden fixed inset-0 z-[9999] flex items-center justify-center bg-black/50";
        div.innerHTML = `
      <div id="modalBox" class="bg-white w-[360px] rounded-2xl p-6 shadow-xl text-center">
        <div id="modalIcon" class="text-5xl mb-4 select-none"></div>
        <h2 id="modalTitle" class="text-xl font-bold mb-2"></h2>
        <p id="modalMessage" class="text-sm text-gray-700 mb-6"></p>
        <div id="modalBtns" class="flex justify-center gap-2">
          <button id="modalCancelBtn"
            class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 hidden">취소</button>
          <button id="modalOkBtn"
            class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 hidden">확인</button>
        </div>
      </div>
    `;
        document.body.appendChild(div);
        this.el = div;
        return div;
    },
    setStyle(type) {
        const el = this.ensureElement();
        const iconEl = el.querySelector("#modalIcon");
        const titleEl = el.querySelector("#modalTitle");
        if (type === "alert") {
            iconEl.textContent = "ℹ️";
            iconEl.className = "text-5xl text-blue-600 mb-4";
            titleEl.className = "text-xl font-bold mb-2 text-blue-700";
        }
        else {
            iconEl.textContent = "⚠️";
            iconEl.className = "text-5xl text-yellow-500 mb-4";
            titleEl.className = "text-xl font-bold mb-2 text-yellow-700";
        }
    },
    /**
     * ✨ 단일 모달 호출
     * - alert → 아무 값 없음
     * - warn → boolean 반환
     */
    async show({ type = "alert", title = "알림", message = "", showOk = true, showCancel = false, }) {
        const el = this.ensureElement();
        const titleEl = el.querySelector("#modalTitle");
        const msgEl = el.querySelector("#modalMessage");
        const okBtn = el.querySelector("#modalOkBtn");
        const cancelBtn = el.querySelector("#modalCancelBtn");
        // 스타일
        this.setStyle(type);
        // 내용
        titleEl.textContent = title;
        msgEl.textContent = message;
        // 버튼 표시 여부
        okBtn.classList.toggle("hidden", !showOk);
        cancelBtn.classList.toggle("hidden", !showCancel);
        // 표시
        el.classList.remove("hidden");
        // -----------------------
        // alert 모달은 확인만 필요
        // -----------------------
        if (type === "alert") {
            return new Promise((resolve) => {
                const close = () => {
                    this.hide();
                    okBtn.removeEventListener("click", close);
                    resolve();
                };
                okBtn.addEventListener("click", close);
            });
        }
        // -----------------------
        // warn 모달은 확인/취소 필요
        // -----------------------
        return new Promise((resolve) => {
            const onOk = () => {
                cleanup();
                this.hide();
                resolve(true);
            };
            const onCancel = () => {
                cleanup();
                this.hide();
                resolve(false);
            };
            const cleanup = () => {
                okBtn.removeEventListener("click", onOk);
                cancelBtn.removeEventListener("click", onCancel);
            };
            okBtn.addEventListener("click", onOk);
            cancelBtn.addEventListener("click", onCancel);
        });
    },
    hide() {
        const el = this.ensureElement();
        el.classList.add("hidden");
    },
};


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!**********************************************!*\
  !*** ./TypeScript/workspace/00_workspace.ts ***!
  \**********************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _01_dashboard_trip_status__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./01_dashboard-trip-status */ "./TypeScript/workspace/01_dashboard-trip-status.ts");
/* harmony import */ var _02_trip_approval__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./02_trip-approval */ "./TypeScript/workspace/02_trip-approval.ts");
/* harmony import */ var _04_user_manage__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./04_user-manage */ "./TypeScript/workspace/04_user-manage.ts");
/* harmony import */ var _05_business_master__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./05_business-master */ "./TypeScript/workspace/05_business-master.ts");
/* harmony import */ var _08_domestic_trip_register__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./08_domestic-trip-register */ "./TypeScript/workspace/08_domestic-trip-register.ts");
/* harmony import */ var _09_domestic_trip_settlement__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./09_domestic-trip-settlement */ "./TypeScript/workspace/09_domestic-trip-settlement.ts");
/* harmony import */ var _10_domestic_trip_history__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./10_domestic-trip-history */ "./TypeScript/workspace/10_domestic-trip-history.ts");
// TypeScript/workspace/00_workspace.ts







const API_BASE = location.hostname === "gwoun01.github.io"
    ? "https://outwork.sel3.cloudtype.app"
    : "http://127.0.0.1:5050";
// ✅ 로그인할 때 login.ts에서 넣어둔 값 사용
//   localStorage.setItem("loginUserId", data.id);
function getLoginUserId() {
    const id = localStorage.getItem("loginUserId");
    return id || "사용자"; // 없으면 기본 텍스트
}
/** localStorage.user 에서 전체 로그인 유저 정보 가져오기 */
function getLoginUser() {
    const raw = localStorage.getItem("user");
    if (!raw)
        return null;
    try {
        const obj = JSON.parse(raw);
        return {
            id: obj.id ?? "",
            name: obj.name ?? "",
            permissions: obj.permissions ?? null,
        };
    }
    catch {
        return null;
    }
}
/** permissions 객체에서 해당 키의 권한값 가져오기 (없으면 "NoAccess") */
function getPermValue(perms, key) {
    if (!perms)
        return "NoAccess";
    const v = perms[key];
    if (!v)
        return "NoAccess";
    return v;
}
/**
 * 패널 전환(사이드 메뉴 → 메인 패널, 제목 바꾸기)
 */
function initLocalTabNavigation() {
    const navButtons = document.querySelectorAll(".nav-btn");
    const panels = document.querySelectorAll('[id^="panel-"]');
    const titleEl = document.getElementById("wsTitle");
    function showPanel(id) {
        // 모든 패널 숨기고
        panels.forEach((p) => p.classList.add("hidden"));
        // 대상 패널만 보이기
        const target = document.getElementById(id);
        if (target)
            target.classList.remove("hidden");
        // 사이드 버튼 스타일 토글
        navButtons.forEach((btn) => {
            const active = btn.dataset.panel === id;
            btn.classList.toggle("bg-[#7ce92f]", active);
            btn.classList.toggle("text-[#000000]", active);
            btn.classList.toggle("font-bold", active);
        });
        // 상단 제목 변경
        const curBtn = document.querySelector(`.nav-btn[data-panel="${id}"]`);
        if (curBtn && titleEl) {
            titleEl.textContent = curBtn.textContent?.trim() ?? "";
        }
    }
    // 기본은 대시보드
    showPanel("panel-dashboard");
    return showPanel;
}
// ==============================================================
// 🔵 메인 초기화
// ==============================================================
document.addEventListener("DOMContentLoaded", async () => {
    console.debug("[INIT] workspace DOMContentLoaded");
    // 0) 로그인 유저 / 권한 정보 가져오기
    const loginUser = getLoginUser();
    const perms = loginUser?.permissions ?? null;
    const hasPermInfo = !!perms && Object.keys(perms).length > 0;
    // 기본값: 권한 정보가 아예 없으면(옛날 데이터) 일단 전부 허용
    let canAdmin = true;
    let canTripRegister = true;
    let canTripHistory = true;
    if (hasPermInfo) {
        const tripApprove = getPermValue(perms, "출장승인");
        const tripManage = getPermValue(perms, "출장내역관리");
        const tripRegister = getPermValue(perms, "출장등록");
        const tripHistory = getPermValue(perms, "출장내역");
        const userManage = getPermValue(perms, "사용자관리");
        // ✅ 관리자 전용: 출장승인 또는 출장내역관리 중 하나라도 NoAccess 가 아니면 관리자
        canAdmin =
            tripApprove !== "NoAccess" || tripManage !== "NoAccess";
        // ✅ 국내출장 → 출장등록
        canTripRegister = tripRegister !== "NoAccess";
        // ✅ 국내출장 → 출장내역
        canTripHistory = tripHistory !== "NoAccess";
    }
    // 1) 로그인한 아이디 헤더에 표시 + 아바타 텍스트
    const userId = getLoginUserId(); // 예) "권택선"
    const userNameEl = document.getElementById("userName");
    const avatarEl = document.getElementById("avatar");
    const logoutBtn = document.getElementById("logoutBtn");
    if (userNameEl) {
        // 이름이 따로 있으면 이름, 없으면 아이디
        const displayName = loginUser?.name || userId;
        userNameEl.textContent = displayName;
    }
    if (avatarEl) {
        const base = loginUser?.name || userId;
        avatarEl.textContent = base.slice(0, 2); // 앞 2글자 정도만 동그라미 안에
    }
    // 2) 로그아웃 버튼
    logoutBtn?.addEventListener("click", async () => {
        try {
            // 세션 쿠키 정리용 (백엔드에 /api/logout 있으면 사용, 없으면 그냥 넘어감)
            await fetch(`${API_BASE}/api/logout`, {
                method: "POST",
                credentials: "include",
            }).catch(() => { });
        }
        finally {
            // 로컬 저장된 로그인 정보 삭제
            localStorage.removeItem("loginUserId");
            localStorage.removeItem("loginUserName");
            localStorage.removeItem("user");
            sessionStorage.clear();
            // 로그인 페이지로 이동 (파일 이름에 맞게 수정)
            window.location.href = "index.html";
        }
    });
    // 3) 패널 네비게이션 세팅
    const showPanel = initLocalTabNavigation();
    // 4) 대시보드(출장자 현황 + KPI) 초기화 → 서버와 연결
    (0,_01_dashboard_trip_status__WEBPACK_IMPORTED_MODULE_0__.initDashboardTripStatus)(API_BASE);
    // 5) 사이드바에서 패널 이동
    const sidebarButtons = document.querySelectorAll("#sidebar [data-panel]");
    // 🔒 관리자 전용 그룹 자체를 숨기기 (버튼/내용 둘 다)
    if (!canAdmin && hasPermInfo) {
        const adminBtn = document.getElementById("btnAdminGroup");
        const adminContent = document.getElementById("adminGroupContent");
        adminBtn?.classList.add("hidden");
        adminContent?.classList.add("hidden");
    }
    sidebarButtons.forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.panel;
            if (!id)
                return;
            // ==========================
            // 🔒 권한 체크
            // ==========================
            if (hasPermInfo) {
                // 1) 관리자 전용 패널들
                if (id === "panel-출장승인" ||
                    id === "panel-출장내역-관리" ||
                    id === "panel-사용자-관리") {
                    if (!canAdmin) {
                        alert("관리자 권한이 필요합니다.");
                        return;
                    }
                }
                // 2) 국내출장 - 출장등록
                if (id === "panel-국내출장-출장등록" && !canTripRegister) {
                    alert("출장등록 권한이 없습니다.");
                    return;
                }
                // 3) 국내출장 - 출장내역(정산 내역)
                if (id === "panel-국내출장-정산서등록" && !canTripHistory) {
                    alert("출장내역 조회 권한이 없습니다.");
                    return;
                }
            }
            // ==========================
            // 🔁 패널 전환 + 초기화
            // ==========================
            showPanel(id);
            // 대시보드 탭 클릭 → 항상 최신 데이터로 새로고침
            if (id === "panel-dashboard") {
                window.dispatchEvent(new Event("trip-status-refresh"));
            }
            // 사용자 관리 탭 (관리자 전용)
            if (id === "panel-사용자-관리") {
                await (0,_04_user_manage__WEBPACK_IMPORTED_MODULE_2__.initUserManagePanel)(API_BASE);
                console.log("[INIT] 사용자-관리 init 완료");
            }
            // 관리자 전용 - 출장 승인
            if (id === "panel-출장승인") {
                await (0,_02_trip_approval__WEBPACK_IMPORTED_MODULE_1__.initTripApprovalPanel)(API_BASE);
                console.log("[INIT] 출장승인 패널 init 완료");
            }
            // 관리자 전용 - 출장업무 관리
            if (id === "panel-출장업무-관리") {
                await (0,_05_business_master__WEBPACK_IMPORTED_MODULE_3__.initBusinessMasterPanel)(API_BASE);
                console.log("[INIT] 출장업무관리 패널 init 완료");
            }
            // 국내출장 - 출장등록 패널 → 등록 + 정산 패널 초기화
            if (id === "panel-국내출장-출장등록") {
                await (0,_08_domestic_trip_register__WEBPACK_IMPORTED_MODULE_4__.initDomesticTripRegisterPanel)(API_BASE);
                await (0,_09_domestic_trip_settlement__WEBPACK_IMPORTED_MODULE_5__.initDomesticTripSettlementPanel)(API_BASE);
                console.log("[INIT] 국내출장-출장등록 & 정산 패널 init 완료");
            }
            // 국내출장 - 출장내역(정산 내역 조회)
            if (id === "panel-국내출장-정산서등록") {
                await (0,_10_domestic_trip_history__WEBPACK_IMPORTED_MODULE_6__.initDomesticTripHistoryPanel)(API_BASE);
                console.log("[INIT] 국내출장-정산 내역 조회 패널 init 완료");
            }
        });
    });
    // 6) 처음 진입: 대시보드 패널 + 오늘 데이터 로딩
    showPanel("panel-dashboard");
    window.dispatchEvent(new Event("trip-status-refresh"));
    console.debug("[INIT] workspace 초기화 완료");
});

})();

/******/ })()
;
//# sourceMappingURL=workspace.bundle.js.map