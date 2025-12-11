// server/innomax-projects-server.ts

import express, { Request, Response } from "express";
import { Pool } from "pg";

export interface InnoMaxProjectDetail {
  orderNo: string;
  equipName: string;
  clientName: string;
  packDate: string | null;
  deliveryDate: string | null;

  mfgMain: string;
  mfgSub: string;
  mfgCompany: string;

  plcMain: string;
  plcSub: string;
  plcCompany: string;

  wireMain: string;
  wireSub: string;
  wireCompany: string;

  setupMain: string;
  setupSub: string;
}

export default function innomaxProjectsRouter(pool: Pool) {
  const router = express.Router();

  // ✅ 수주건 저장 (INSERT / UPDATE)
  router.post("/", async (req: Request, res: Response) => {
    try {
      const detail = req.body as InnoMaxProjectDetail;
      const id = detail.orderNo?.trim();

      if (!id) {
        return res
          .status(400)
          .json({ ok: false, message: "수주건번호(orderNo)가 없습니다." });
      }

      const query = `
        INSERT INTO public.innomax_projects (code_no, detail_json)
        VALUES ($1, $2)
        ON CONFLICT (code_no)
        DO UPDATE SET detail_json = EXCLUDED.detail_json
      `;

      await pool.query(query, [id, detail]);

      return res.json({ ok: true, message: "저장되었습니다." });
    } catch (err) {
      console.error("❌ [innomax_projects] save error:", err);
      return res
        .status(500)
        .json({ ok: false, message: "서버 오류가 발생했습니다." });
    }
  });

  // ✅ 수주건 리스트 조회
  router.get("/", async (req: Request, res: Response) => {
    try {
      const { rows } = await pool.query(
        `
        SELECT code_no, detail_json
        FROM public.innomax_projects
        ORDER BY code_no DESC
      `
      );

      return res.json({ ok: true, rows });
    } catch (err) {
      console.error("❌ [innomax_projects] list error:", err);
      return res
        .status(500)
        .json({ ok: false, message: "조회 중 서버 오류가 발생했습니다." });
    }
  });

  return router;
}
