import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

// JWT_SECRET 미설정 시 서버 시작 거부
if (!process.env.JWT_SECRET) {
  console.error(
    '[Fatal] JWT_SECRET 환경변수가 설정되지 않았습니다. 서버를 시작할 수 없습니다.',
  );
  process.exit(1);
}

// jobs
import { startGuestCleanupJob } from './jobs/cleanupGuests';

// route
import authRoute from './routes/auth';
import routinesRoute from './routes/routines';
import tasksRoute from './routes/tasks';
import taskLogRoute from './routes/taskLog';
import dashboardRoute from './routes/dashboard';

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  }),
);
app.use(express.json());

app.use('/auth', authRoute);
app.use('/routines', routinesRoute);
app.use('/tasks', tasksRoute);
app.use('/task-logs', taskLogRoute);
app.use('/dashboard', dashboardRoute);

// 404 핸들러
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    status: 404,
    error: 'Not Found',
    message: '요청한 리소스를 찾을 수 없습니다.',
  });
});

// 글로벌 에러 핸들러 (처리되지 않은 에러 방어)
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    status: 500,
    error: 'Internal Server Error',
    message: '서버 오류가 발생했습니다.',
  });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`server connected on port ${PORT}`);
  startGuestCleanupJob();
});
