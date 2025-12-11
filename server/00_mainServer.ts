import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Pool } from "pg";
import path from "path";

// ✅ .env 로딩
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5050;



const allowedOrigins = [
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5501",   // ✅ 실제 Live Server 주소
  "http://127.0.0.1:5502",
  "http://localhost:5500",
  "http://localhost:5501",
  "http://localhost:5050",
  "https://tgyeo.github.io",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS 차단됨: ${origin}`);
        callback(new Error("CORS 정책에 의해 차단된 요청입니다."));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control", // ✅ 추가됨
      "X-Requested-With",
    ],
  })
);

app.use(express.json());
app.use("/", express.static(path.join(__dirname, "../../docs")));


// ✅ PostgreSQL 연결 설정
const pool: Pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: false,
});

// ✅ DB 연결 테스트
pool.query("SELECT 1")
  .then(() => console.log("✅ PostgreSQL 연결 성공"))
  .catch((err: Error) => {
    console.error("❌ PostgreSQL 연결 실패:", err.message);
    process.exit(1);
  });

// ✅ 루트 경로
app.get("/", (req: Request, res: Response) => {
  res.send("✅ 서버 정상 작동 중입니다! (루트 경로)");
});

// ✅ Health Check
app.get("/api/health", async (req: Request, res: Response) => {
  try {
    await pool.query("SELECT 1");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      ok: true,
      server: "ok",
      db: "ok",
      uptimeSec: Math.round(process.uptime()),
      now: new Date().toISOString(),
      env: process.env.NODE_ENV ?? "development",
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      server: "ok",
      db: "error",
      message: (err as Error).message,
      now: new Date().toISOString(),
    });
  }
});

// ✅ 라우터 불러오기
import loginRouter from "./01_login-server";
import userRegisterRouter from "./02_user-register-server";
import innomaxProjectsRouter from "./03_innomax-projects-server";
import innomaxWorksRouter from "./04_innomax-works-server";
import innomaxProgressRouter from "./05_innomax-progress-server";










// ✅ 라우터 주입
app.use("/api/login", loginRouter(pool));
app.use("/api/users", userRegisterRouter(pool));
app.use("/api/innomax-projects", innomaxProjectsRouter(pool));
app.use("/api/innomax-works", innomaxWorksRouter(pool));
app.use("/api/innomax-progress", innomaxProgressRouter(pool));





// ✅ 서버 실행
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// ✅ 서버 연결 확인용 핑(Ping) 엔드포인트
app.get("/api/ping", (req, res) => {
  res.json({ status: "ok", message: "서버 연결 정상" });
});

