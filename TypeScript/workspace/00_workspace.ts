// TypeScript/workspace/00_workspace.ts

import { initDashboardTripStatus } from "./01_dashboard-trip-status";
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

/* =====================================================
   🔹 권한 관련 유틸 (localStorage.user 사용)
   - login.ts에서 이렇게 저장한다고 가정
     localStorage.setItem("user", JSON.stringify({
       id, name, permissions, loginTime
     }))
===================================================== */

type LoginUser = {
  id: string;
  name?: string;
  permissions?: Record<string, string>;
};

/** localStorage 에서 로그인 유저 전체 정보 가져오기 */
function getLoginUser(): LoginUser | null {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LoginUser;
  } catch {
    return null;
  }
}

/** 현재 로그인 유저의 권한 맵만 뽑기 */
function getUserPermissions(): Record<string, string> {
  const user = getLoginUser();
  return user?.permissions ?? {};
}

/** 패널 ID → permissions 키 매핑 */
const PANEL_PERM_MAP: Record<string, string> = {
  "panel-출장승인": "출장승인",
  "panel-출장내역-관리": "출장내역관리",
  "panel-국내출장-출장등록": "출장등록",
  "panel-국내출장-정산서등록": "출장내역",
  // 👉 대시보드, 사용자 관리 등은 여기 안 넣으면 권한 체크 안 함 (모두 접근 가능)
};

/** 이 패널에 들어갈 수 있는지? (localStorage.permissions 기준) */
function canAccessPanel(panelId: string): boolean {
  const permKey = PANEL_PERM_MAP[panelId];

  // 매핑 안 되어 있으면(대시보드, 사용자관리 등) 권한 체크 없이 통과
  if (!permKey) return true;

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
  const navButtons = document.querySelectorAll<HTMLButtonElement>(".nav-btn");
  const panels = document.querySelectorAll<HTMLElement>('[id^="panel-"]');
  const titleEl = document.getElementById("wsTitle") as
    | HTMLHeadingElement
    | null;

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
      }).catch(() => {});
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

  sidebarButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.panel;
      if (!id) return;

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
        await initUserManagePanel(API_BASE);
        console.log("[INIT] 사용자-관리 init 완료");
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
