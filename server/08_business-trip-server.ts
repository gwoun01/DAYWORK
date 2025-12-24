import express from "express";
import type { Pool } from "pg";

export default function businessTripRouter(pool: Pool) {
  const router = express.Router();

  /* =====================================================
     출장 정산 저장 (INSERT or UPDATE) ✅ 유일한 settlement
     ===================================================== */
  router.post("/settlement", async (req, res) => {
    const { req_name, trip_date, detail_json } = req.body ?? {};

    if (!req_name || !trip_date || !detail_json) {
      return res.status(400).json({ ok: false, message: "정산 필수값 누락" });
    }

    const trip_id = `${req_name}|${trip_date}`; // ✅ virtual trip_id

    try {
      const result = await pool.query(
        `
      INSERT INTO business_trips
        (trip_id, req_name, trip_date, detail_json)
      VALUES
        ($1, $2, $3, $4::jsonb)
      ON CONFLICT (req_name, trip_date)
      DO UPDATE SET
        trip_id     = EXCLUDED.trip_id,
        detail_json = EXCLUDED.detail_json
      RETURNING *;
      `,
        [trip_id, req_name, trip_date, JSON.stringify(detail_json)]
      );

      return res.json({ ok: true, data: result.rows[0] });
    } catch (err: any) {
      console.error("정산 저장 실패:", err?.message ?? err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* =====================================================
     날짜로 출장정보 불러오기 (조회용)
     ===================================================== */
  router.get("/by-date", async (req, res) => {
    const date = String(req.query.date ?? "").trim();
    const reqName = String(req.query.req_name ?? "").trim();

    if (!date || !reqName) {
      return res.status(400).json({
        ok: false,
        message: "date + req_name 필요",
      });
    }

    try {
      const result = await pool.query(
        `
        SELECT * FROM business_trips
        WHERE req_name=$1 AND trip_date=$2
        LIMIT 1
        `,
        [reqName, date]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ ok: false, message: "출장 없음" });
      }

      return res.json({ ok: true, data: result.rows[0] });
    } catch (err) {
      console.error("출장조회 실패:", err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });
   /* =====================================================
     출장자 현황 조회 (목록)
     ===================================================== */
  router.get("/status", async (req, res) => {
    // ?date=YYYY-MM-DD (없으면 오늘)
    const date = String(req.query.date ?? "").trim();

    try {
      const result = await pool.query(
        `
        SELECT
          trip_id,
          req_name,
          trip_date,
          detail_json,
          created_at
        FROM business_trips
        WHERE trip_date = COALESCE($1::date, CURRENT_DATE)
        ORDER BY created_at DESC;
        `,
        [date || null]
      );

      // 화면에서 쓰기 좋게 가공
      const items = result.rows.map((row) => {
        const register = row.detail_json?.register ?? {};
        const settlement = row.detail_json?.settlement ?? {};

        return {
          trip_id: row.trip_id,
          req_name: row.req_name,
          trip_date: row.trip_date,
          depart_place: register.depart_place ?? "",
          destination: register.destination ?? "",
          depart_time: register.depart_time ?? "",
          work_start_time: register.work_start_time ?? "",
          arrive_time: register.arrive_time ?? "",
          status:
            Object.keys(settlement).length > 0
              ? "SETTLED"
              : "REGISTERED",
        };
      });

      return res.json({ ok: true, data: items });
    } catch (err: any) {
      console.error("출장자 현황 조회 실패:", err?.message ?? err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  return router;
}

