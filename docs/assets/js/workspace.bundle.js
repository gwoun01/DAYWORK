/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./TypeScript/workspace/01_work-assign.ts":
/*!************************************************!*\
  !*** ./TypeScript/workspace/01_work-assign.ts ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initWorkAssignPanel: () => (/* binding */ initWorkAssignPanel)
/* harmony export */ });
// ========================================================================================
// 📌 업무할당 패널 초기화 (로컬 데이터 버전)
// ========================================================================================
let isWorkAssignPanelInitialized = false;
function initWorkAssignPanel() {
    if (!isWorkAssignPanelInitialized) {
        isWorkAssignPanelInitialized = true;
    }
}


/***/ }),

/***/ "./TypeScript/workspace/08_business-trip.ts":
/*!**************************************************!*\
  !*** ./TypeScript/workspace/08_business-trip.ts ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initDomesticTripRequestPanel: () => (/* binding */ initDomesticTripRequestPanel)
/* harmony export */ });
/* harmony import */ var _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils/ModalUtil */ "./TypeScript/workspace/utils/ModalUtil.ts");
// TypeScript/workspace/08_domestic-trip-request.ts

function getEl(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`❌ element not found: #${id}`);
    return el;
}
function isValidDateRange(start, end) {
    return !!start && !!end && end >= start;
}
async function initDomesticTripRequestPanel(API_BASE) {
    // 패널 열 때마다 이벤트가 중복 등록되는 거 방지
    const saveBtn = getEl("bt_save");
    if (saveBtn._bound)
        return;
    saveBtn._bound = true;
    const userNameEl = document.getElementById("userName");
    const reqNameInput = getEl("bt_req_name");
    const placeInput = getEl("bt_place");
    const startInput = getEl("bt_start");
    const endInput = getEl("bt_end");
    const purposeInput = getEl("bt_purpose");
    const resetBtn = getEl("bt_reset");
    const resultBox = getEl("bt_result");
    // 요청자 자동 채우기
    const currentName = (userNameEl?.textContent ?? "").trim() || "사용자";
    reqNameInput.value = currentName;
    // 초기화
    resetBtn.addEventListener("click", () => {
        placeInput.value = "";
        startInput.value = "";
        endInput.value = "";
        purposeInput.value = "";
        resultBox.textContent = "";
    });
    // 저장
    saveBtn.addEventListener("click", async () => {
        const payload = {
            trip_type: "domestic",
            req_name: reqNameInput.value.trim(),
            place: placeInput.value.trim(),
            start_date: startInput.value,
            end_date: endInput.value,
            purpose: purposeInput.value.trim(),
        };
        // ✅ 필수값 체크
        if (!payload.req_name || !payload.place || !payload.start_date || !payload.end_date) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "요청자 / 고객사(지역) / 시작일 / 종료일은 필수입니다.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        if (!isValidDateRange(payload.start_date, payload.end_date)) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "날짜 오류",
                message: "종료일은 시작일보다 빠를 수 없습니다.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        //org code
        //const url = `${API_BASE}/api/business-trips/domestic`;
        try {
            saveBtn.disabled = true;
            resultBox.textContent = "저장 중...";
            console.log(API_BASE);
            // const res = await fetch(url,
            const res = await fetch(`${API_BASE}/api/business-trip`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`HTTP ${res.status}: ${text}`);
            }
            resultBox.textContent = "✅ 저장 완료 (승인 대기)";
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "저장 완료",
                message: "국내 출장 요청이 등록되었습니다.",
                showOk: true,
                showCancel: false,
            });
            // 저장 후 폼 비우고 싶으면 아래 주석 해제
            // resetBtn.click();
        }
        catch (err) {
            console.error("❌ 국내출장 저장 실패:", err);
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
/* harmony import */ var _01_work_assign__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./01_work-assign */ "./TypeScript/workspace/01_work-assign.ts");
/* harmony import */ var _08_business_trip__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./08_business-trip */ "./TypeScript/workspace/08_business-trip.ts");

 // ✅ 추가
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
document.addEventListener("DOMContentLoaded", async () => {
    console.debug("[INIT] DOMContentLoaded 시작");
    const showPanel = initLocalTabNavigation();
    const sidebarButtons = document.querySelectorAll("#sidebar [data-panel]");
    sidebarButtons.forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.panel;
            if (!id)
                return;
            // ✅ 1) 먼저 패널 화면 전환
            showPanel(id);
            // ✅ 2) 패널별 초기화(로직 연결)
            if (id.includes("panel-업무할당")) {
                await (0,_01_work_assign__WEBPACK_IMPORTED_MODULE_0__.initWorkAssignPanel)();
                console.log("업무할당 init 완료");
            }
            if (id.includes("panel-국내출장요청")) {
                await (0,_08_business_trip__WEBPACK_IMPORTED_MODULE_1__.initDomesticTripRequestPanel)(API_BASE);
                console.log("국내출장요청 init 완료");
            }
            if (id.includes("panel-해외출장요청")) {
                await (0,_08_business_trip__WEBPACK_IMPORTED_MODULE_1__.initDomesticTripRequestPanel)(API_BASE);
                console.log("해외출장요청 init 완료");
            }
        });
    });
    console.debug("[INIT] workspace 초기화 완료");
});

})();

/******/ })()
;
//# sourceMappingURL=workspace.bundle.js.map