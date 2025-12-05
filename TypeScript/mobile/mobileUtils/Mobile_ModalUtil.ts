// ======================================================
// 💬 정호개발 - 모바일 모달 유틸
// ======================================================

export const Mobile_ModalUtil = {
  async alert({
    title = "알림",
    message = "",
  }: {
    title?: string;
    message: string;
  }) {
    return new Promise<void>((resolve) => {
      const modal = document.createElement("div");
      modal.className =
        "fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]";
      modal.innerHTML = `
        <div class="bg-white rounded-lg p-5 text-center w-11/12 max-w-sm shadow-xl">
          <h2 class="text-lg font-semibold mb-2">${title}</h2>
          <p class="text-gray-600 mb-4 text-sm">${message}</p>
          <button id="modalOkBtn" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            확인
          </button>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector("#modalOkBtn")?.addEventListener("click", () => {
        modal.remove();
        resolve();
      });
    });
  },
};
