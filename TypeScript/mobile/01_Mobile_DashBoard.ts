// ======================================================
// 📋 정호개발 - 모바일 대시보드 (홈)
// ======================================================

export function initMobile_DashBoard(API_BASE: string) {
  const section = document.getElementById("dashboard");
  if (!section) return;

  const timeEl = section.querySelector("#currentTime") as HTMLElement;

  function updateTime() {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString("ko-KR", { hour12: false });
  }

  updateTime();
  setInterval(updateTime, 1000);

  console.log("🏠 [Mobile_DashBoard] 홈 초기화 완료");
}
