// server/business-master-server.ts
import express from "express";
import type { Pool } from "pg";

export default function businessMasterRouter(pool: Pool) {
  const router = express.Router();

  /* =====================================================
   *  1. 출장 기본 설정 (config_json) 조회
   *  GET /api/business-master/config
   * ===================================================== */
  router.get("/config", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT config_json
         FROM business_trip_config
         ORDER BY id
         LIMIT 1`
      );

      // 아직 한 번도 설정을 저장한 적 없으면 기본 구조 리턴
      if (result.rows.length === 0) {
        const defaultConfig = {
          fuel_price_per_liter: null,   // 리터당 유류비
          km_per_liter: null,           // 평균 연비 (km/L)
          exchange_rate_usd: null,      // 환율 USD
          exchange_rate_jpy: null,      // 환율 JPY
          exchange_rate_cny: null,      // 환율 CNY
          duty_allowance_weekday: null, // 평일 당직수당
          duty_allowance_weekend: null, // 주말/휴일 당직수당
          default_oil_type: "휘발유",    // 기본 유종
          note: "",                     // 메모
        };
        return res.json(defaultConfig);
      }

      // DB에 저장된 JSON 그대로 반환
      const configJson = result.rows[0].config_json;
      return res.json(configJson);
    } catch (err) {
      console.error("[business-master][GET /config] 에러:", err);
      return res.status(500).json({ error: "설정 조회 중 에러" });
    }
  });

  /* =====================================================
   *  2. 출장 기본 설정 (config_json) 저장
   *  POST /api/business-master/config
   *  - 프론트에서 JSON 통째로 보내주면 그대로 저장
   * ===================================================== */
  router.post("/config", async (req, res) => {
    // 프론트에서 body로 보내준 JSON 전체를 config_json에 넣는다.
    const configJson = req.body ?? {};

    try {
      // row 존재 여부 체크
      const check = await pool.query(
        `SELECT id FROM business_trip_config ORDER BY id LIMIT 1`
      );

      // 처음 저장하는 경우 → INSERT
      if (check.rows.length === 0) {
        const insertResult = await pool.query(
          `
          INSERT INTO business_trip_config (config_json)
          VALUES ($1)
          RETURNING config_json
        `,
          [configJson]
        );

        return res.json(insertResult.rows[0].config_json);
      }

      // 이미 존재하는 경우 → UPDATE
      const id = check.rows[0].id;

      const updateResult = await pool.query(
        `
        UPDATE business_trip_config
        SET
          config_json = $1,
          updated_at  = NOW()
        WHERE id = $2
        RETURNING config_json
      `,
        [configJson, id]
      );

      return res.json(updateResult.rows[0].config_json);
    } catch (err) {
      console.error("[business-master][POST /config] 에러:", err);
      return res.status(500).json({ error: "설정 저장 중 에러" });
    }
  });

  /* =====================================================
   *  3. 거리 마스터 목록 조회
   *  GET /api/business-master/distances
   * ===================================================== */
  router.get("/distances", async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          id,
          from_place,
          to_place,
          distance_km,
          remark
        FROM trip_distance_master
        ORDER BY from_place, to_place
      `
      );

      return res.json(result.rows);
    } catch (err) {
      console.error("[business-master][GET /distances] 에러:", err);
      return res
        .status(500)
        .json({ error: "거리 마스터 목록 조회 중 에러" });
    }
  });

  /* =====================================================
   *  4. 거리 마스터 등록
   *  POST /api/business-master/distances
   * ===================================================== */
  router.post("/distances", async (req, res) => {
    const { from_place, to_place, distance_km, remark } = req.body ?? {};

    if (!from_place || !to_place || distance_km == null) {
      return res.status(400).json({
        error: "from_place, to_place, distance_km 은 필수입니다.",
      });
    }

    try {
      const result = await pool.query(
        `
        INSERT INTO trip_distance_master (
          from_place,
          to_place,
          distance_km,
          remark
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          from_place,
          to_place,
          distance_km,
          remark
      `,
        [from_place, to_place, distance_km, remark ?? ""]
      );

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("[business-master][POST /distances] 에러:", err);
      return res
        .status(500)
        .json({ error: "거리 마스터 등록 중 에러" });
    }
  });

  /* =====================================================
   *  5. 거리 마스터 수정
   *  PUT /api/business-master/distances/:id
   * ===================================================== */
  router.put("/distances/:id", async (req, res) => {
    const id = Number(req.params.id);
    const { from_place, to_place, distance_km, remark } = req.body ?? {};

    if (!id) {
      return res.status(400).json({ error: "id가 없습니다." });
    }

    if (!from_place || !to_place || distance_km == null) {
      return res.status(400).json({
        error: "from_place, to_place, distance_km 은 필수입니다.",
      });
    }

    try {
      const result = await pool.query(
        `
        UPDATE trip_distance_master
        SET
          from_place  = $1,
          to_place    = $2,
          distance_km = $3,
          remark      = $4,
          updated_at  = NOW()
        WHERE id = $5
        RETURNING
          id,
          from_place,
          to_place,
          distance_km,
          remark
      `,
        [from_place, to_place, distance_km, remark ?? "", id]
      );

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("[business-master][PUT /distances/:id] 에러:", err);
      return res
        .status(500)
        .json({ error: "거리 마스터 수정 중 에러" });
    }
  });

  /* =====================================================
   *  6. 거리 마스터 삭제
   *  DELETE /api/business-master/distances/:id
   * ===================================================== */
  router.delete("/distances/:id", async (req, res) => {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "id가 없습니다." });
    }

    try {
      await pool.query(
        `DELETE FROM trip_distance_master WHERE id = $1`,
        [id]
      );

      return res.json({ ok: true });
    } catch (err) {
      console.error("[business-master][DELETE /distances/:id] 에러:", err);
      return res
        .status(500)
        .json({ error: "거리 마스터 삭제 중 에러" });
    }
  });

  return router;
}
