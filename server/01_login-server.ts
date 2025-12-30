// server/01_login-server.ts
import { Router, Request, Response } from "express";
import { Pool } from "pg";

export default function loginRouter(pool: Pool) {
  const router = Router();

  // 🔐 로그인
  router.post("/", async (req: Request, res: Response) => {
    const body = req.body as any;

    // username / id / ID 중 아무거나 와도 받기
    const rawUsername = body.username ?? body.id ?? body.ID;
    const rawPassword = body.password ?? body.pw ?? body.PW;

    console.log("🔐 로그인 요청 body =", req.body);
    console.log(
      "👉 해석된 username =",
      rawUsername,
      "password =",
      rawPassword ? "(입력됨)" : "(없음)"
    );

    if (!rawUsername || !rawPassword) {
      return res
        .status(400)
        .json({ error: "아이디와 비밀번호를 입력하세요." });
    }

    try {
      // ⚠️ 컬럼 이름: id, name, password_hash, permissions( jsonb 또는 text )
      const query = `
        SELECT id, name, permissions
        FROM innomax_users
        WHERE id = $1
          AND password_hash = $2
        LIMIT 1
      `;

      const result = await pool.query(query, [rawUsername, rawPassword]);

      if (result.rows.length === 0) {
        return res.status(401).json({ error: "로그인 실패" });
      }

      const row = result.rows[0]; // { id, name, permissions? }

      // 🔹 permissions 가 text 로 저장돼 있으면 JSON 파싱
      let perms: any = row.permissions ?? null;
      if (typeof perms === "string") {
        try {
          perms = JSON.parse(perms);
        } catch {
          perms = null;
        }
      }

      return res.json({
        id: row.id,
        name: row.name ?? "사용자",
        permissions: perms,           // ⬅ 권한 같이 내려줌
      });
    } catch (err) {
      console.error("❌ 로그인 오류:", err);
      return res.status(500).json({ error: "서버 오류" });
    }
  });

  // 🚪 로그아웃 (형식만)
  router.post("/logout", (_req: Request, res: Response) => {
    return res.json({ ok: true });
  });

  return router;
}
