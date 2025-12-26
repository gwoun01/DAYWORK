import express from "express";
import type { Pool } from "pg";

export default function businessTripRouter(pool: Pool) {
  const router = express.Router();

  /* =====================================================
     ✅ 국내출장 등록 (REGISTER → DB 저장)
     - 08_domestic-trip-register.ts 에서 호출
     ===================================================== */
  router.post("/domestic", async (req, res) => {
    const {
      trip_type,
      req_name,
      depart_place,
      destination,
      start_date,
      work_start_time,
      depart_time,
      arrive_time,
      purpose,
    } = req.body ?? {};

    // 기본 필수값 체크
    if (
      trip_type !== "domestic" ||
      !req_name ||
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
        message: "국내출장 필수값 누락",
      });
    }

    const trip_date = start_date; // DB에 trip_date로 저장하는 기준
    const trip_id = `${req_name}|${trip_date}`;

    // detail_json 안에 register 블럭으로 저장
    const register = {
      trip_type,
      req_name,
      depart_place,
      destination,
      start_date,
      work_start_time,
      depart_time,
      arrive_time,
      purpose,
    };

    try {
      const result = await pool.query(
        `
        INSERT INTO business_trips
          (trip_id, req_name, trip_date, detail_json)
        VALUES
          ($1, $2, $3, jsonb_build_object('register', $4::jsonb))
        ON CONFLICT (req_name, trip_date)
        DO UPDATE SET
          trip_id = EXCLUDED.trip_id,
          detail_json = jsonb_set(
            COALESCE(business_trips.detail_json, '{}'::jsonb),
            '{register}',
            $4::jsonb,
            true
          )
        RETURNING *;
        `,
        [trip_id, req_name, trip_date, JSON.stringify(register)]
      );

      return res.json({ ok: true, data: result.rows[0] });
    } catch (err: any) {
      console.error("국내출장 등록 실패:", err?.message ?? err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

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
     - 대시보드에서 /api/business-trip/status 호출
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

  /* =====================================================
     ✅ 정산 내역 기간 조회
     - GET /api/business-trip/settlements-range?from=YYYY-MM-DD&to=YYYY-MM-DD&req_name=홍길동(옵션)
     - 정산 내역보기(기간 조회) 화면에서 사용
     ===================================================== */
  router.get("/settlements-range", async (req, res) => {
    const from = String(req.query.from ?? "").trim();
    const to = String(req.query.to ?? "").trim();
    const reqName = String(req.query.req_name ?? "").trim(); // 옵션: 특정 직원만

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
