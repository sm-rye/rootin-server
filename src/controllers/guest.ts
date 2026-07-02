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

    const user = await prisma.$transaction(
      async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email,
            password: hashedPwd,
            nickname,
            is_guest: true,
            guest_expires_at: expiresAt,
          },
        });

        for (const routineData of GUEST_SEED_ROUTINES) {
          const startDate = today.subtract(routineData.daysAgo, 'day').toDate();

          const routine = await tx.routine.create({
            data: {
              title: routineData.title,
              description: routineData.description,
              duration_days: routineData.duration_days,
              start_date: startDate,
              user_id: createdUser.id,
            },
          });

          for (const taskData of routineData.tasks) {
            const task = await tx.task.create({
              data: {
                routine_id: routine.id,
                name: taskData.name,
                sort_order: taskData.sort_order,
              },
            });

            for (const daysAgo of taskData.completedDaysAgo) {
              await tx.taskLog.create({
                data: {
                  task_id: task.id,
                  completed_date: today.subtract(daysAgo, 'day').toDate(),
                },
              });
            }
          }
        }

        return createdUser;
      },
      {
        timeout: 15000,
      },
    );

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
