import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';

interface TimeSeriesRow {
  date: Date | string;
  role: string;
  count: bigint | number;
}

function buildDateRange(days: number): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ADM') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const limit = apiLimiter(user.user_id);
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Limite de requisições excedido' },
        { status: 429 }
      );
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last7Start = new Date(todayStart);
    last7Start.setDate(todayStart.getDate() - 6);
    const last30Start = new Date(todayStart);
    last30Start.setDate(todayStart.getDate() - 29);

    const [
      totalCompanies,
      activeCompanies,
      companiesWithUsers,
      totalUsers,
      rhUsers,
      liderUsers,
      activeToday,
      activeLast7,
      activeLast30,
      timeSeriesRows,
    ] = await Promise.all([
      prisma.company.count(),
      prisma.company.count({
        where: { campaigns: { some: { status: 'active' } } },
      }),
      prisma.company.count({
        where: { users: { some: {} } },
      }),
      prisma.user.count(),
      prisma.user.count({ where: { role: 'RH' } }),
      prisma.user.count({ where: { role: 'LIDERANCA' } }),
      prisma.user.count({
        where: { last_login_at: { gte: todayStart } },
      }),
      prisma.user.count({
        where: { last_login_at: { gte: last7Start } },
      }),
      prisma.user.count({
        where: { last_login_at: { gte: last30Start } },
      }),
      prisma.$queryRaw<TimeSeriesRow[]>`
        SELECT
          DATE(last_login_at AT TIME ZONE 'UTC') AS date,
          role,
          COUNT(*)::int AS count
        FROM core.users
        WHERE last_login_at IS NOT NULL
          AND last_login_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(last_login_at AT TIME ZONE 'UTC'), role
        ORDER BY date ASC
      `,
    ]);

    // Build 30-entry time series (one per day, zero-filled)
    const dateRange = buildDateRange(30);
    const seriesMap = new Map<string, { rh: number; lider: number; total: number }>(
      dateRange.map((d) => [d, { rh: 0, lider: 0, total: 0 }])
    );

    for (const row of timeSeriesRows) {
      const dateStr =
        row.date instanceof Date
          ? row.date.toISOString().slice(0, 10)
          : String(row.date);
      const entry = seriesMap.get(dateStr);
      if (entry) {
        const n = Number(row.count);
        if (row.role === 'RH') entry.rh = n;
        if (row.role === 'LIDERANCA') entry.lider = n;
        entry.total += n;
      }
    }

    const accessTimeSeries = dateRange.map((date) => ({
      date,
      ...seriesMap.get(date)!,
    }));

    return NextResponse.json({
      companies: {
        total: totalCompanies,
        active: activeCompanies,
        withUsers: companiesWithUsers,
      },
      users: {
        total: totalUsers,
        rh: rhUsers,
        lider: liderUsers,
        activeToday,
        activeLast7Days: activeLast7,
        activeLast30Days: activeLast30,
      },
      accessTimeSeries,
    });
  } catch (err) {
    console.error('Adm stats error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
