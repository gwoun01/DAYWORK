// TypeScript/utils/ModalUtil.ts
export type ModalType = "alert" | "warn";

export const ModalUtil = {
  el: null as HTMLDivElement | null,

  ensureElement() {
    if (this.el) return this.el;

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

  setStyle(type: ModalType) {
    const el = this.ensureElement();
    const iconEl = el.querySelector("#modalIcon") as HTMLElement;
    const titleEl = el.querySelector("#modalTitle") as HTMLElement;

    if (type === "alert") {
      iconEl.textContent = "ℹ️";
      iconEl.className = "text-5xl text-blue-600 mb-4";
      titleEl.className = "text-xl font-bold mb-2 text-blue-700";
    } else {
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
  async show({
    type = "alert",
    title = "알림",
    message = "",
    showOk = true,
    showCancel = false,
  }: {
    type?: ModalType;
    title?: string;
    message?: string;
    showOk?: boolean;
    showCancel?: boolean;
  }): Promise<boolean | void> {
    const el = this.ensureElement();
    const titleEl = el.querySelector("#modalTitle") as HTMLElement;
    const msgEl = el.querySelector("#modalMessage") as HTMLElement;
    const okBtn = el.querySelector("#modalOkBtn") as HTMLButtonElement;
    const cancelBtn = el.querySelector("#modalCancelBtn") as HTMLButtonElement;

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
      return new Promise<void>((resolve) => {
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
    return new Promise<boolean>((resolve) => {
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
