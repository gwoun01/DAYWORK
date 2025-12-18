import express from "express";
import type { Pool } from "pg";

export default function businessTripRouter(pool: Pool) {
  const router = express.Router();

  // ✅ 국내 출장 요청 저장 (DB INSERT)
  router.post("/", async (req, res) => {
    //router.post("//domestic",
    // 프론트가 requester_name으로 보내는 경우도 같이 받게 처리
    const {
      req_name,
      requester_name,
      place,
      start_date,
      end_date,
      purpose,
    } = req.body ?? {}

    const finalReqName = (req_name ?? requester_name ?? "").trim();

    if (!finalReqName || !place || !start_date || !end_date || !purpose) {
      return res.status(400).json({
        ok: false,
        message: "필수값 누락(req_name(or requester_name)/place/start_date/end_date/purpose)",
        body: req.body, // 디버깅용
      });
    }

    if (start_date > end_date) {
      return res.status(400).json({
        ok: false,
        message: "시작일은 종료일보다 늦을 수 없습니다.",
      });
    }

    //'INSERT INTO business_trips
    //(req_Name, detail_json)
    //values
    //($1, $2)
    //[finalReqName,  req.body]
    try {
      const result = await pool.query(
        `
        INSERT INTO business_trips
          (req_name, place, start_date, end_date, purpose)
        VALUES
          ($1, $2, $3, $4, $5)
        RETURNING *;
        `,
        [finalReqName, place, start_date, end_date, purpose]
      );

      return res.json({
        ok: true,
        message: "국내출장요청이 DB에 저장되었습니다.",
        data: result.rows[0],
      });
    } catch (err: any) {
      console.error("DB 저장 실패:", err);
      return res.status(500).json({
        ok: false,
        message: "DB 저장 실패",
        detail: err?.message,
      });
    }
  });

  // ✅ 목록 조회 (DB SELECT)
  router.get("/api/business-trips", async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM business_trips ORDER BY id DESC`
      );
      return res.json({ ok: true, data: result.rows });
    } catch (err: any) {
      console.error("DB 조회 실패:", err);
      return res.status(500).json({ ok: false, message: "DB 조회 실패", detail: err?.message });
    }
  });

  return router;
}
