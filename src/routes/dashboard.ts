import express from 'express';

import {
  getSummary,
  getTrend,
  getStreakChart,
} from '../controllers/dashboard';
import { authMe } from '../middlewares/auth';

const dashboardRoute = express().router;

dashboardRoute.get('/summary', authMe, getSummary);
dashboardRoute.get('/trend', authMe, getTrend);
dashboardRoute.get('/streak', authMe, getStreakChart);

export default dashboardRoute;
