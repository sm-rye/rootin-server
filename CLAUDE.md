# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rootin Server는 루틴/습관 트래킹 앱의 **백엔드 API 서버**이다. 클라이언트는 별도 `rootin-web` 저장소에서 관리한다.

- **Client:** https://github.com/sm-rye/rootin-web
- **Server:** https://github.com/sm-rye/rootin-server

## Commands

```bash
yarn dev                 # 개발 서버 (tsx watch)
yarn build               # TypeScript 컴파일 (tsc)
yarn start               # 프로덕션 서버 (node dist/app.js)
yarn prisma:generate     # Prisma 클라이언트 생성
yarn prisma:migrate      # DB 마이그레이션 실행
```

## Tech Stack

- **Runtime:** Node.js 22 (CommonJS build)
- **Framework:** Express 5
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL (`localhost:5432/rootin_db`)
- **ORM:** Prisma 7 (`prisma/schema.prisma`)
- **Auth:** JWT (`jsonwebtoken`) + bcrypt
- **Package Manager:** Yarn 4 (node-modules linker)

## Architecture

```
src/
├── app.ts              → Express 진입점 (cors, json parser, 라우트 등록)
├── routes/             → Express 라우트 정의
├── controllers/        → 요청 핸들러 (비즈니스 로직 오케스트레이션)
├── data/               → Repository 레이어 (Prisma 쿼리)
│   └── lib/prisma.ts   → Prisma 클라이언트 인스턴스
├── middlewares/         → Express 미들웨어 (auth JWT 검증)
├── utils/              → 헬퍼 (JWT 생성/검증, bcrypt, config)
└── generated/prisma/   → 자동 생성된 Prisma 클라이언트
```

**요청 흐름:** Route → Middleware (auth) → Controller → Data (Prisma) → DB

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/signup` | - | 회원가입 |
| POST | `/auth/login` | - | 로그인 (JWT 반환) |
| GET | `/auth/me` | O | 현재 유저 조회 |
| GET | `/routines/` | O | 전체 루틴 목록 (completion_rate, end_date 포함) |
| GET | `/routines/:id` | O | 루틴 상세 (daily_status 포함) |
| POST | `/routines/` | O | 루틴 생성 |
| PATCH | `/routines/:id` | O | 루틴 수정 |
| DELETE | `/routines/:id` | O | 루틴 삭제 |
| POST | `/tasks/:taskId/toggle-log` | - | 태스크 완료 토글 |

## Database Schema

```
User (1) ──→ (N) Routine (1) ──→ (N) Task (1) ──→ (N) TaskLog
```

- **User:** id, email, password, nickname
- **Routine:** id, title, duration_days, description, start_date, user_id
- **Task:** id, routine_id, name, sort_order
- **TaskLog:** id, task_id, completed_date (태스크 완료 기록)

Cascade delete: Routine 삭제 시 하위 Task, TaskLog 모두 삭제.

## Auth Flow

1. 클라이언트가 `/auth/login`에 email/password 전송
2. 서버가 bcrypt로 비밀번호 검증 후 JWT 발급 (1시간 만료)
3. 클라이언트가 `Authorization: Bearer <token>` 헤더로 요청
4. `authMe` 미들웨어가 토큰 검증 후 `req.user`에 유저 정보 첨부

## Key Conventions

- **Formatting:** Prettier — single quotes, 2-space indent, trailing commas, 80 char width
- **Module:** ESM (import/export)
- **Error 메시지:** 한국어
- **Prisma 클라이언트:** `src/data/lib/prisma.ts`에서 import
- **환경변수:** `.env` 파일 (DATABASE_URL, SALT_ROUND)
