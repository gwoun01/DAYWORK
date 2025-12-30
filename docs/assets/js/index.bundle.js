/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/*!***********************************!*\
  !*** ./TypeScript/login/index.ts ***!
  \***********************************/

// ======================================================
// 정호개발 로그인 스크립트 + 환경 선택 + 서버 상태 표시
// ======================================================
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loadingPopup = document.getElementById("globalLoadingPopup");
const failModal = document.getElementById("loginFailModal");
const closeFailModalBtn = document.getElementById("closeFailModal");
const serverStatus = document.getElementById("serverStatus");
const deviceStatus = document.getElementById("deviceStatus");
const deviceSelect = document.getElementById("deviceModeSelect");
// ✅ 서버 주소
const isLocal = location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname.includes("app.github.dev");
const API_BASE = isLocal
    ? "http://127.0.0.1:5050"
    : "https://port-0-innomax-mghorm7bef413a34.sel3.cloudtype.app";
// ✅ 모달 닫기
closeFailModalBtn.addEventListener("click", () => {
    failModal.classList.add("hidden");
});
// ✅ 로딩 제어
function showLoading() { loadingPopup.classList.remove("hidden"); }
function hideLoading() { loadingPopup.classList.add("hidden"); }
// ✅ 실패 모달
function showFailModal(message) {
    const msgEl = document.getElementById("loginFailMessage");
    if (msgEl)
        msgEl.textContent = message;
    failModal.classList.remove("hidden");
}
// ✅ 서버 연결 확인
async function checkServerConnection() {
    try {
        const res = await fetch(`${API_BASE}/api/health`, { method: "GET" });
        if (res.ok) {
            serverStatus.textContent = "서버 연결 정상";
            serverStatus.className = "online";
        }
        else {
            throw new Error("서버 응답 오류");
        }
    }
    catch {
        serverStatus.textContent = "서버 연결 실패";
        serverStatus.className = "offline";
    }
}
// ======================================================
// 🌐 환경 선택 (PC / 모바일)
// ======================================================
function applyDeviceMode(mode) {
    if (mode === "mobile") {
        deviceStatus.textContent = "모바일 모드";
        deviceStatus.className = "mobile";
        deviceSelect.value = "mobile";
    }
    else {
        deviceStatus.textContent = "PC 모드";
        deviceStatus.className = "pc";
        deviceSelect.value = "pc";
    }
    localStorage.setItem("deviceMode", mode);
}
// ✅ 드롭다운 변경 이벤트
deviceSelect.addEventListener("change", (e) => {
    const mode = e.target.value;
    applyDeviceMode(mode);
});
// ✅ 페이지 진입 시 저장된 환경 적용
document.addEventListener("DOMContentLoaded", () => {
    const saved = localStorage.getItem("deviceMode") || "pc";
    applyDeviceMode(saved);
    checkServerConnection();
});
// ======================================================
// 🔐 로그인 처리
// ======================================================
loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const mode = localStorage.getItem("deviceMode") || "pc";
    if (!username || !password) {
        showFailModal("아이디와 비밀번호를 입력하세요.");
        return;
    }
    try {
        showLoading();
        const MIN_DELAY = 800;
        const [res] = await Promise.all([
            fetch(`${API_BASE}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ username, password }),
            }),
            new Promise((r) => setTimeout(r, MIN_DELAY)),
        ]);
        hideLoading();
        if (!res.ok) {
            showFailModal("아이디 또는 비밀번호가 일치하지 않습니다.");
            return;
        }
        const data = await res.json();
        // 백엔드 응답: { id, name, permissions }
        const id = data.id;
        const name = data.name ?? "사용자";
        const permissions = data.permissions ?? {};
        // 전체 유저 정보 저장 (workspace에서 사용)
        localStorage.setItem("user", JSON.stringify({
            id,
            name,
            permissions, // ⬅⬅⬅ 권한 추가
            loginTime: Date.now(),
        }));
        // 예전 코드 호환용 (헤더/아바타 표시)
        localStorage.setItem("loginUserId", data.id);
        localStorage.setItem("loginUserName", data.name);
        // ✅ 선택된 모드에 따라 페이지 분기
        const nextUrl = mode === "mobile" ? "mobileindex.html" : "workspace.html";
        console.log("[LOGIN SUCCESS]", nextUrl);
        window.location.href = nextUrl;
    }
    catch (err) {
        console.error(err);
        hideLoading();
        showFailModal("서버 연결 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
});
// ✅ 캐시 초기화
window.addEventListener("load", () => {
    localStorage.removeItem("user");
    sessionStorage.clear();
});

/******/ })()
;
//# sourceMappingURL=index.bundle.js.map