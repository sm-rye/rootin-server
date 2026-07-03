import { prisma } from './lib/prisma';

export const findRoutinesWithAllLogs = async (userId: number) => {
  return await prisma.routine.findMany({
    where: { user_id: userId },
    select: {
      id: true,
      title: true,
      start_date: true,
      duration_days: true,
      tasks: {
        select: {
          id: true,
          name: true,
          logs: {
            select: { completed_date: true },
          },
        },
      },
    },
  });
};
