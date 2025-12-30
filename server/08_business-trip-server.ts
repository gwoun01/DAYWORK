// src/routers/businessTripRouter.ts (예시 경로)
import express from "express";
import type { Pool } from "pg";

export default function businessTripRouter(pool: Pool) {
  const router = express.Router();

  /* ============================
    1) 국내출장 등록 → start_data + detail_json.register
  =============================*/
  router.post("/domestic", async (req, res) => {
    const {
      trip_type,
      req_name,
      depart_place,
      destination,
      start_date,
      depart_time,
      arrive_time,
      purpose,
    } = req.body ?? {};

    console.log("[POST /api/business-trip/domestic] body =", req.body);

    // 기본 필수값 체크
    if (
      trip_type !== "domestic" ||
      !req_name ||
      !depart_place ||
      !destination ||
      !start_date ||
      !depart_time ||
      !arrive_time ||
      !purpose
    ) {
      return res.status(400).json({
        ok: false,
        message: "국내출장 필수값 누락",
      });
    }

    const trip_date = start_date; // 날짜 기준
    const trip_id = `${req_name}|${trip_date}`;

    // 👉 출장등록 데이터 = start_data (= register)
    const startData = {
      trip_type,
      req_name,
      depart_place,
      destination,
      start_date,
      depart_time,
      arrive_time,
      purpose,
    };

    try {
      const sql = `
        INSERT INTO business_trips (
          trip_id,
          req_name,
          trip_date,
          start_data,
          end_data,
          detail_json,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4::jsonb,
          NULL,
          jsonb_build_object('register', $4::jsonb),
          NOW()
        )
        ON CONFLICT (req_name, trip_date)
        DO UPDATE SET
          trip_id    = EXCLUDED.trip_id,
          start_data = EXCLUDED.start_data,
          detail_json = jsonb_set(
            COALESCE(business_trips.detail_json, '{}'::jsonb),
            '{register}',
            EXCLUDED.start_data,
            true
          )
        RETURNING *;
      `;

      const params = [trip_id, req_name, trip_date, JSON.stringify(startData)];

      console.log("[DOMESTIC] SQL params =", params);

      const result = await pool.query(sql, params);

      console.log("[DOMESTIC] 저장 완료 row =", result.rows[0]);

      return res.json({ ok: true, data: result.rows[0] });
    } catch (err: any) {
      console.error("국내출장 등록 실패:", err?.message ?? err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* ============================
      2) 이어 정산 저장 → end_data + detail_json(= start + end 합본)
  =============================*/
  router.post("/settlement", async (req, res) => {
    const { req_name, trip_date, detail_json } = req.body ?? {};
    const settlement = detail_json?.settlement;

    if (!req_name || !trip_date || !settlement) {
      return res
        .status(400)
        .json({ ok: false, message: "정산 필수값 누락" });
    }

    const trip_id = `${req_name}|${trip_date}`;
    const endData = settlement;

    try {
      const sql = `
        INSERT INTO business_trips (
          trip_id,
          req_name,
          trip_date,
          start_data,
          end_data,
          detail_json,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          '{}'::jsonb,
          $4::jsonb,
          jsonb_build_object(
            'register', '{}'::jsonb,
            'settlement', $4::jsonb
          ),
          NOW()
        )
        ON CONFLICT (req_name, trip_date)
        DO UPDATE SET
          trip_id  = EXCLUDED.trip_id,
          end_data = EXCLUDED.end_data,
          detail_json = jsonb_build_object(
            'register', COALESCE(business_trips.start_data, '{}'::jsonb),
            'settlement', EXCLUDED.end_data
          )
        RETURNING *;
      `;

      const params = [trip_id, req_name, trip_date, JSON.stringify(endData)];

      console.log("[SETTLEMENT] SQL params =", params);

      const result = await pool.query(sql, params);

      console.log("[SETTLEMENT] 저장 완료 row =", result.rows[0]);

      return res.json({ ok: true, data: result.rows[0] });
    } catch (err: any) {
      console.error("정산 저장 실패:", err?.message ?? err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* =====================================================
     3) 날짜로 출장정보 1건 조회 (등록/정산 화면에서 재조회용)
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
        SELECT *
        FROM business_trips
        WHERE req_name = $1
          AND trip_date = $2
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
     4) 대시보드용 출장자 현황 (/api/business-trip/status)
        👉 여기서 **start_data** 값만 써서
           고객사/출발시간/도착시간/출발지 를 내려줌
  ===================================================== */
  router.get("/status", async (req, res) => {
    const date = String(req.query.date ?? "").trim();

    try {
      const result = await pool.query(
        `
        SELECT
          trip_id,
          req_name,
          trip_date,
          start_data,
          end_data,
          detail_json,
          created_at
        FROM business_trips
        WHERE trip_date = COALESCE($1::date, CURRENT_DATE)
        ORDER BY created_at DESC;
        `,
        [date || null]
      );

      console.log("[STATUS] raw rows =", result.rows);

      const items = result.rows.map((row) => {
        // ✅ start_data 우선, 없으면 detail_json.register
        const start =
          row.start_data && Object.keys(row.start_data).length > 0
            ? row.start_data
            : row.detail_json?.register ?? {};

        // ✅ end_data 우선, 없으면 detail_json.settlement
        const end =
          row.end_data && Object.keys(row.end_data).length > 0
            ? row.end_data
            : row.detail_json?.settlement ?? {};

        const item = {
          trip_id: row.trip_id,
          req_name: row.req_name,
          trip_date: row.trip_date,

          depart_place: start.depart_place ?? "",
          destination:  start.destination  ?? "",
          depart_time:  start.depart_time  ?? "",
          arrive_time:  start.arrive_time  ?? "",

          status:
            end && Object.keys(end).length > 0 ? "SETTLED" : "REGISTERED",
        };

        console.log("[STATUS] mapped item =", item);
        return item;
      });

      return res.json({ ok: true, data: items });
    } catch (err: any) {
      console.error("출장자 현황 조회 실패:", err?.message ?? err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* =====================================================
     5) 정산 내역 기간 조회
  ===================================================== */
  router.get("/settlements-range", async (req, res) => {
    const from = String(req.query.from ?? "").trim();
    const to = String(req.query.to ?? "").trim();
    const reqName = String(req.query.req_name ?? "").trim(); // 옵션

    if (!from || !to) {
      return res.status(400).json({
        ok: false,
        message: "from, to 날짜는 필수입니다.",
      });
    }

    try {
      const params: any[] = [from, to];
      let where = "trip_date BETWEEN $1::date AND $2::date";

      if (reqName) {
        where += " AND req_name = $3";
        params.push(reqName);
      }

      const result = await pool.query(
        `
        SELECT
          trip_id,
          req_name,
          trip_date,
          start_data,
          end_data,
          detail_json,
          created_at
        FROM business_trips
        WHERE ${where}
        ORDER BY trip_date ASC, req_name ASC, created_at ASC
        `,
        params
      );

      return res.json({
        ok: true,
        data: result.rows,
      });
    } catch (err: any) {
      console.error("정산 내역 기간조회 실패:", err?.message ?? err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  return router;
}
