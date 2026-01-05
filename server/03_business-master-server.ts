// server/03_business-master-server.ts
import express from "express";
import type { Pool } from "pg";

// Node 18+ 에서는 fetch 기본 내장.
// 만약 Node 16이면: npm i node-fetch 하고 import 필요함

type AnyObj = Record<string, any>;

function toNumberOrNull(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isYmd(s: any) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function safeJsonParse<T>(raw: any, fallback: T): T {
  try {
    return JSON.parse(String(raw ?? "")) as T;
  } catch {
    return fallback;
  }
}

export default function businessMasterRouter(pool: Pool) {
  const router = express.Router();

  // =====================================================
  // 1) 출장 기본 설정 조회/저장
  // =====================================================
  router.get("/config", async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, config_json
        FROM business_trip_config
        ORDER BY id
        LIMIT 1
      `);

      const defaultConfig = {
        // --- 새 구조 ---
        fuel_price_gasoline: null,
        fuel_price_diesel: null,
        fuel_price_lpg: null,
        exchange_rate_usd: null,
        exchange_rate_jpy: null,
        exchange_rate_cny: null,
        duty_members_text: "",
        vacations_text: "",
        notice: "",

        // --- 구 구조 호환 ---
        fuel_price_per_liter: null,
        km_per_liter: 7,
        default_oil_type: "휘발유",
        note: "",
      };

      if (result.rows.length === 0) return res.json(defaultConfig);

      const cfg: AnyObj = result.rows[0].config_json || {};

      const gasoline =
        toNumberOrNull(cfg.fuel_price_gasoline) ??
        toNumberOrNull(cfg.fuel_price_per_liter) ??
        null;

      return res.json({
        // --- 새 구조 ---
        fuel_price_gasoline: gasoline,
        fuel_price_diesel: toNumberOrNull(cfg.fuel_price_diesel) ?? null,
        fuel_price_lpg: toNumberOrNull(cfg.fuel_price_lpg) ?? null,
        exchange_rate_usd: toNumberOrNull(cfg.exchange_rate_usd) ?? null,
        exchange_rate_jpy: toNumberOrNull(cfg.exchange_rate_jpy) ?? null,
        exchange_rate_cny: toNumberOrNull(cfg.exchange_rate_cny) ?? null,
        duty_members_text: String(cfg.duty_members_text ?? ""),
        vacations_text: String(cfg.vacations_text ?? ""),
        notice: String(cfg.notice ?? cfg.note ?? ""),

        // --- 구 구조 호환 ---
        fuel_price_per_liter: gasoline,
        km_per_liter: 7,
        default_oil_type: String(cfg.default_oil_type ?? "휘발유"),
        note: String(cfg.note ?? cfg.notice ?? ""),
      });
    } catch (err) {
      console.error("[business-master][GET /config] 에러:", err);
      return res.status(500).json({ ok: false, error: "설정 조회 에러" });
    }
  });

  router.post("/config", async (req, res) => {
    const body: AnyObj = req.body ?? {};

    try {
      const check = await pool.query(`
        SELECT id, config_json
        FROM business_trip_config
        ORDER BY id
        LIMIT 1
      `);

      const existingCfg: AnyObj =
        check.rows.length > 0 ? (check.rows[0].config_json || {}) : {};

      const gasoline =
        toNumberOrNull(body.fuel_price_gasoline) ??
        toNumberOrNull(body.fuel_price_per_liter) ??
        toNumberOrNull(existingCfg.fuel_price_gasoline) ??
        toNumberOrNull(existingCfg.fuel_price_per_liter) ??
        null;

      const nextCfg: AnyObj = {
        ...existingCfg,

        // --- 새 구조 ---
        fuel_price_gasoline: gasoline,
        fuel_price_diesel:
          toNumberOrNull(body.fuel_price_diesel) ??
          toNumberOrNull(existingCfg.fuel_price_diesel) ??
          null,
        fuel_price_lpg:
          toNumberOrNull(body.fuel_price_lpg) ??
          toNumberOrNull(existingCfg.fuel_price_lpg) ??
          null,

        exchange_rate_usd:
          toNumberOrNull(body.exchange_rate_usd) ??
          toNumberOrNull(existingCfg.exchange_rate_usd) ??
          null,
        exchange_rate_jpy:
          toNumberOrNull(body.exchange_rate_jpy) ??
          toNumberOrNull(existingCfg.exchange_rate_jpy) ??
          null,
        exchange_rate_cny:
          toNumberOrNull(body.exchange_rate_cny) ??
          toNumberOrNull(existingCfg.exchange_rate_cny) ??
          null,

        duty_members_text:
          body.duty_members_text != null
            ? String(body.duty_members_text)
            : String(existingCfg.duty_members_text ?? ""),

        notice:
          body.notice != null
            ? String(body.notice)
            : body.note != null
              ? String(body.note)
              : String(existingCfg.notice ?? existingCfg.note ?? ""),

        vacations_text:
          body.vacations_text != null
            ? String(body.vacations_text)
            : String(existingCfg.vacations_text ?? ""),

        // --- 구 구조 호환 ---
        fuel_price_per_liter: gasoline,
        km_per_liter: 7,
        default_oil_type:
          body.default_oil_type != null
            ? String(body.default_oil_type)
            : String(existingCfg.default_oil_type ?? "휘발유"),
        note:
          body.note != null
            ? String(body.note)
            : body.notice != null
              ? String(body.notice)
              : String(existingCfg.note ?? existingCfg.notice ?? ""),
      };

      if (check.rows.length === 0) {
        const insertResult = await pool.query(
          `
          INSERT INTO business_trip_config (config_json)
          VALUES ($1)
          RETURNING config_json
        `,
          [nextCfg]
        );
        return res.json({ ok: true, config: insertResult.rows[0].config_json });
      }

      const id = check.rows[0].id;
      const updateResult = await pool.query(
        `
        UPDATE business_trip_config
        SET config_json = $1,
            updated_at  = NOW()
        WHERE id = $2
        RETURNING config_json
      `,
        [nextCfg, id]
      );

      return res.json({ ok: true, config: updateResult.rows[0].config_json });
    } catch (err) {
      console.error("[business-master][POST /config] 에러:", err);
      return res.status(500).json({ ok: false, error: "설정 저장 에러" });
    }
  });

  // =====================================================
  // 2) ✅ 거리 마스터 (원복 핵심)
  // =====================================================
  router.get("/distances", async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          region,
          client_name,
          travel_time_text,
          home_distance_km AS distance_km
        FROM trip_distance_master
        ORDER BY region, client_name
      `);
      return res.json(result.rows);
    } catch (err) {
      console.error("[business-master][GET /distances] 에러:", err);
      return res.status(500).json({ ok: false, error: "거리 마스터 조회 에러" });
    }
  });

  router.post("/distances", async (req, res) => {
    const { region, client_name, travel_time_text, distance_km } = req.body ?? {};

    if (!client_name) return res.status(400).json({ ok: false, error: "거래처는 필수입니다." });
    if (distance_km == null || distance_km === "")
      return res.status(400).json({ ok: false, error: "거리(km)는 필수입니다." });

    try {
      const result = await pool.query(
        `
        INSERT INTO trip_distance_master (
          region,
          client_name,
          travel_time_text,
          home_distance_km
        )
        VALUES ($1,$2,$3,$4)
        RETURNING
          id,
          region,
          client_name,
          travel_time_text,
          home_distance_km AS distance_km
      `,
        [region ?? null, String(client_name), travel_time_text ?? null, Number(distance_km)]
      );

      return res.json({ ok: true, row: result.rows[0] });
    } catch (err) {
      console.error("[business-master][POST /distances] 에러:", err);
      return res.status(500).json({ ok: false, error: "거리 마스터 등록 에러" });
    }
  });

  router.put("/distances/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "id가 없습니다." });
    }

    const { region, client_name, travel_time_text, distance_km } = req.body ?? {};
    if (!client_name) return res.status(400).json({ ok: false, error: "거래처는 필수입니다." });
    if (distance_km == null || distance_km === "")
      return res.status(400).json({ ok: false, error: "거리(km)는 필수입니다." });

    try {
      const result = await pool.query(
        `
        UPDATE trip_distance_master
        SET
          region           = $1,
          client_name      = $2,
          travel_time_text = $3,
          home_distance_km = $4,
          updated_at       = NOW()
        WHERE id = $5
        RETURNING
          id,
          region,
          client_name,
          travel_time_text,
          home_distance_km AS distance_km
      `,
        [region ?? null, String(client_name), travel_time_text ?? null, Number(distance_km), id]
      );

      return res.json({ ok: true, row: result.rows[0] });
    } catch (err) {
      console.error("[business-master][PUT /distances/:id] 에러:", err);
      return res.status(500).json({ ok: false, error: "거리 마스터 수정 에러" });
    }
  });

  router.delete("/distances/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "id가 없습니다." });
    }

    try {
      await pool.query(`DELETE FROM trip_distance_master WHERE id = $1`, [id]);
      return res.json({ ok: true });
    } catch (err) {
      console.error("[business-master][DELETE /distances/:id] 에러:", err);
      return res.status(500).json({ ok: false, error: "거리 마스터 삭제 에러" });
    }
  });

  router.get("/client-list", async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          MIN(id)               AS id,
          region,
          client_name,
          MAX(travel_time_text) AS travel_time_text
        FROM trip_distance_master
        GROUP BY region, client_name
        ORDER BY client_name, region
      `);
      return res.json(result.rows);
    } catch (err) {
      console.error("[business-master][GET /client-list] 에러:", err);
      return res.status(500).json({ ok: false, error: "거래처 목록 조회 에러" });
    }
  });

  // =====================================================
  // 3) ✅ 공휴일 조회
  // =====================================================
  router.get("/holidays", async (req, res) => {
    try {
      const year = `${req.query.year ?? ""}`;
      const month = `${req.query.month ?? ""}`;

      if (!/^\d{4}$/.test(year)) {
        return res.status(400).json({ ok: false, error: "year(YYYY) 필요" });
      }
      if (!/^\d{1,2}$/.test(month)) {
        return res.status(400).json({ ok: false, error: "month(MM) 필요" });
      }

      const mm = month.padStart(2, "0");
      const serviceKey = process.env.HOLIDAY_SERVICE_KEY;
      if (!serviceKey) {
        return res.status(500).json({ ok: false, error: "HOLIDAY_SERVICE_KEY 미설정" });
      }

      const url =
        "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getHoliDeInfo" +
        `?solYear=${year}` +
        `&solMonth=${mm}` +
        `&_type=json` +
        `&ServiceKey=${serviceKey}`;

      const r = await fetch(url);

      // 🔥 핵심: json() 바로 쓰지 말고 text()로 먼저 받기
      const rawText = await r.text();

      if (!r.ok) {
        console.error("[holiday api http error]", r.status, rawText);
        return res.status(502).json({
          ok: false,
          error: "공휴일 API HTTP 오류",
          status: r.status,
        });
      }

      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        console.error("[holiday api parse error]", rawText.slice(0, 300));
        return res.status(502).json({
          ok: false,
          error: "공휴일 API 응답 파싱 실패",
        });
      }

      const items = data?.response?.body?.items?.item;
      const list = (Array.isArray(items) ? items : items ? [items] : []).map((it: any) => ({
        date: String(it.locdate ?? ""),
        name: String(it.dateName ?? ""),
        isHoliday: String(it.isHoliday ?? "") === "Y",
      }));

      return res.json({ ok: true, year, month: mm, holidays: list });
    } catch (err: any) {
      console.error("[business-master][GET /holidays] 에러:", err);
      return res.status(500).json({ ok: false, error: String(err?.message ?? err) });
    }
  });
  // =====================================================
  // 4) ✅ 휴가자 (config_json.vacations_text에 저장)
  // =====================================================
  type VacationItem = {
    id: number;
    user_no: number | null;
    user_name: string;
    vac_type: "annual" | "half" | "etc";
    start_date: string;
    end_date: string;
    note?: string;
    created_at: string;
  };

  async function getConfigRow() {
    const r = await pool.query(`
      SELECT id, config_json
      FROM business_trip_config
      ORDER BY id
      LIMIT 1
    `);

    if (r.rows.length === 0) {
      const ins = await pool.query(
        `INSERT INTO business_trip_config (config_json) VALUES ($1) RETURNING id, config_json`,
        [{}]
      );
      return { id: ins.rows[0].id, config_json: ins.rows[0].config_json || {} };
    }
    return { id: r.rows[0].id, config_json: r.rows[0].config_json || {} };
  }

  async function saveConfigJson(id: number, cfg: AnyObj) {
    await pool.query(
      `UPDATE business_trip_config SET config_json=$1, updated_at=NOW() WHERE id=$2`,
      [cfg, id]
    );
  }

  router.get("/vacations", async (_req, res) => {
    try {
      const row = await getConfigRow();
      const cfg: AnyObj = row.config_json || {};
      const parsed = safeJsonParse<{ items: VacationItem[] }>(cfg.vacations_text, { items: [] });
      return res.json({ ok: true, items: Array.isArray(parsed.items) ? parsed.items : [] });
    } catch (err) {
      console.error("[vacations][GET] err:", err);
      return res.status(500).json({ ok: false, error: "휴가 목록 조회 에러" });
    }
  });

  router.post("/vacations", async (req, res) => {
    try {
      const { user_no, user_name, vac_type, start_date, end_date, note } = req.body ?? {};

      if (!user_name || !vac_type || !start_date || !end_date) {
        return res.status(400).json({ ok: false, error: "필수값 누락" });
      }
      if (!isYmd(start_date) || !isYmd(end_date)) {
        return res.status(400).json({ ok: false, error: "날짜는 YYYY-MM-DD 형식" });
      }
      if (start_date > end_date) {
        return res.status(400).json({ ok: false, error: "시작일이 종료일보다 클 수 없습니다." });
      }

      const row = await getConfigRow();
      const cfg: AnyObj = row.config_json || {};
      const parsed = safeJsonParse<{ items: VacationItem[] }>(cfg.vacations_text, { items: [] });
      const items = Array.isArray(parsed.items) ? parsed.items : [];

      const nextId = items.reduce((m, it) => Math.max(m, Number(it?.id || 0)), 0) + 1;

      const item: VacationItem = {
        id: nextId,
        user_no: user_no != null ? Number(user_no) : null,
        user_name: String(user_name),
        vac_type: String(vac_type) as any,
        start_date: String(start_date),
        end_date: String(end_date),
        note: String(note ?? ""),
        created_at: new Date().toISOString(),
      };

      cfg.vacations_text = JSON.stringify({
        items: [item, ...items],
        updatedAt: new Date().toISOString(),
      });

      await saveConfigJson(row.id, cfg);
      return res.json({ ok: true, item });
    } catch (err) {
      console.error("[vacations][POST] err:", err);
      return res.status(500).json({ ok: false, error: "휴가 등록 에러" });
    }
  });

  router.delete("/vacations/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "id 오류" });

      const row = await getConfigRow();
      const cfg: AnyObj = row.config_json || {};
      const parsed = safeJsonParse<{ items: VacationItem[] }>(cfg.vacations_text, { items: [] });
      const items = Array.isArray(parsed.items) ? parsed.items : [];

      cfg.vacations_text = JSON.stringify({
        items: items.filter((it) => Number(it.id) !== id),
        updatedAt: new Date().toISOString(),
      });

      await saveConfigJson(row.id, cfg);
      return res.json({ ok: true });
    } catch (err) {
      console.error("[vacations][DELETE] err:", err);
      return res.status(500).json({ ok: false, error: "휴가 삭제 에러" });
    }
  });

  router.get("/vacations/status/today", async (req, res) => {
    try {
      const q = req.query.date;
      const today = isYmd(q) ? String(q) : new Date().toISOString().slice(0, 10);

      const row = await getConfigRow();
      const cfg: AnyObj = row.config_json || {};
      const parsed = safeJsonParse<{ items: VacationItem[] }>(cfg.vacations_text, { items: [] });
      const items = Array.isArray(parsed.items) ? parsed.items : [];

      const todayItems = items.filter((it) => isYmd(it.start_date) && isYmd(it.end_date) && it.start_date <= today && today <= it.end_date);

      return res.json({ ok: true, date: today, count: todayItems.length, items: todayItems });
    } catch (err) {
      console.error("[vacations][STATUS] err:", err);
      return res.status(500).json({ ok: false, error: "휴가 현황 조회 에러" });
    }
  });

  return router;
}
