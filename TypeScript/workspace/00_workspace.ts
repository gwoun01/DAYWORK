// TypeScript/workspace/00_workspace.ts

import { initDashboardTripStatus } from "./01_dashboard-trip-status";
import { initTripApprovalPanel } from "./02_trip-approval";
import { initUserManagePanel } from "./04_user-manage";
import { initDomesticTripRegisterPanel } from "./08_domestic-trip-register";
import { initDomesticTripSettlementPanel } from "./09_domestic-trip-settlement";
import { initDomesticTripHistoryPanel } from "./10_domestic-trip-history";

const API_BASE =
  location.hostname === "gwoun01.github.io"
    ? "https://outwork.sel3.cloudtype.app"
    : "http://127.0.0.1:5050";

// ✅ 로그인할 때 login.ts에서 넣어둔 값 사용
//   localStorage.setItem("loginUserId", data.id);
function getLoginUserId(): string {
  const id = localStorage.getItem("loginUserId");
  return id || "사용자"; // 없으면 기본 텍스트
}

type LoginUser = {
  id: string;
  name: string;
  permissions?: Record<string, string> | null;
};

/** localStorage.user 에서 전체 로그인 유저 정보 가져오기 */
function getLoginUser(): LoginUser | null {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return {
      id: obj.id ?? "",
      name: obj.name ?? "",
      permissions: obj.permissions ?? null,
    };
  } catch {
    return null;
  }
}

/** permissions 객체에서 해당 키의 권한값 가져오기 (없으면 "NoAccess") */
function getPermValue(perms: Record<string, string> | null | undefined, key: string): string {
  if (!perms) return "NoAccess";
  const v = perms[key];
  if (!v) return "NoAccess";
  return v;
}

/**
 * 패널 전환(사이드 메뉴 → 메인 패널, 제목 바꾸기)
 */
function initLocalTabNavigation() {
  const navButtons = document.querySelectorAll<HTMLButtonElement>(".nav-btn");
  const panels = document.querySelectorAll<HTMLElement>('[id^="panel-"]');
  const titleEl = document.getElementById("wsTitle") as HTMLHeadingElement | null;

  function showPanel(id: string) {
    // 모든 패널 숨기고
    panels.forEach((p) => p.classList.add("hidden"));

    // 대상 패널만 보이기
    const target = document.getElementById(id);
    if (target) target.classList.remove("hidden");

    // 사이드 버튼 스타일 토글
    navButtons.forEach((btn) => {
      const active = btn.dataset.panel === id;
      btn.classList.toggle("bg-[#7ce92f]", active);
      btn.classList.toggle("text-[#000000]", active);
      btn.classList.toggle("font-bold", active);
    });

    // 상단 제목 변경
    const curBtn = document.querySelector<HTMLButtonElement>(
      `.nav-btn[data-panel="${id}"]`
    );
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
    } finally {
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
  initDashboardTripStatus(API_BASE);

  // 5) 사이드바에서 패널 이동
  const sidebarButtons =
    document.querySelectorAll<HTMLButtonElement>("#sidebar [data-panel]");

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
      if (!id) return;

      // ==========================
      // 🔒 권한 체크
      // ==========================
      if (hasPermInfo) {
        // 1) 관리자 전용 패널들
        if (
          id === "panel-출장승인" ||
          id === "panel-출장내역-관리" ||
          id === "panel-사용자-관리"
        ) {
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
        await initUserManagePanel(API_BASE);
        console.log("[INIT] 사용자-관리 init 완료");
      }
      // 관리자 전용 - 출장 승인
      if (id === "panel-출장승인") {
        await initTripApprovalPanel(API_BASE);
        console.log("[INIT] 출장승인 패널 init 완료");
      }

      // 국내출장 - 출장등록 패널 → 등록 + 정산 패널 초기화
      if (id === "panel-국내출장-출장등록") {
        await initDomesticTripRegisterPanel(API_BASE);
        await initDomesticTripSettlementPanel(API_BASE);
        console.log("[INIT] 국내출장-출장등록 & 정산 패널 init 완료");
      }

      // 국내출장 - 출장내역(정산 내역 조회)
      if (id === "panel-국내출장-정산서등록") {
        await initDomesticTripHistoryPanel(API_BASE);
        console.log("[INIT] 국내출장-정산 내역 조회 패널 init 완료");
      }
    });
  });

  // 6) 처음 진입: 대시보드 패널 + 오늘 데이터 로딩
  showPanel("panel-dashboard");
  window.dispatchEvent(new Event("trip-status-refresh"));

  console.debug("[INIT] workspace 초기화 완료");
});
