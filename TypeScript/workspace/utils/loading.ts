/**
 * ✅ 전역 로딩 / 진행률 팝업 유틸리티
 * 자동 생성 + 진행률 표시 + 최소 표시시간 포함
 */
export const LoadingUtil = {
  el: null as HTMLDivElement | null,

  ensureElement() {
    if (this.el) return this.el;

    const div = document.createElement("div");
    div.id = "globalLoadingPopup";
    div.className =
      "hidden fixed inset-0 z-[9999] flex items-center justify-center bg-black/40";

    div.innerHTML = `
      <div class="bg-white rounded-lg shadow-lg px-8 py-6 text-center max-w-sm w-[90%] transition-all">
        <div id="spinnerWrap" class="flex justify-center mb-4">
          <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div id="progressWrap" class="hidden flex flex-col items-center mb-2">
          <div class="w-32 bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
            <div id="progressBar" class="bg-blue-500 h-2 rounded-full transition-all duration-200" style="width:0%"></div>
          </div>
          <span id="progressText" class="text-xs text-gray-600">0%</span>
        </div>
        <p id="loadingMessage" class="text-gray-700 font-medium text-sm leading-relaxed">
          ⚙️ 서버에서 데이터를 불러오는 중입니다.<br />잠시만 기다려주세요.
        </p>
      </div>
    `;

    document.body.appendChild(div);
    this.el = div;
    return div;
  },

  /** 🔹 일반 로딩 */
  show(message?: string) {
    const el = this.ensureElement();
    const msg = el.querySelector("#loadingMessage") as HTMLParagraphElement;
    const spinner = el.querySelector("#spinnerWrap") as HTMLDivElement;
    const progressWrap = el.querySelector("#progressWrap") as HTMLDivElement;

    if (msg) {
      msg.innerHTML =
        message ||
        `⚙️ 서버에서 데이터를 불러오는 중입니다.<br />잠시만 기다려주세요.`;
    }
    spinner.classList.remove("hidden");
    progressWrap.classList.add("hidden");
    el.classList.remove("hidden");
  },

  /** 🔹 진행률 기반 로딩 */
  showProgress(message = "💾 서버에 데이터를 저장 중입니다...") {
    const el = this.ensureElement();
    const msg = el.querySelector("#loadingMessage") as HTMLParagraphElement;
    const spinner = el.querySelector("#spinnerWrap") as HTMLDivElement;
    const progressWrap = el.querySelector("#progressWrap") as HTMLDivElement;
    const progressBar = el.querySelector("#progressBar") as HTMLDivElement;
    const progressText = el.querySelector("#progressText") as HTMLSpanElement;

    msg.innerHTML = message;
    spinner.classList.add("hidden");
    progressWrap.classList.remove("hidden");
    el.classList.remove("hidden");

    // 초기화
    progressBar.style.width = "0%";
    progressText.textContent = "0%";
  },

  /** 🔹 진행률 갱신 */
  updateProgress(value: number) {
    const el = this.ensureElement();
    const bar = el.querySelector("#progressBar") as HTMLDivElement;
    const text = el.querySelector("#progressText") as HTMLSpanElement;
    const percent = Math.min(100, Math.max(0, value));

    if (bar) bar.style.width = `${percent}%`;
    if (text) text.textContent = `${percent.toFixed(0)}%`;
  },

  /** 🔹 로딩 종료 */
  hide() {
    const el = this.ensureElement();
    el.classList.add("hidden");
  },

  /** 🔹 일반 wrap (0.8초 최소 유지) */
  async wrap<T>(promise: Promise<T>, message?: string): Promise<T> {
    const MIN_DELAY = 800;
    this.show(message);
    try {
      const [result] = await Promise.all([
        promise,
        new Promise(resolve => setTimeout(resolve, MIN_DELAY))
      ]);
      return result;
    } finally {
      this.hide();
    }
  },

  /** 🔹 진행률 기반 Promise 래핑 */
  async trackProgress<T>(
    promise: Promise<T>,
    message?: string,
    duration = 1500
  ): Promise<T> {
    this.showProgress(message);
    const el = this.ensureElement();

    // 가짜 진행률 시뮬레이션 (UX용)
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 10 + 5;
      this.updateProgress(progress);
      if (progress >= 90) clearInterval(interval);
    }, 150);

    try {
      const result = await promise;
      this.updateProgress(100);
      await new Promise(resolve => setTimeout(resolve, duration)); // 약간의 여유시간
      return result;
    } finally {
      clearInterval(interval);
      this.hide();
    }
  }
};
