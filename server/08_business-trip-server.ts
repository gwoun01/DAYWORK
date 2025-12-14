import express from "express";

export const businessTripRouter = express.Router();

// 임시 저장소(DB 붙이면 여기 제거)
type DomesticTrip = {
  id: number;
  req_name: string;
  place: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  purpose: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string; // ISO
};

let seq = 1;
const domesticTrips: DomesticTrip[] = [];

// ✅ 국내 출장 요청 저장
businessTripRouter.post("/api/business-trips/domestic", (req, res) => {
  const { req_name, place, start_date, end_date, purpose } = req.body ?? {};

  // 간단 검증
  if (!req_name || !place || !start_date || !end_date || !purpose) {
    return res.status(400).json({
      ok: false,
      message: "필수값 누락(req_name/place/start_date/end_date/purpose)"
    });
  }

  // 날짜 검증(문자열 비교로도 YYYY-MM-DD면 동작)
  if (start_date > end_date) {
    return res.status(400).json({
      ok: false,
      message: "시작일은 종료일보다 늦을 수 없습니다."
    });
  }

  const item: DomesticTrip = {
    id: seq++,
    req_name,
    place,
    start_date,
    end_date,
    purpose,
    status: "PENDING",
    created_at: new Date().toISOString(),
  };

  domesticTrips.push(item);

  return res.json({
    ok: true,
    message: "국내출장요청이 저장되었습니다(승인 대기).",
    data: item,
  });
});

// (선택) 목록 조회: 대시보드/관리자 화면에서 쓰기 좋음
businessTripRouter.get("/api/business-trips/domestic", (_req, res) => {
  return res.json({ ok: true, data: domesticTrips });
});
