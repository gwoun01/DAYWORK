// ======================================================
// 📱 정호개발 - 모바일 SET-UP 화면 초기화
// 작성자: 여태검
// ======================================================

export function initMobile_SetUp(API_BASE: string) {
  console.log("🚀 [SET-UP] 초기화 시작");

  // 화면 요소 찾기
  const section = document.getElementById("mobile_set_up_section") as HTMLElement;
  const tabBtn = document.querySelector("[data-tab='mobile_set_up']") as HTMLButtonElement;

  const orderSelect = document.getElementById("setupOrderSelect") as HTMLSelectElement;
  const btnLoadYesterday = document.getElementById("btnLoadYesterdayWork") as HTMLButtonElement;

  const percentRange = document.getElementById("setupProgressPercent") as HTMLInputElement;
  const percentLabel = document.getElementById("setupProgressPercentLabel") as HTMLElement;

  const loadedWorkBox = document.getElementById("setupLoadedWork") as HTMLElement;
  const workInput = document.getElementById("setupWorkInput") as HTMLTextAreaElement;

  if (!section || !tabBtn) {
    console.warn("⚠️ [SET-UP] section 또는 버튼을 찾지 못했습니다.");
    return;
  }

  // ======================================================
  // 📌 1) 탭 클릭 시 화면 전환
  // ======================================================
  tabBtn.addEventListener("click", () => {
    document.querySelectorAll("section.tab-section, section[id^='mobile_']")
      .forEach(sec => sec.classList.add("hidden"));

    section.classList.remove("hidden");
    window.scrollTo(0, 0);
  });

  // ======================================================
  // 📌 2) 수주건 목록 로드 (서버 연동)
  // ======================================================
  async function loadOrders() {
    try {
      orderSelect.innerHTML = `<option value="">불러오는 중...</option>`;

      const res = await fetch(`${API_BASE}/api/mobile/orders`, { method: "GET" });
      const data = await res.json();

      orderSelect.innerHTML = `<option value="">수주건을 선택하세요</option>`;

      data.forEach((o: any) => {
        const opt = document.createElement("option");
        opt.value = o.id;
        opt.textContent = `${o.project_name} (${o.customer})`;
        orderSelect.appendChild(opt);
      });

    } catch (err) {
      console.error("❌ 수주건 불러오기 실패:", err);
      orderSelect.innerHTML = `<option value="">불러오기 실패</option>`;
    }
  }

  // ======================================================
  // 📌 3) 전날 업무 불러오기
  // ======================================================
  btnLoadYesterday.addEventListener("click", async () => {
    const orderId = orderSelect.value;
    if (!orderId) {
      alert("⚠️ 먼저 수주건을 선택해주세요.");
      return;
    }

    btnLoadYesterday.textContent = "불러오는 중...";
    btnLoadYesterday.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/mobile/set-up/yesterday?order_id=${orderId}`);
      const data = await res.json();

      loadedWorkBox.textContent = data.text || "전날 업무 내용이 없습니다.";
      percentRange.value = data.percent || "0";
      percentLabel.textContent = `(${percentRange.value}%)`;

    } catch (err) {
      console.error("❌ 전날 업무 불러오기 오류:", err);
      loadedWorkBox.textContent = "전날 업무를 불러오지 못했습니다.";
    } finally {
      btnLoadYesterday.textContent = "전날 업무 불러오기";
      btnLoadYesterday.disabled = false;
    }
  });

  // ======================================================
  // 📌 4) 진행률 Range → Label 반영
  // ======================================================
  percentRange.addEventListener("input", () => {
    percentLabel.textContent = `(${percentRange.value}%)`;
  });

  // ======================================================
  // 📌 5) 화면 초기 설정
  // ======================================================
  loadOrders(); // 수주건 자동 불러오기


  console.log("✅ [SET-UP] 초기화 완료");

}
