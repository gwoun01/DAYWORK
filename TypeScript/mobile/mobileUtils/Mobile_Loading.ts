// ======================================================
// ⏳ 정호개발 - 모바일 로딩 유틸
// ======================================================

export const Mobile_Loading = {
  show(message = "로딩 중...") {
    let overlay = document.getElementById("mobileLoadingOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "mobileLoadingOverlay";
      overlay.className =
        "fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]";
      overlay.innerHTML = `
        <div class="bg-white rounded-xl px-6 py-4 text-center shadow-lg">
          <div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p class="text-gray-700 text-sm">${message}</p>
        </div>
      `;
      document.body.appendChild(overlay);
    } else {
      overlay.classList.remove("hidden");
    }
  },

  hide() {
    const overlay = document.getElementById("mobileLoadingOverlay");
    if (overlay) overlay.classList.add("hidden");
  },
};
