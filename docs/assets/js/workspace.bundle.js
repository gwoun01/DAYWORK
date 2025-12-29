/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

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
            // localStorage 갱신 (대시보드용)
            try {
                const listKey = "businessTripList";
                const raw = localStorage.getItem(listKey);
                let list = [];
                if (raw) {
                    list = JSON.parse(raw);
                }
                const item = {
                    ...payload,
                    id: Date.now(),
                    status: "예정",
                    created_at: new Date().toISOString(),
                };
                list.push(item);
                localStorage.setItem(listKey, JSON.stringify(list));
            }
            catch (e) {
                console.warn("[출장등록] localStorage businessTripList 갱신 실패:", e);
            }
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
        // 여기서는 기존 register 정보는 그대로 두고 settlement만 덮어쓰기 형태로 전달한다고 가정.
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
                    end_data: settlement,
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
    const onlyMeCheckbox = getEl("settle_only_me");
    const resultMsg = getEl("settle_result_msg");
    const tbody = getEl("settle_result_tbody");
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
            }
            catch {
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
        if (reqNameParam)
            qs.set("req_name", reqNameParam);
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
/* harmony import */ var _08_domestic_trip_register__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./08_domestic-trip-register */ "./TypeScript/workspace/08_domestic-trip-register.ts");
/* harmony import */ var _09_domestic_trip_settlement__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./09_domestic-trip-settlement */ "./TypeScript/workspace/09_domestic-trip-settlement.ts");
/* harmony import */ var _10_domestic_trip_history__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./10_domestic-trip-history */ "./TypeScript/workspace/10_domestic-trip-history.ts");
//import { initWorkAssignPanel } from "./01_work-assign";



const API_BASE = location.hostname === "gwoun01.github.io"
    ? "https://outwork.sel3.cloudtype.app"
    : "http://127.0.0.1:5050";
/** 오늘 날짜 YYYY-MM-DD */
function getTodayYmd() {
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
async function renderTripStatusTable(date) {
    const tbody = document.getElementById("tripStatusTbody");
    const label = document.getElementById("tripStatusDateLabel");
    if (!tbody)
        return;
    const today = getTodayYmd();
    const baseDate = date || today;
    if (label)
        label.textContent = date ? date : "오늘";
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
    let list = [];
    if (storedRaw) {
        try {
            list = JSON.parse(storedRaw);
        }
        catch (e) {
            console.error("[대시보드] businessTripList JSON 파싱 실패:", e);
            list = [];
        }
    }
    // 🔹 2) 기준 날짜 + 국내출장만 필터
    const items = list.filter((t) => t.start_date === baseDate && t.trip_type === "domestic");
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
        const statusHtml = `<span class="px-2 py-[2px] rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">출장</span>`;
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
async function updateKpiTripToday(date) {
    const elTrip = document.getElementById("kpiTripToday");
    if (!elTrip)
        return;
    const today = getTodayYmd();
    const baseDate = date || today;
    const listKey = "businessTripList";
    const storedRaw = localStorage.getItem(listKey);
    let list = [];
    if (storedRaw) {
        try {
            list = JSON.parse(storedRaw);
        }
        catch (e) {
            console.error("[대시보드] businessTripList JSON 파싱 실패:", e);
            list = [];
        }
    }
    const todays = list.filter((t) => t.start_date === baseDate && t.trip_type === "domestic");
    elTrip.textContent = String(todays.length);
}
function initLocalTabNavigation() {
    const navButtons = document.querySelectorAll(".nav-btn");
    const panels = document.querySelectorAll('[id^="panel-"]');
    const titleEl = document.getElementById("wsTitle");
    function showPanel(id) {
        panels.forEach((p) => p.classList.add("hidden"));
        const target = document.getElementById(id);
        if (target)
            target.classList.remove("hidden");
        navButtons.forEach((btn) => {
            const active = btn.dataset.panel === id;
            btn.classList.toggle("bg-[#7ce92f]", active);
            btn.classList.toggle("text-[#000000]", active);
            btn.classList.toggle("font-bold", active);
        });
        const curBtn = document.querySelector(`.nav-btn[data-panel="${id}"]`);
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
    const sidebarButtons = document.querySelectorAll("#sidebar [data-panel]");
    sidebarButtons.forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.panel;
            if (!id)
                return;
            showPanel(id);
            // ✅ 대시보드 버튼 눌렀을 때도 항상 최신 로컬 데이터 다시 가져오기
            if (id === "panel-dashboard") {
                await renderTripStatusTable();
                await updateKpiTripToday();
            }
            // ✅ 국내출장 - 출장등록 클릭 시
            //    → 등록 + 정산 패널 둘 다 초기화 (이때 bt_save에 이벤트가 걸림)
            if (id === "panel-국내출장-출장등록") {
                await (0,_08_domestic_trip_register__WEBPACK_IMPORTED_MODULE_0__.initDomesticTripRegisterPanel)(API_BASE);
                await (0,_09_domestic_trip_settlement__WEBPACK_IMPORTED_MODULE_1__.initDomesticTripSettlementPanel)(API_BASE);
                console.log("국내출장-출장등록 & 정산 init 완료");
            }
            // ✅ 국내출장 - 출장내역(정산 내역 조회)
            if (id === "panel-국내출장-정산서등록") {
                await (0,_10_domestic_trip_history__WEBPACK_IMPORTED_MODULE_2__.initDomesticTripHistoryPanel)(API_BASE);
                console.log("국내출장-정산내역 조회 init 완료");
            }
        });
    });
    // ✅ 최초 로딩(오늘 기준): 표 + KPI
    await renderTripStatusTable();
    await updateKpiTripToday();
    console.debug("[INIT] workspace 초기화 완료");
});

})();

/******/ })()
;
//# sourceMappingURL=workspace.bundle.js.map