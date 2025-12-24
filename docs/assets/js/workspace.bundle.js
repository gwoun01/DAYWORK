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
    if (saveBtn._bound)
        return;
    saveBtn._bound = true;
    const resetBtn = getEl("reg_reset");
    const resultBox = getEl("reg_result");
    const userNameEl = document.getElementById("userName");
    const reqNameInput = getEl("bt_req_name");
    const departPlaceInput = getEl("bt_place");
    const destinationInput = getEl("bt_destination");
    const startInput = getEl("bt_start");
    const workStartTimeInput = getEl("bt_work_start_time");
    const departTimeInput = getEl("bt_depart_time");
    const arriveTimeInput = getEl("bt_arrive_time");
    const purposeInput = getEl("bt_purpose");
    // 요청자 자동 채우기
    reqNameInput.value = (userNameEl?.textContent ?? "").trim() || "사용자";
    resetBtn.addEventListener("click", () => {
        departPlaceInput.value = "";
        destinationInput.value = "";
        startInput.value = "";
        workStartTimeInput.value = "";
        departTimeInput.value = "";
        arriveTimeInput.value = "";
        purposeInput.value = "";
        resultBox.textContent = "";
    });
    saveBtn.addEventListener("click", async () => {
        const payload = {
            trip_type: "domestic",
            req_name: reqNameInput.value.trim(),
            depart_place: departPlaceInput.value.trim(),
            destination: destinationInput.value.trim(),
            start_date: startInput.value,
            work_start_time: workStartTimeInput.value,
            depart_time: departTimeInput.value,
            arrive_time: arriveTimeInput.value,
            purpose: purposeInput.value.trim(),
        };
        // 필수값 체크
        if (!payload.req_name ||
            !payload.depart_place ||
            !payload.destination ||
            !payload.start_date ||
            !payload.work_start_time ||
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
            resultBox.textContent = "저장 중...";
            const res = await fetch(`${API_BASE}/api/business-trip`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok)
                throw new Error(`HTTP ${res.status}: ${await res.text()}`);
            // ✅ 서버에서 id를 돌려준다고 가정 (data.id)
            const json = await res.json();
            const newId = json?.data?.id;
            // ✅ 정산할 때 쓰려고 저장해둠
            if (newId) {
                localStorage.setItem("lastTripId", String(newId));
            }
            resultBox.textContent = "✅ 출장 등록 완료";
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "저장 완료",
                message: newId
                    ? `출장 등록 완료! (trip_id=${newId})\n정산등록에서 이 출장건을 업데이트합니다.`
                    : "출장 등록이 완료되었습니다.",
                showOk: true,
                showCancel: false,
            });
        }
        catch (err) {
            resultBox.textContent = `❌ 저장 실패: ${err?.message ?? "알 수 없는 오류"}`;
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "저장 실패",
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
function initDomesticTripSettlementPanel(API_BASE) {
    const panel = document.getElementById("panel-국내출장-정산서등록");
    if (!panel)
        return;
    const loadBtn = getEl("bt_load_trip");
    const saveBtn = getEl("bt_save");
    const resetBtn = getEl("bt_reset");
    const resultBox = getEl("bt_result");
    // 중복 바인딩 방지 (패널 열때마다 이벤트 또 붙는거 방지)
    if (saveBtn._bound)
        return;
    saveBtn._bound = true;
    const settleDate = getEl("bt_settle_date");
    const summaryBox = getEl("settle_trip_summary");
    const workEndTime = getEl("bt_work_end_time");
    const homeDepartTime = getEl("bt_home_depart_time");
    const homeArriveTime = getEl("bt_home_arrive_time");
    // ✅ 방금 HTML에 추가한 input
    const returnPlace = getEl("bt_return_place");
    // 식사
    const breakfastChk = getEl("bt_meal_breakfast");
    const breakfastOwner = getEl("bt_meal_breakfast_owner");
    const lunchChk = getEl("bt_meal_lunch");
    const lunchOwner = getEl("bt_meal_lunch_owner");
    const dinnerChk = getEl("bt_meal_dinner");
    const dinnerOwner = getEl("bt_meal_dinner_owner");
    // 초기화
    resetBtn.addEventListener("click", () => {
        settleDate.value = "";
        summaryBox.innerHTML = `<div class="text-gray-500">정산 대상 날짜를 선택하고 <b>출장정보 불러오기</b> 버튼을 누르면, 해당 날짜에 등록된 출장 정보가 여기 표시됩니다.</div>`;
        workEndTime.value = "";
        homeDepartTime.value = "";
        homeArriveTime.value = "";
        returnPlace.value = "";
        // 차량 라디오 해제
        document.querySelectorAll('input[name="bt_vehicle"]').forEach((r) => (r.checked = false));
        // 식사 초기화
        breakfastChk.checked = false;
        breakfastOwner.value = "";
        lunchChk.checked = false;
        lunchOwner.value = "";
        dinnerChk.checked = false;
        dinnerOwner.value = "";
        resultBox.textContent = "";
    });
    // 1) 출장정보 불러오기
    loadBtn.addEventListener("click", async () => {
        if (!settleDate.value) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "정산 대상 날짜를 선택하세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        try {
            loadBtn.disabled = true;
            resultBox.textContent = "출장정보 불러오는 중...";
            // ✅ 여기 URL은 너 서버에 맞게 바꾸면 됨 (임시)
            // 예: /api/innomax-business_trips/domestic?date=YYYY-MM-DD
            const res = await fetch(`${API_BASE}/api/business-trip/by-date?date=${settleDate.value}`);
            if (!res.ok)
                throw new Error(`HTTP ${res.status}: ${await res.text()}`);
            const data = await res.json();
            // data 예시는 서버에서 맞춰줘야 함
            // 임시로 있는 값들만 표시
            summaryBox.innerHTML = `
        <div><b>출장자:</b> ${data.req_name ?? "-"}</div>
        <div><b>출장지:</b> ${data.destination ?? data.place ?? "-"}</div>
        <div><b>시작일:</b> ${data.start_date ?? "-"}</div>
        <div><b>업무시작:</b> ${data.work_start_time ?? "-"}</div>
        <div><b>출발:</b> ${data.depart_time ?? "-"}</div>
        <div><b>도착:</b> ${data.arrive_time ?? "-"}</div>
      `;
            resultBox.textContent = "✅ 출장정보 불러오기 완료";
        }
        catch (err) {
            resultBox.textContent = `❌ 불러오기 실패: ${err?.message ?? "알 수 없는 오류"}`;
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "불러오기 실패",
                message: resultBox.textContent,
                showOk: true,
                showCancel: false,
            });
        }
        finally {
            loadBtn.disabled = false;
        }
    });
    // 2) 정산서 저장
    saveBtn.addEventListener("click", async () => {
        const vehicle = getCheckedRadioValue("bt_vehicle");
        // ✅ 필수값 체크 (초보용: 최소한 이것만 막아도 안정적)
        if (!settleDate.value) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "정산 대상 출장 날짜를 선택하세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        if (!workEndTime.value || !homeDepartTime.value || !homeArriveTime.value) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "업무 종료시간 / 자택(회사) 출발시간 / 자택(회사) 도착시간은 필수입니다.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        if (!returnPlace.value.trim()) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "복귀지를 입력하세요. (예: 자택 또는 회사)",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        if (!vehicle) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "차량(정산용)을 선택하세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        // ✅ payload 완성 (타입 에러 해결)
        const payload = {
            trip_date: settleDate.value,
            work_end_time: workEndTime.value,
            home_depart_time: homeDepartTime.value,
            home_arrive_time: homeArriveTime.value,
            return_place: returnPlace.value.trim(),
            vehicle,
            meals: {
                breakfast: {
                    checked: breakfastChk.checked,
                    owner: breakfastOwner.value || "",
                },
                lunch: {
                    checked: lunchChk.checked,
                    owner: lunchOwner.value || "",
                },
                dinner: {
                    checked: dinnerChk.checked,
                    owner: dinnerOwner.value || "",
                },
            },
        };
        try {
            saveBtn.disabled = true;
            resultBox.textContent = "정산서 저장 중...";
            // ✅ 서버 주소는 너 백엔드 라우터에 맞게 바꾸면 됨
            const res = await fetch(`${API_BASE}/api/business-trip/settlement`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`HTTP ${res.status}: ${text}`);
            }
            resultBox.textContent = "✅ 정산서 저장 완료";
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "저장 완료",
                message: "정산서가 저장되었습니다.",
                showOk: true,
                showCancel: false,
            });
        }
        catch (err) {
            console.error("❌ 정산서 저장 실패:", err);
            resultBox.textContent = `❌ 저장 실패: ${err?.message ?? "알 수 없는 오류"}`;
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "저장 실패",
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
//import { initWorkAssignPanel } from "./01_work-assign";
 // ✅ 추가

const API_BASE = location.hostname === "gwoun01.github.io"
    ? "https://outwork.sel3.cloudtype.app"
    : "http://127.0.0.1:5050";
function initLocalTabNavigation() {
    const navButtons = document.querySelectorAll(".nav-btn");
    const panels = document.querySelectorAll('[id^="panel-"]');
    const titleEl = document.getElementById("wsTitle");
    function showPanel(id) {
        // 1) 모든 패널 숨기기
        panels.forEach((p) => p.classList.add("hidden"));
        // 2) 해당 패널 표시
        const target = document.getElementById(id);
        if (target)
            target.classList.remove("hidden");
        // 3) 버튼 스타일 적용
        navButtons.forEach((btn) => {
            const active = btn.dataset.panel === id;
            btn.classList.toggle("bg-[#7ce92f]", active);
            btn.classList.toggle("text-[#000000]", active);
            btn.classList.toggle("font-bold", active);
        });
        // 4) 제목 변경
        const curBtn = document.querySelector(`.nav-btn[data-panel="${id}"]`);
        if (curBtn && titleEl) {
            titleEl.textContent = curBtn.textContent?.trim() ?? "";
        }
    }
    // 초기 Dashboard
    showPanel("panel-dashboard");
    return showPanel;
}
// ==============================================================
// 🔵 메인 초기화
// ==============================================================
document.addEventListener("DOMContentLoaded", async () => {
    console.debug("[INIT] DOMContentLoaded 시작");
    const showPanel = initLocalTabNavigation();
    const sidebarButtons = document.querySelectorAll("#sidebar [data-panel]");
    sidebarButtons.forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.panel;
            if (!id)
                return;
            showPanel(id);
            if (id.includes("panel-국내출장-출장등록")) {
                await (0,_08_domestic_trip_register__WEBPACK_IMPORTED_MODULE_0__.initDomesticTripRegisterPanel)(API_BASE);
                console.log("국내출장-출장등록 init 완료");
                if (id.includes("panel-국내출장-정산서등록")) {
                    await (0,_09_domestic_trip_settlement__WEBPACK_IMPORTED_MODULE_1__.initDomesticTripSettlementPanel)(API_BASE);
                    console.log("국내출장-정산서등록 init 완료");
                }
            }
        });
    });
    console.debug("[INIT] workspace 초기화 완료");
});

})();

/******/ })()
;
//# sourceMappingURL=workspace.bundle.js.map