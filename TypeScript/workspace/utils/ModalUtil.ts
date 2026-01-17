// TypeScript/utils/ModalUtil.ts
export type ModalType = "alert" | "warn";

export const ModalUtil = {
  el: null as HTMLDivElement | null,

  ensureElement() {
    if (this.el) return this.el;

    const div = document.createElement("div");
    div.id = "globalSimpleModal";
    div.className =
      "hidden fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4";

    div.innerHTML = `
      <div id="modalBox" class="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl text-center border border-gray-200">
        <div id="modalIcon" class="text-5xl mb-4 select-none"></div>
        <h2 id="modalTitle" class="text-lg font-extrabold mb-2"></h2>
        <div id="modalMessage" class="text-sm text-gray-600 mb-6 leading-relaxed"></div>
        <div id="modalBtns" class="flex justify-center gap-3">
          <button id="modalCancelBtn"
            class="px-5 py-2.5 rounded-full border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 hidden">
            취소
          </button>
          <button id="modalOkBtn"
            class="px-5 py-2.5 rounded-full bg-blue-600 text-white font-extrabold hover:bg-blue-700 hidden">
            확인
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(div);
    this.el = div;

    // ✅ ESC로 닫기 (alert/warn 모두 적용)
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const root = this.ensureElement();
        if (!root.classList.contains("hidden")) this.hide();
      }
    });

    // ✅ 바깥 클릭 닫기(원치 않으면 아래 블록 주석)
    div.addEventListener("click", (e) => {
      if (e.target === div) this.hide();
    });

    return div;
  },

  setStyle(type: ModalType) {
    const el = this.ensureElement();
    const iconEl = el.querySelector("#modalIcon") as HTMLElement;
    const titleEl = el.querySelector("#modalTitle") as HTMLElement;

    if (type === "alert") {
      iconEl.textContent = "ℹ️";
      iconEl.className = "text-5xl text-blue-600 mb-4";
      titleEl.className = "text-lg font-extrabold mb-2 text-blue-700";
    } else {
      iconEl.textContent = "⚠️";
      iconEl.className = "text-5xl text-yellow-500 mb-4";
      titleEl.className = "text-lg font-extrabold mb-2 text-yellow-700";
    }
  },

  /**
   * ✨ 단일 모달 호출 (디자인 통일 확장 버전)
   * - alert → void
   * - warn  → boolean
   *
   * ✅ 추가 기능
   * - messageHtml: 줄바꿈/강조용 HTML 허용
   * - okText/cancelText: 버튼 문구 커스텀
   * - okClass/cancelClass: 버튼 색상 커스텀
   */
  async show({
    type = "alert",
    title = "알림",
    message = "",
    messageHtml,
    showOk = true,
    showCancel = false,
    okText = "확인",
    cancelText = "취소",
    okClass = "bg-blue-600 hover:bg-blue-700",
    cancelClass = "border border-gray-300 text-gray-700 hover:bg-gray-50",
  }: {
    type?: ModalType;
    title?: string;
    message?: string;
    messageHtml?: string;
    showOk?: boolean;
    showCancel?: boolean;
    okText?: string;
    cancelText?: string;
    okClass?: string;
    cancelClass?: string;
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

    // ✅ HTML/텍스트 둘 다 지원
    if (messageHtml && String(messageHtml).trim()) {
      msgEl.innerHTML = messageHtml;
    } else {
      msgEl.textContent = message;
    }

    // 버튼 표시 여부
    okBtn.classList.toggle("hidden", !showOk);
    cancelBtn.classList.toggle("hidden", !showCancel);

    // ✅ 버튼 텍스트
    okBtn.textContent = okText;
    cancelBtn.textContent = cancelText;

    // ✅ 버튼 스타일(통일)
    okBtn.className = `px-5 py-2.5 rounded-full text-white font-extrabold ${okClass} ${showOk ? "" : "hidden"}`;
    cancelBtn.className = `px-5 py-2.5 rounded-full font-bold ${cancelClass} ${showCancel ? "" : "hidden"}`;

    // 표시
    el.classList.remove("hidden");

    // -----------------------
    // alert 모달은 확인만 필요
    // -----------------------
    if (type === "alert") {
      return new Promise<void>((resolve) => {
        const close = () => {
          cleanup();
          this.hide();
          resolve();
        };

        const cleanup = () => {
          okBtn.removeEventListener("click", close);
          window.removeEventListener("keydown", onKey);
        };

        const onKey = (e: KeyboardEvent) => {
          if (e.key === "Enter") close();
        };

        okBtn.addEventListener("click", close);
        window.addEventListener("keydown", onKey);
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

      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Enter") onOk();
        if (e.key === "Escape") onCancel();
      };

      const cleanup = () => {
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        window.removeEventListener("keydown", onKey);
      };

      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      window.addEventListener("keydown", onKey);
    });
  },

  hide() {
    const el = this.ensureElement();
    el.classList.add("hidden");
  },
};
