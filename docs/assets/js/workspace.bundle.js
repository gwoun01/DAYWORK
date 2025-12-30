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
const PERM_KEYS = ["출장승인", "출장내역관리", "출장등록", "출장내역"];
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
            el.value = "ReadWrite"; // 기본값
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
                        // ⚠️ 백엔드가 아직 Name/ID를 기대할 수 있어서 그대로 유지
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
/* harmony import */ var _04_user_manage__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./04_user-manage */ "./TypeScript/workspace/04_user-manage.ts");
/* harmony import */ var _08_domestic_trip_register__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./08_domestic-trip-register */ "./TypeScript/workspace/08_domestic-trip-register.ts");
/* harmony import */ var _09_domestic_trip_settlement__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./09_domestic-trip-settlement */ "./TypeScript/workspace/09_domestic-trip-settlement.ts");
/* harmony import */ var _10_domestic_trip_history__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./10_domestic-trip-history */ "./TypeScript/workspace/10_domestic-trip-history.ts");
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
/** localStorage 에서 로그인 유저 전체 정보 가져오기 */
function getLoginUser() {
    const raw = localStorage.getItem("user");
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
/** 현재 로그인 유저의 권한 맵만 뽑기 */
function getUserPermissions() {
    const user = getLoginUser();
    return user?.permissions ?? {};
}
/** 패널 ID → permissions 키 매핑 */
const PANEL_PERM_MAP = {
    "panel-출장승인": "출장승인",
    "panel-출장내역-관리": "출장내역관리",
    "panel-국내출장-출장등록": "출장등록",
    "panel-국내출장-정산서등록": "출장내역",
    // 👉 대시보드, 사용자 관리 등은 여기 안 넣으면 권한 체크 안 함 (모두 접근 가능)
};
/** 이 패널에 들어갈 수 있는지? (localStorage.permissions 기준) */
function canAccessPanel(panelId) {
    const permKey = PANEL_PERM_MAP[panelId];
    // 매핑 안 되어 있으면(대시보드, 사용자관리 등) 권한 체크 없이 통과
    if (!permKey)
        return true;
    const perms = getUserPermissions();
    const value = perms[permKey]; // "ReadWrite" | "ReadOnly" | "NoAccess" | undefined
    // 값이 없거나 NoAccess 면 막기
    if (!value || value === "NoAccess") {
        return false;
    }
    // ReadOnly / ReadWrite → 화면 들어가는 건 허용
    return true;
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
    // 1) 로그인한 아이디 헤더에 표시 + 아바타 텍스트
    const userId = getLoginUserId(); // 예) "권택선"
    const userNameEl = document.getElementById("userName");
    const avatarEl = document.getElementById("avatar");
    const logoutBtn = document.getElementById("logoutBtn");
    if (userNameEl) {
        userNameEl.textContent = userId; // 🔹 헤더에 "사용자" 대신 아이디
    }
    if (avatarEl) {
        avatarEl.textContent = userId.slice(0, 2); // 앞 2글자 정도만 동그라미 안에
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
    sidebarButtons.forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.panel;
            if (!id)
                return;
            // ✅  먼저 권한 체크
            if (!canAccessPanel(id)) {
                alert("이 메뉴에 대한 접근 권한이 없습니다.");
                return;
            }
            // ✅ 권한 OK → 패널 전환
            showPanel(id);
            // 대시보드 탭 클릭 → 항상 최신 데이터로 새로고침
            if (id === "panel-dashboard") {
                window.dispatchEvent(new Event("trip-status-refresh"));
            }
            // 사용자 관리 탭
            if (id === "panel-사용자-관리") {
                await (0,_04_user_manage__WEBPACK_IMPORTED_MODULE_1__.initUserManagePanel)(API_BASE);
                console.log("[INIT] 사용자-관리 init 완료");
            }
            // 국내출장 - 출장등록 패널 → 등록 + 정산 패널 초기화
            if (id === "panel-국내출장-출장등록") {
                await (0,_08_domestic_trip_register__WEBPACK_IMPORTED_MODULE_2__.initDomesticTripRegisterPanel)(API_BASE);
                await (0,_09_domestic_trip_settlement__WEBPACK_IMPORTED_MODULE_3__.initDomesticTripSettlementPanel)(API_BASE);
                console.log("[INIT] 국내출장-출장등록 & 정산 패널 init 완료");
            }
            // 국내출장 - 출장내역(정산 내역 조회)
            if (id === "panel-국내출장-정산서등록") {
                await (0,_10_domestic_trip_history__WEBPACK_IMPORTED_MODULE_4__.initDomesticTripHistoryPanel)(API_BASE);
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