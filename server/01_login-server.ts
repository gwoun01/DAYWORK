// server/login-server.ts
import { Router, Request, Response } from "express";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

export default function loginRouter(pool: Pool) {
  const router = Router();

 // 로그인
router.post("/", async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "아이디와 비밀번호를 입력하세요." });
  }

  try {
    // ID + password_hash 평문 비교
    const query = `
      SELECT "ID" as id, "Name" as name
      FROM innomax_users
      WHERE "ID" = $1 AND "password_hash" = $2
      LIMIT 1
    `;
    const result = await pool.query(query, [username, password]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "로그인 실패" });
    }

    const row = result.rows[0];

    // 로그인 성공 응답
    res.json({
      id: row.id,
      name: row.name ?? "사용자",
    });
  } catch (err) {
    console.error("❌ 로그인 오류:", (err as Error).message);
    res.status(500).json({ error: "서버 오류" });
  }
});


  // 선택: 로그아웃 엔드포인트 (프론트에서 호출 중이면 추가)
  router.post("/logout", async (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  return router;
}
