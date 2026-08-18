# rootin-server — 루틴 트래킹 REST API 서버

Rootin 웹앱의 백엔드 서버. 루틴·태스크 CRUD, 일일 완료 토글, JWT 인증을 제공한다.

**[🚀 데모](https://react-monorepo-rootin-three.vercel.app/auth)** &nbsp;|&nbsp; **[클라이언트 저장소](https://github.com/sm-rye/rootin-web)**

---

## 기술 스택

| 분류      | 기술                        |
| --------- | --------------------------- |
| Runtime   | Node.js                     |
| Framework | Express 5                   |
| Language  | TypeScript (strict)         |
| ORM       | Prisma 7                    |
| Database  | PostgreSQL                  |
| Auth      | JWT (jsonwebtoken) + bcrypt |

---

## 아키텍처

```
src/
├── routes/       → Express 라우터 정의
├── controllers/  → 요청 처리, 비즈니스 로직 오케스트레이션
├── data/         → Repository 레이어 (Prisma 쿼리)
├── middlewares/  → JWT 검증 미들웨어 (authMe)
├── utils/        → 루틴 계산, 에러 핸들러, JWT/bcrypt 헬퍼
├── constants/    → 게스트 시드 데이터
└── jobs/         → 게스트 계정 정리 스케줄러
```

**요청 흐름:** `Route → Middleware (authMe) → Controller → Data (Prisma) → PostgreSQL`

---

## API 엔드포인트

### Auth

| Method | Path           | Auth | 설명                                          |
| ------ | -------------- | ---- | --------------------------------------------- |
| `POST` | `/auth/signup` | —    | 회원가입, JWT 발급                            |
| `POST` | `/auth/login`  | —    | 로그인, JWT 발급                              |
| `POST` | `/auth/guest`  | —    | 게스트 계정 생성 + 시드 데이터 주입, JWT 발급 |
| `GET`  | `/auth/me`     | ✓    | 현재 유저 조회                                |

### Routines

| Method   | Path                        | Auth | 설명                                  |
| -------- | --------------------------- | ---- | ------------------------------------- |
| `GET`    | `/routines`                 | ✓    | 루틴 목록 (page, limit, filter, sort) |
| `GET`    | `/routines/overall-summary` | ✓    | 전체 루틴 요약 (평균 완료율)          |
| `GET`    | `/routines/:id`             | ✓    | 루틴 상세 (일일 현황 포함)            |
| `POST`   | `/routines`                 | ✓    | 루틴 생성                             |
| `PATCH`  | `/routines/:id`             | ✓    | 루틴 수정 (트랜잭션)                  |
| `DELETE` | `/routines/:id`             | ✓    | 루틴 삭제                             |

### Tasks

| Method | Path                        | Auth | 설명                    |
| ------ | --------------------------- | ---- | ----------------------- |
| `POST` | `/tasks/:taskId/toggle-log` | ✓    | 날짜별 태스크 완료 토글 |

---

## 데이터베이스 스키마

```
User (1) ──→ (N) Routine (1) ──→ (N) Task (1) ──→ (N) TaskLog
```

| 모델        | 주요 필드                                                                   |
| ----------- | --------------------------------------------------------------------------- |
| **User**    | id, email (unique), password (bcrypt), nickname, is_guest, guest_expires_at |
| **Routine** | id, title, description?, duration_days, start_date, user_id                 |
| **Task**    | id, name, sort_order, routine_id                                            |
| **TaskLog** | id, task_id, completed_date                                                 |

모든 하위 레코드는 부모 삭제 시 Cascade로 함께 삭제된다.

---

## 핵심 비즈니스 로직

### 루틴 완료율 계산

- `end_date` = `start_date + (duration_days - 1)`
- `completion_rate` = `(완료된 TaskLog 수 / duration_days × task 수) × 100`
- `isCompleted` = 완료율 100% **또는** 현재 날짜 > end_date

### 일일 현황 (daily_status)

```typescript
[{ day: 1, date: '2025-01-01', status: [{ task_id: 1, isCompleted: true }, ...] }, ...]
```

### 태스크 토글

날짜별 TaskLog 존재 여부 확인 후 생성(ON) 또는 삭제(OFF).

### 루틴 수정 (트랜잭션)

`prisma.$transaction()`으로 메타데이터 수정·태스크 삭제·수정·생성을 원자적으로 처리.

### 게스트 계정

UUID 기반 임시 계정을 즉시 생성하고 샘플 루틴 5개를 복사해 주입. TTL 1시간, 서버 시작 시 1시간 주기 스케줄러로 만료 계정 자동 삭제.

---

## 에러 핸들링

컨트롤러에서 `"ErrorKey:message"` 형식으로 throw하면 `handleError()`가 HTTP 상태코드로 변환한다.

| ErrorKey           | Status |
| ------------------ | ------ |
| BadRequest         | 400    |
| InvalidCredentials | 401    |
| UserNotFound       | 401    |
| AlreadyExistsEmail | 409    |
| RoutineNotFound    | 404    |
| TaskNotFound       | 404    |

---

## 개발 환경 설정

```bash
yarn install
yarn prisma:generate   # Prisma 클라이언트 생성
yarn prisma:migrate    # DB 마이그레이션 실행
yarn dev               # 개발 서버 시작 (tsx watch)
```

`.env.example`을 복사해 `.env`를 만든 뒤 로컬 환경에 맞게 값을 설정한다.

```env
DATABASE_URL="postgresql://user:password@localhost:5432/rootin_db"
JWT_SECRET="your-secret-key"
SALT_ROUND=10
PORT=3000
FRONTEND_URL="http://localhost:5173"
```

## 자동 검증

`main` 브랜치와 Pull Request에 변경이 올라오면 GitHub Actions에서 다음 항목을 자동으로 확인한다.

- Yarn 잠금 파일 기준 의존성 설치
- Prisma 클라이언트 생성
- TypeScript 빌드
