import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import dayjs from 'dayjs';
import { pwdToHashed, createToken } from '../utils/auth';
import { handleError } from '../utils/controller';
import { prisma } from '../data/lib/prisma';
import { GUEST_SEED_ROUTINES } from '../constants/guestSeed';

const GUEST_TTL_MS = 60 * 60 * 1000; // 1시간

export const createGuest = async (_req: Request, res: Response) => {
  try {
    const guestKey = randomUUID().replace(/-/g, '').slice(0, 12);
    const email = `guest_${guestKey}@rootin.demo`;
    const password = randomUUID();
    const nickname = '게스트';
    const hashedPwd = await pwdToHashed(password);
    const expiresAt = new Date(Date.now() + GUEST_TTL_MS);
    const today = dayjs().startOf('day');

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          password: hashedPwd,
          nickname,
          is_guest: true,
          guest_expires_at: expiresAt,
        },
      });

      // 루틴 일괄 생성 (1 round-trip)
      const routines = await tx.routine.createManyAndReturn({
        data: GUEST_SEED_ROUTINES.map((r) => ({
          title: r.title,
          description: r.description,
          duration_days: r.duration_days,
          start_date: today.subtract(r.daysAgo, 'day').toDate(),
          user_id: createdUser.id,
        })),
        select: { id: true, title: true },
      });

      const routineIdByTitle = new Map(routines.map((r) => [r.title, r.id]));

      // 태스크 일괄 생성 (1 round-trip)
      const tasks = await tx.task.createManyAndReturn({
        data: GUEST_SEED_ROUTINES.flatMap((seedRoutine) =>
          seedRoutine.tasks.map((task) => ({
            routine_id: routineIdByTitle.get(seedRoutine.title)!,
            name: task.name,
            sort_order: task.sort_order,
          })),
        ),
        select: { id: true, routine_id: true, sort_order: true },
      });

      const taskIdByKey = new Map(
        tasks.map((t) => [`${t.routine_id}_${t.sort_order}`, t.id]),
      );

      // 로그 일괄 생성 (1 round-trip)
      await tx.taskLog.createMany({
        data: GUEST_SEED_ROUTINES.flatMap((seedRoutine) => {
          const routineId = routineIdByTitle.get(seedRoutine.title)!;
          return seedRoutine.tasks.flatMap((taskData) => {
            const taskId =
              taskIdByKey.get(`${routineId}_${taskData.sort_order}`)!;
            return taskData.completedDaysAgo.map((daysAgo) => ({
              task_id: taskId,
              completed_date: today.subtract(daysAgo, 'day').toDate(),
            }));
          });
        }),
      });

      return createdUser;
    });

    const token = await createToken({ user_id: user.id, email: user.email });

    return res.status(201).json({
      user: {
        user_id: user.id,
        email: user.email,
        nickname: user.nickname,
        is_guest: true,
      },
      token,
    });
  } catch (err) {
    return handleError(res, err);
  }
};
