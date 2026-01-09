// server/03_business-master-server.ts
import express from "express";
import type { Pool } from "pg";

type AnyObj = Record<string, any>;

function toNumberOrNull(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isYmd(s: any) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isYm(s: any) {
  return typeof s === "string" && /^\d{4}-\d{2}$/.test(s);
}

export default function businessMasterRouter(pool: Pool) {
  const router = express.Router();

  // =====================================================
  // ✅ 공통: settings / duty_roster "1행 보장"
  // =====================================================
  async function ensureBusinessTripSettingsRow() {
    const r = await pool.query(`SELECT * FROM business_trip_settings WHERE id=1`);
    if (r.rows.length > 0) return r.rows[0];

    const ins = await pool.query(
      `
      INSERT INTO business_trip_settings (
        id,
        note, notice,
        km_per_liter, default_oil_type,
        fuel_price_gasoline, fuel_price_diesel, fuel_price_lpg,
        exchange_rate_usd, exchange_rate_jpy, exchange_rate_cny,
        fuel_price_per_liter
      )
      VALUES (
        1,
        '', '',
        7, '휘발유',
        0, 0, 0,
        0, 0, 0,
        0
      )
      RETURNING *
      `
    );
    return ins.rows[0];
  }

  async function ensureDutyRosterSettingsRow() {
    const r = await pool.query(`SELECT * FROM duty_roster_settings WHERE id=1`);
    if (r.rows.length > 0) return r.rows[0];

    const ins = await pool.query(
      `
      INSERT INTO duty_roster_settings (id, duty_members_text)
      VALUES (1, '')
      RETURNING *
      `
    );
    return ins.rows[0];
  }

  // =====================================================
  // 1) ✅ 출장 기본 설정 조회/저장 (새 테이블 기반)
  //    - 프론트 호환을 위해 응답 key는 기존 그대로 유지
  // =====================================================
  router.get("/config", async (_req, res) => {
    try {
      const s = await ensureBusinessTripSettingsRow();
      const d = await ensureDutyRosterSettingsRow();

      // 레거시 호환: gasoline 없으면 fuel_price_per_liter 사용
      const gasoline =
        toNumberOrNull(s.fuel_price_gasoline) ??
        toNumberOrNull(s.fuel_price_per_liter) ??
        null;

      return res.json({
        // --- 새 구조(프론트가 쓰는 키) ---
        fuel_price_gasoline: gasoline,
        fuel_price_diesel: toNumberOrNull(s.fuel_price_diesel) ?? null,
        fuel_price_lpg: toNumberOrNull(s.fuel_price_lpg) ?? null,

        exchange_rate_usd: toNumberOrNull(s.exchange_rate_usd) ?? null,
        exchange_rate_jpy: toNumberOrNull(s.exchange_rate_jpy) ?? null,
        exchange_rate_cny: toNumberOrNull(s.exchange_rate_cny) ?? null,

        duty_members_text: String(d.duty_members_text ?? ""),
        vacations_text: "", // ✅ 더이상 config에 안 씀(레거시 키만 유지)
        notice: String(s.notice ?? s.note ?? ""),

        // --- 구 구조 호환 키(남겨두면 안전) ---
        fuel_price_per_liter: gasoline,
        km_per_liter: toNumberOrNull(s.km_per_liter) ?? 7,
        default_oil_type: String(s.default_oil_type ?? "휘발유"),
        note: String(s.note ?? s.notice ?? ""),
      });
    } catch (err) {
      console.error("[business-master][GET /config] 에러:", err);
      return res.status(500).json({ ok: false, error: "설정 조회 에러" });
    }
  });

  router.post("/config", async (req, res) => {
    const body: AnyObj = req.body ?? {};
    try {
      await ensureBusinessTripSettingsRow();
      await ensureDutyRosterSettingsRow();

      const gasoline = toNumberOrNull(body.fuel_price_gasoline) ?? toNumberOrNull(body.fuel_price_per_liter) ?? null;

      // business_trip_settings 업데이트
      const notice =
        body.notice != null
          ? String(body.notice)
          : body.note != null
            ? String(body.note)
            : null;

      const updatedSettings = await pool.query(
        `
        UPDATE business_trip_settings
        SET
          fuel_price_gasoline   = $1,
          fuel_price_diesel     = $2,
          fuel_price_lpg        = $3,
          exchange_rate_usd     = $4,
          exchange_rate_jpy     = $5,
          exchange_rate_cny     = $6,
          fuel_price_per_liter  = $7,
          default_oil_type      = COALESCE($8, default_oil_type),
          km_per_liter          = COALESCE($9, km_per_liter),
          notice                = COALESCE($10, notice),
          note                  = COALESCE($11, note)
        WHERE id=1
        RETURNING *
        `,
        [
          gasoline,
          toNumberOrNull(body.fuel_price_diesel),
          toNumberOrNull(body.fuel_price_lpg),
          toNumberOrNull(body.exchange_rate_usd),
          toNumberOrNull(body.exchange_rate_jpy),
          toNumberOrNull(body.exchange_rate_cny),
          gasoline,
          body.default_oil_type != null ? String(body.default_oil_type) : null,
          body.km_per_liter != null ? toNumberOrNull(body.km_per_liter) : null,
          notice,
          notice,
        ]
      );

      // duty_roster_settings 업데이트(있으면 반영)
      if (body.duty_members_text != null) {
        await pool.query(
          `
          UPDATE duty_roster_settings
          SET duty_members_text = $1
          WHERE id=1
          `,
          [String(body.duty_members_text)]
        );
      }

      const s = updatedSettings.rows[0];
      const d = await pool.query(`SELECT * FROM duty_roster_settings WHERE id=1`);
      const duty = d.rows[0];

      const gasolineOut =
        toNumberOrNull(s.fuel_price_gasoline) ??
        toNumberOrNull(s.fuel_price_per_liter) ??
        null;

      return res.json({
        ok: true,
        config: {
          fuel_price_gasoline: gasolineOut,
          fuel_price_diesel: toNumberOrNull(s.fuel_price_diesel) ?? null,
          fuel_price_lpg: toNumberOrNull(s.fuel_price_lpg) ?? null,
          exchange_rate_usd: toNumberOrNull(s.exchange_rate_usd) ?? null,
          exchange_rate_jpy: toNumberOrNull(s.exchange_rate_jpy) ?? null,
          exchange_rate_cny: toNumberOrNull(s.exchange_rate_cny) ?? null,
          duty_members_text: String(duty?.duty_members_text ?? ""),
          vacations_text: "",
          notice: String(s.notice ?? s.note ?? ""),

          fuel_price_per_liter: gasolineOut,
          km_per_liter: toNumberOrNull(s.km_per_liter) ?? 7,
          default_oil_type: String(s.default_oil_type ?? "휘발유"),
          note: String(s.note ?? s.notice ?? ""),
        },
      });
    } catch (err) {
      console.error("[business-master][POST /config] 에러:", err);
      return res.status(500).json({ ok: false, error: "설정 저장 에러" });
    }
  });

  // =====================================================
  // 1-1) ✅ 공지 전용 조회/저장 (business_trip_settings.notice)
  // =====================================================
  router.get("/notice", async (_req, res) => {
    try {
      const s = await ensureBusinessTripSettingsRow();
      return res.json({ ok: true, notice: String(s.notice ?? s.note ?? "") });
    } catch (err) {
      console.error("[notice][GET] err:", err);
      return res.status(500).json({ ok: false, error: "공지 조회 에러" });
    }
  });

  router.post("/notice", async (req, res) => {
    try {
      const notice = String(req.body?.notice ?? "").trim();
      await ensureBusinessTripSettingsRow();

      await pool.query(
        `
        UPDATE business_trip_settings
        SET notice = $1,
            note   = $1
        WHERE id=1
        `,
        [notice]
      );

      return res.json({ ok: true, notice });
    } catch (err) {
      console.error("[notice][POST] err:", err);
      return res.status(500).json({ ok: false, error: "공지 저장 에러" });
    }
  });

  // =====================================================
  // 2) ✅ 거리 마스터 (그대로 유지)
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
  // 3) ✅ 공휴일 조회 (그대로 유지)
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
  // 4) ✅ 휴가자 (vacations 테이블로 전환)
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

  router.get("/vacations", async (_req, res) => {
    try {
      const r = await pool.query(`
        SELECT
          id,
          user_no,
          user_name,
          vac_type,
          start_date,
          end_date,
          note,
          created_at
        FROM vacations
        ORDER BY id DESC
      `);
      return res.json({ ok: true, items: r.rows });
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

      const ins = await pool.query(
        `
        INSERT INTO vacations (
          user_no, user_name, vac_type,
          start_date, end_date, note
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING
          id, user_no, user_name, vac_type,
          start_date, end_date, note, created_at
        `,
        [
          user_no != null && user_no !== "" ? Number(user_no) : null,
          String(user_name),
          String(vac_type),
          String(start_date),
          String(end_date),
          String(note ?? ""),
        ]
      );

      return res.json({ ok: true, item: ins.rows[0] });
    } catch (err) {
      console.error("[vacations][POST] err:", err);
      return res.status(500).json({ ok: false, error: "휴가 등록 에러" });
    }
  });

  router.delete("/vacations/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "id 오류" });

      await pool.query(`DELETE FROM vacations WHERE id=$1`, [id]);
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

      const r = await pool.query(
        `
        SELECT
          id, user_no, user_name, vac_type,
          start_date, end_date, note, created_at
        FROM vacations
        WHERE start_date <= $1 AND end_date >= $1
        ORDER BY id DESC
        `,
        [today]
      );

      return res.json({ ok: true, date: today, count: r.rows.length, items: r.rows });
    } catch (err) {
      console.error("[vacations][STATUS] err:", err);
      return res.status(500).json({ ok: false, error: "휴가 현황 조회 에러" });
    }
  });

  // =====================================================
  // 5) ✅ 캘린더 일정 (calendar_events 테이블로 전환)
  // =====================================================
  type CalendarEventItem = {
    id: number;
    date: string;
    title: string;
    created_at: string;
    created_by?: number | null;
  };

  // ✅ 목록 조회: /calendar-events?ym=2026-01 (없으면 전체)
  router.get("/calendar-events", async (req, res) => {
    try {
      const ym = isYm(req.query.ym) ? String(req.query.ym) : null;

      if (ym) {
        const start = `${ym}-01`;
        const end = `${ym}-31`; // 간단 필터(문자열 비교), date 타입이면 OK

        const r = await pool.query(
          `
          SELECT id, date, title, created_by, created_at
          FROM calendar_events
          WHERE date >= $1 AND date <= $2
          ORDER BY id DESC
          `,
          [start, end]
        );
        return res.json({ ok: true, ym, items: r.rows });
      }

      const r = await pool.query(`
        SELECT id, date, title, created_by, created_at
        FROM calendar_events
        ORDER BY id DESC
      `);
      return res.json({ ok: true, ym: null, items: r.rows });
    } catch (err) {
      console.error("[calendar-events][GET] err:", err);
      return res.status(500).json({ ok: false, error: "일정 목록 조회 에러" });
    }
  });

  // ✅ 일정 추가
  router.post("/calendar-events", async (req, res) => {
    try {
      const { date, title, created_by } = req.body ?? {};

      if (!isYmd(date)) {
        return res.status(400).json({ ok: false, error: "date는 YYYY-MM-DD 형식" });
      }
      const t = String(title ?? "").trim();
      if (!t) {
        return res.status(400).json({ ok: false, error: "title(내용)은 필수입니다." });
      }

      const ins = await pool.query(
        `
        INSERT INTO calendar_events (date, title, created_by)
        VALUES ($1,$2,$3)
        RETURNING id, date, title, created_by, created_at
        `,
        [String(date), t, created_by != null && created_by !== "" ? Number(created_by) : null]
      );

      return res.json({ ok: true, item: ins.rows[0] });
    } catch (err) {
      console.error("[calendar-events][POST] err:", err);
      return res.status(500).json({ ok: false, error: "일정 등록 에러" });
    }
  });

  // ✅ 일정 삭제
  router.delete("/calendar-events/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "id 오류" });

      await pool.query(`DELETE FROM calendar_events WHERE id=$1`, [id]);
      return res.json({ ok: true });
    } catch (err) {
      console.error("[calendar-events][DELETE] err:", err);
      return res.status(500).json({ ok: false, error: "일정 삭제 에러" });
    }
  });

  return router;
}
