// 03_business-master-server.ts
import express from "express";
import type { Pool } from "pg";

export default function businessMasterRouter(pool: Pool) {
  const router = express.Router();

  /* ============================================
   * 1. 출장 기본 설정(config_json) 조회
   *    GET /api/business-master/config
   * ============================================ */
  router.get("/config", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, config_json
         FROM business_trip_config
         ORDER BY id
         LIMIT 1`
      );

      if (result.rows.length === 0) {
        // 기본값
        const defaultConfig = {
          fuel_price_per_liter: null, // 리터당 유류비
          km_per_liter: null,         // 평균 연비
          exchange_rate_usd: null,
          exchange_rate_jpy: null,
          exchange_rate_cny: null,
          default_oil_type: "휘발유",
          duty_members_text: "",      // 🟢 매달 당직자 메모
          note: "",
        };
        return res.json(defaultConfig);
      }

      const cfg = result.rows[0].config_json || {};

      const merged = {
        fuel_price_per_liter: cfg.fuel_price_per_liter ?? null,
        km_per_liter: cfg.km_per_liter ?? null,
        exchange_rate_usd: cfg.exchange_rate_usd ?? null,
        exchange_rate_jpy: cfg.exchange_rate_jpy ?? null,
        exchange_rate_cny: cfg.exchange_rate_cny ?? null,
        default_oil_type: cfg.default_oil_type ?? "휘발유",
        duty_members_text: cfg.duty_members_text ?? "",
        note: cfg.note ?? "",
      };

      return res.json(merged);
    } catch (err) {
      console.error("[business-master][GET /config] 에러:", err);
      return res.status(500).json({ error: "설정 조회 에러" });
    }
  });

  /* ============================================
   * 2. 출장 기본 설정 저장
   *    POST /api/business-master/config
   * ============================================ */
  router.post("/config", async (req, res) => {
    const configJson = req.body ?? {};

    try {
      const check = await pool.query(
        `SELECT id FROM business_trip_config ORDER BY id LIMIT 1`
      );

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
      return res.status(500).json({ error: "설정 저장 에러" });
    }
  });

  /* ============================================
   * 3. 거리 마스터 목록 조회
   *    GET /api/business-master/distances
   * ============================================ */
  router.get("/distances", async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          id,
          region,
          client_name,
          site_company,
          travel_time_text,
          person_name,
          home_distance_km,
          office_distance_km,
          fuel_type,
          remark
        FROM trip_distance_master
        ORDER BY region, client_name, person_name
      `
      );
      return res.json(result.rows);
    } catch (err) {
      console.error("[business-master][GET /distances] 에러:", err);
      return res
        .status(500)
        .json({ error: "거리 마스터 조회 에러" });
    }
  });

  /* ============================================
   * 4. 거리 마스터 등록
   *    POST /api/business-master/distances
   * ============================================ */
  router.post("/distances", async (req, res) => {
    const {
      region,
      client_name,
      site_company,
      travel_time_text,
      person_name,
      home_distance_km,
      office_distance_km,
      fuel_type,
      remark,
    } = req.body ?? {};

    if (!client_name || !person_name || home_distance_km == null) {
      return res.status(400).json({
        error: "거래처, 직원 이름, 자택→출장지 거리는 필수입니다.",
      });
    }

    try {
      const result = await pool.query(
        `
        INSERT INTO trip_distance_master (
          region,
          client_name,
          site_company,
          travel_time_text,
          person_name,
          home_distance_km,
          office_distance_km,
          fuel_type,
          remark
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING
          id,
          region,
          client_name,
          site_company,
          travel_time_text,
          person_name,
          home_distance_km,
          office_distance_km,
          fuel_type,
          remark
      `,
        [
          region ?? null,
          client_name,
          site_company ?? null,
          travel_time_text ?? null,
          person_name,
          home_distance_km,
          office_distance_km ?? null,
          fuel_type ?? null,
          remark ?? null,
        ]
      );

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("[business-master][POST /distances] 에러:", err);
      return res
        .status(500)
        .json({ error: "거리 마스터 등록 에러" });
    }
  });

  /* ============================================
   * 5. 거리 마스터 수정
   *    PUT /api/business-master/distances/:id
   * ============================================ */
  router.put("/distances/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "id가 없습니다." });
    }

    const {
      region,
      client_name,
      site_company,
      travel_time_text,
      person_name,
      home_distance_km,
      office_distance_km,
      fuel_type,
      remark,
    } = req.body ?? {};

    if (!client_name || !person_name || home_distance_km == null) {
      return res.status(400).json({
        error: "거래처, 직원 이름, 자택→출장지 거리는 필수입니다.",
      });
    }

    try {
      const result = await pool.query(
        `
        UPDATE trip_distance_master
        SET
          region             = $1,
          client_name        = $2,
          site_company       = $3,
          travel_time_text   = $4,
          person_name        = $5,
          home_distance_km   = $6,
          office_distance_km = $7,
          fuel_type          = $8,
          remark             = $9,
          updated_at         = NOW()
        WHERE id = $10
        RETURNING
          id,
          region,
          client_name,
          site_company,
          travel_time_text,
          person_name,
          home_distance_km,
          office_distance_km,
          fuel_type,
          remark
      `,
        [
          region ?? null,
          client_name,
          site_company ?? null,
          travel_time_text ?? null,
          person_name,
          home_distance_km,
          office_distance_km ?? null,
          fuel_type ?? null,
          remark ?? null,
          id,
        ]
      );

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("[business-master][PUT /distances/:id] 에러:", err);
      return res
        .status(500)
        .json({ error: "거리 마스터 수정 에러" });
    }
  });

  /* ============================================
   * 6. 거리 마스터 삭제
   *    DELETE /api/business-master/distances/:id
   * ============================================ */
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
        .json({ error: "거리 마스터 삭제 에러" });
    }
  });

  return router;
}
