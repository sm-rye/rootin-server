type RawRoutine = {
  id: number;
  title: string;
  start_date: Date;
  duration_days: number;
  tasks: {
    id: number;
    name: string;
    logs: { completed_date: Date }[];
  }[];
};

type ProcessedTask = {
  id: number;
  name: string;
  logDates: Set<string>;
};

type ProcessedRoutine = {
  id: number;
  title: string;
  start: Date;
  end: Date;
  tasks: ProcessedTask[];
};

const toDateStr = (d: Date): string => d.toISOString().split('T')[0];

const utcMidnight = (d: Date | string): Date => {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const addDays = (date: Date, n: number): Date => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

const preprocess = (raw: RawRoutine[]): ProcessedRoutine[] =>
  raw.map((r) => {
    const start = utcMidnight(r.start_date);
    const end = addDays(start, r.duration_days - 1);
    return {
      id: r.id,
      title: r.title,
      start,
      end,
      tasks: r.tasks.map((t) => ({
        id: t.id,
        name: t.name,
        logDates: new Set(
          t.logs.map((l) => toDateStr(utcMidnight(l.completed_date))),
        ),
      })),
    };
  });

const getRateForDate = (
  dateStr: string,
  routines: ProcessedRoutine[],
): { rate: number; hasActive: boolean } => {
  const d = new Date(dateStr + 'T00:00:00.000Z');
  let total = 0;
  let done = 0;

  for (const r of routines) {
    if (d < r.start || d > r.end) continue;
    total += r.tasks.length;
    done += r.tasks.filter((t) => t.logDates.has(dateStr)).length;
  }

  if (total === 0) return { rate: 0, hasActive: false };
  return { rate: Math.round((done / total) * 100), hasActive: true };
};

// GET /api/dashboard/summary
export const calcSummary = (rawRoutines: RawRoutine[]) => {
  const routines = preprocess(rawRoutines);
  const today = utcMidnight(new Date());

  // 1. Overall rate: completed task-slots / total task-slots up to today
  let totalSlots = 0;
  let completedSlots = 0;
  for (const r of routines) {
    const cap = r.end <= today ? r.end : today;
    if (cap < r.start) continue;
    const d = new Date(r.start);
    while (d <= cap) {
      const ds = toDateStr(d);
      totalSlots += r.tasks.length;
      completedSlots += r.tasks.filter((t) => t.logDates.has(ds)).length;
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }
  const overallRate =
    totalSlots === 0
      ? 0
      : Math.round((completedSlots / totalSlots) * 100);

  // 2. Current streak: consecutive days going back from today where rate > 0
  //    Days with no active routines are neutral (skip, don't break streak)
  let currentStreak = 0;
  const cursor = new Date(today);
  for (let i = 0; i < 365; i++) {
    const ds = toDateStr(cursor);
    const { rate, hasActive } = getRateForDate(ds, routines);
    if (hasActive && rate > 0) {
      currentStreak++;
    } else if (hasActive && rate === 0) {
      break;
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  // 3. Weekday rates: average completion rate per day of week (UTC)
  const weekdayAccum = Array.from({ length: 7 }, () => ({
    sum: 0,
    count: 0,
  }));
  if (routines.length > 0) {
    const earliest = routines.reduce(
      (min, r) => (r.start < min ? r.start : min),
      routines[0].start,
    );
    const limit = addDays(today, -364);
    const scanFrom = earliest > limit ? earliest : limit;
    const s = new Date(scanFrom);
    while (s <= today) {
      const ds = toDateStr(s);
      const { rate, hasActive } = getRateForDate(ds, routines);
      if (hasActive) {
        const dow = s.getUTCDay(); // 0=Sun, 6=Sat
        weekdayAccum[dow].sum += rate;
        weekdayAccum[dow].count++;
      }
      s.setUTCDate(s.getUTCDate() + 1);
    }
  }
  const weekday = weekdayAccum.map((v, day) => ({
    day,
    rate: v.count === 0 ? 0 : Math.round(v.sum / v.count),
  }));

  // 4. Habit rates: per-task achievement rate
  const habitRates = routines
    .flatMap((r) => {
      const cap = r.end <= today ? r.end : today;
      if (cap < r.start) return [];
      const totalDays =
        Math.round((cap.getTime() - r.start.getTime()) / 86400000) + 1;

      return r.tasks.map((t) => {
        const completedDays = [...t.logDates].filter((ds) => {
          const d = new Date(ds + 'T00:00:00.000Z');
          return d >= r.start && d <= cap;
        }).length;
        return {
          taskId: t.id,
          taskName: t.name,
          routineId: r.id,
          routineTitle: r.title,
          rate: Math.round((completedDays / totalDays) * 100),
        };
      });
    })
    .sort((a, b) => b.rate - a.rate);

  return { overallRate, currentStreak, weekday, habitRates };
};

// GET /api/dashboard/trend?range=7|14|30
export const calcTrend = (rawRoutines: RawRoutine[], range: number) => {
  const routines = preprocess(rawRoutines);
  const today = utcMidnight(new Date());

  const trend: { date: string; rate: number }[] = [];
  const d = addDays(today, -(range - 1));

  while (d <= today) {
    const ds = toDateStr(d);
    const { rate } = getRateForDate(ds, routines);
    trend.push({ date: ds, rate });
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return trend;
};

// GET /api/dashboard/streak?weeks=12
const rateToLevel = (rate: number, hasActive: boolean): 0 | 1 | 2 | 3 => {
  if (!hasActive || rate === 0) return 0;
  if (rate <= 33) return 1;
  if (rate <= 66) return 2;
  return 3;
};

export const calcStreakChart = (rawRoutines: RawRoutine[], weeks: number) => {
  const routines = preprocess(rawRoutines);
  const today = utcMidnight(new Date());
  const totalDays = weeks * 7;

  const data: { date: string; level: 0 | 1 | 2 | 3 }[] = [];
  const d = addDays(today, -(totalDays - 1));

  while (d <= today) {
    const ds = toDateStr(d);
    const { rate, hasActive } = getRateForDate(ds, routines);
    data.push({ date: ds, level: rateToLevel(rate, hasActive) });
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return data;
};
