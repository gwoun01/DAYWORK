import express from "express";
import type { Pool } from "pg";

export default function businessTripRouter(pool: Pool) {
  const router = express.Router();

  // =========================================================
  // 1) ✅ 출장등록 저장 (INSERT)
  // 저장: 출장자/출발지/출장지/시작일/업무시작시간/출발시간/도착시간/목적
  // start_date 기준으로 1건만 저장하고 싶으면 DB에 UNIQUE 걸어두면 됨
  // =========================================================
  router.post("/register", async (req, res) => {
    const {
      req_name,
      requester_name, // 혹시 프론트가 requester_name으로 보내는 경우도 대응
      depart_place,   // 출발지
      destination,    // 출장지
      start_date,     // 시작일(키)
      work_start_time,
      depart_time,
      arrive_time,
      purpose,
    } = req.body ?? {};

    const finalReqName = (req_name ?? requester_name ?? "").trim();

    // 필수값 체크
    if (
      !finalReqName ||
      !depart_place ||
      !destination ||
      !start_date ||
      !work_start_time ||
      !depart_time ||
      !arrive_time ||
      !purpose
    ) {
      return res.status(400).json({
        ok: false,
        message:
          "필수값 누락(req_name(or requester_name)/depart_place/destination/start_date/work_start_time/depart_time/arrive_time/purpose)",
        body: req.body,
      });
    }

    try {
      const result = await pool.query(
        `
        INSERT INTO business_trips
          (req_name, depart_place, destination, start_date, work_start_time, depart_time, arrive_time, purpose)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
        `,
        [
          finalReqName,
          depart_place,
          destination,
          start_date,
          work_start_time,
          depart_time,
          arrive_time,
          purpose,
        ]
      );

      return res.json({
        ok: true,
        message: "출장등록이 DB에 저장되었습니다.",
        data: result.rows[0],
      });
    } catch (err: any) {
      // start_date UNIQUE를 걸어놨다면, 중복이면 여기로 떨어질 수 있음
      console.error("출장등록 DB 저장 실패:", err);
      return res.status(500).json({
        ok: false,
        message: "출장등록 DB 저장 실패",
        detail: err?.message,
      });
    }
  });

  // =========================================================
  // 2) ✅ 날짜(start_date)로 출장등록 내용 불러오기 (GET)
  // 프론트: /api/business-trip/by-date?date=YYYY-MM-DD
  // =========================================================
  router.get("/by-date", async (req, res) => {
    const date = String(req.query.date ?? "").trim();

    if (!date) {
      return res.status(400).json({
        ok: false,
        message: "필수값 누락(date=YYYY-MM-DD)",
      });
    }

    try {
      const result = await pool.query(
        `
        SELECT *
        FROM business_trips
        WHERE start_date = $1
        ORDER BY id DESC
        LIMIT 1;
        `,
        [date]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: "해당 날짜의 출장등록 데이터가 없습니다.",
        });
      }

      return res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (err: any) {
      console.error("출장등록 조회 실패:", err);
      return res.status(500).json({
        ok: false,
        message: "출장등록 조회 실패",
        detail: err?.message,
      });
    }
  });

  // =========================================================
  // 3) ✅ 정산 저장 (UPDATE)
  // 저장: 업무종료시간/복귀시간/복귀지
  // 기준: start_date로 기존 출장 row 업데이트
  //
  // 프론트 예:
  // PUT /api/business-trip/settlement
  // body: { start_date, work_end_time, return_time, return_place }
  // =========================================================
  router.put("/settlement", async (req, res) => {
    const { start_date, work_end_time, return_time, return_place } = req.body ?? {};

    if (!start_date || !work_end_time || !return_time || !return_place) {
      return res.status(400).json({
        ok: false,
        message: "필수값 누락(start_date/work_end_time/return_time/return_place)",
        body: req.body,
      });
    }

    try {
      const result = await pool.query(
        `
        UPDATE business_trips
        SET
          work_end_time = $2,
          return_time   = $3,
          return_place  = $4
        WHERE start_date = $1
        RETURNING *;
        `,
        [start_date, work_end_time, return_time, return_place]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: "해당 start_date로 등록된 출장 데이터가 없습니다.",
        });
      }

      return res.json({
        ok: true,
        message: "정산 저장(UPDATE) 완료",
        data: result.rows[0],
      });
    } catch (err: any) {
      console.error("정산 UPDATE 실패:", err);
      return res.status(500).json({
        ok: false,
        message: "정산 UPDATE 실패",
        detail: err?.message,
      });
    }
  });

  // =========================================================
  // 4) ✅ 목록 조회 (전체) - 필요하면 유지
  // 프론트에서 전체 리스트 뿌릴 때 사용
  // =========================================================
  router.get("/list", async (_req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM business_trips ORDER BY id DESC`);
      return res.json({ ok: true, data: result.rows });
    } catch (err: any) {
      console.error("DB 조회 실패:", err);
      return res.status(500).json({ ok: false, message: "DB 조회 실패", detail: err?.message });
    }
  });

  return router;
}
