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
            localStorage.setItem("domesticTripDraft", JSON.stringify(payload));
            resultBox.textContent = "✅ 출장 등록 내용 저장 완료";
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "저장 완료",
                message: "출장 등록 내용이 저장되었습니다.\n정산 등록 화면에서 이어서 진행하세요.",
                showOk: true,
                showCancel: false,
            });
            resultBox.textContent = "✅ 출장 등록 완료";
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "저장 완료",
                message: "출장 등록이 완료되었습니다.\n정산 등록 화면에서 이어서 진행하세요.",
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
    const saveBtn = getEl("bt_save");
    const resetBtn = getEl("bt_reset");
    const resultBox = getEl("bt_result");
    const summaryBox = getEl("settle_trip_summary");
    if (saveBtn._bound)
        return;
    saveBtn._bound = true;
    // =========================
    // 정산 입력 필드
    // =========================
    const workEndTime = getEl("bt_work_end_time");
    const returnTime = getEl("bt_return_time");
    const returnPlace = getEl("bt_return_place");
    const breakfastChk = getEl("bt_meal_breakfast");
    const breakfastOwner = getEl("bt_meal_breakfast_owner");
    const lunchChk = getEl("bt_meal_lunch");
    const lunchOwner = getEl("bt_meal_lunch_owner");
    const dinnerChk = getEl("bt_meal_dinner");
    const dinnerOwner = getEl("bt_meal_dinner_owner");
    // =========================
    // 1️⃣ 08에서 저장한 데이터 불러오기
    // =========================
    const draftStr = localStorage.getItem("domesticTripDraft");
    if (!draftStr) {
        _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
            type: "alert",
            title: "데이터 없음",
            message: "출장 등록 데이터가 없습니다.\n출장 등록부터 진행하세요.",
            showOk: true,
            showCancel: false,
        });
        return;
    }
    const draft = JSON.parse(draftStr);
    // 카드 컨테이너
    const card = document.createElement("div");
    card.className =
        "border border-gray-200 rounded-xl p-4 bg-white text-xs text-gray-700 shadow-sm space-y-3";
    // 1️⃣ 출장자 / 출장일
    const row1 = document.createElement("div");
    row1.className = "flex justify-between";
    row1.innerHTML = `
  <div><span class="font-semibold">출장자</span>: ${draft.req_name}</div>
  <div><span class="font-semibold">출장일</span>: ${draft.start_date}</div>
`;
    card.appendChild(row1);
    summaryBox.innerHTML = "";
    summaryBox.appendChild(card);
    // 2️⃣ 출발지 / 출장지
    const row2 = document.createElement("div");
    row2.className = "grid grid-cols-2 gap-4";
    row2.innerHTML = `
  <div><span class="font-semibold">출발지</span>: ${draft.depart_place}</div>
  <div><span class="font-semibold">출장지</span>: ${draft.destination}</div>
`;
    card.appendChild(row2);
    // 3️⃣ 시간 정보
    const row3 = document.createElement("div");
    row3.className = "grid grid-cols-3 gap-3 bg-gray-50 p-2 rounded-lg";
    row3.innerHTML = `
  <div><span class="font-semibold">출발</span><br>${draft.depart_time || "-"}</div>
  <div><span class="font-semibold">업무시작</span><br>${draft.work_start_time || "-"}</div>
  <div><span class="font-semibold">도착</span><br>${draft.arrive_time || "-"}</div>
`;
    card.appendChild(row3);
    // 4️⃣ 목적
    const row4 = document.createElement("div");
    row4.className = "border-t pt-2";
    row4.innerHTML = `
  <span class="font-semibold">출장 목적</span><br>
  <span class="text-gray-600">${draft.purpose}</span>
`;
    card.appendChild(row4);
    // =========================
    // 초기화
    // =========================
    resetBtn.addEventListener("click", () => {
        workEndTime.value = "";
        returnTime.value = "";
        returnPlace.value = "";
        document
            .querySelectorAll('input[name="bt_vehicle"]')
            .forEach((r) => (r.checked = false));
        breakfastChk.checked = false;
        breakfastOwner.value = "";
        lunchChk.checked = false;
        lunchOwner.value = "";
        dinnerChk.checked = false;
        dinnerOwner.value = "";
        resultBox.textContent = "";
    });
    // =========================
    // 2️⃣ 정산 + DB 저장 (INSERT)
    // =========================
    saveBtn.addEventListener("click", async () => {
        const vehicle = getCheckedRadioValue("bt_vehicle");
        if (!workEndTime.value || !returnTime.value || !returnPlace.value.trim()) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "정산 필수 항목을 모두 입력하세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        if (!vehicle) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "차량을 선택하세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        const payload = {
            trip_type: "domestic",
            req_name: draft.req_name,
            trip_date: draft.start_date,
            detail_json: {
                register: draft,
                settlement: {
                    work_end_time: workEndTime.value,
                    return_time: returnTime.value,
                    return_place: returnPlace.value.trim(),
                    vehicle,
                    meals: {
                        breakfast: { checked: breakfastChk.checked, owner: breakfastOwner.value },
                        lunch: { checked: lunchChk.checked, owner: lunchOwner.value },
                        dinner: { checked: dinnerChk.checked, owner: dinnerOwner.value },
                    },
                },
            },
        };
        try {
            saveBtn.disabled = true;
            resultBox.textContent = "정산서 저장 중...";
            const res = await fetch(`${API_BASE}/api/business-trip/settlement`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok)
                throw new Error(`HTTP ${res.status}: ${await res.text()}`);
            localStorage.removeItem("domesticTripDraft");
            resultBox.textContent = "✅ 정산서 저장 완료";
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "저장 완료",
                message: "출장 정산이 완료되었습니다.",
                showOk: true,
                showCancel: false,
            });
        }
        catch (err) {
            console.error(err);
            resultBox.textContent = `❌ 저장 실패: ${err?.message ?? "알 수 없는 오류"}`;
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


const API_BASE = location.hostname === "gwoun01.github.io"
    ? "https://outwork.sel3.cloudtype.app"
    : "http://127.0.0.1:5050";
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
            // ✅ 출장 등록
            if (id === "panel-국내출장-출장등록") {
                await (0,_08_domestic_trip_register__WEBPACK_IMPORTED_MODULE_0__.initDomesticTripRegisterPanel)(API_BASE);
                console.log("국내출장-출장등록 init 완료");
            }
            // ✅ 정산서 등록 (🔥 핵심)
            if (id === "panel-국내출장-정산서등록") {
                await (0,_09_domestic_trip_settlement__WEBPACK_IMPORTED_MODULE_1__.initDomesticTripSettlementPanel)(API_BASE);
                console.log("국내출장-정산서등록 init 완료");
            }
        });
    });
    console.debug("[INIT] workspace 초기화 완료");
});

})();

/******/ })()
;
//# sourceMappingURL=workspace.bundle.js.map