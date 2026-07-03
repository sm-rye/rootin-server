import { Request, Response } from 'express';

import * as dashboardRepository from '../data/dashboard';
import { calcSummary, calcTrend, calcStreakChart } from '../utils/dashboard';
import { handleError, getUserId } from '../utils/controller';

export const getSummary = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const routines = await dashboardRepository.findRoutinesWithAllLogs(userId);
    return res.status(200).json(calcSummary(routines));
  } catch (err) {
    return handleError(res, err);
  }
};

export const getTrend = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const rawRange = Number(req.query.range);
    const range = [7, 14, 30].includes(rawRange) ? rawRange : 7;

    const routines = await dashboardRepository.findRoutinesWithAllLogs(userId);
    const trend = calcTrend(routines, range);

    return res.status(200).json({ range, trend });
  } catch (err) {
    return handleError(res, err);
  }
};

export const getStreakChart = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const rawWeeks = Number(req.query.weeks);
    const weeks = rawWeeks > 0 && rawWeeks <= 52 ? rawWeeks : 12;

    const routines = await dashboardRepository.findRoutinesWithAllLogs(userId);
    const data = calcStreakChart(routines, weeks);

    return res.status(200).json({ weeks, data });
  } catch (err) {
    return handleError(res, err);
  }
};
