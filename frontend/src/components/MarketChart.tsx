import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MarketHistoryPoint } from '../services/marketDataService';
import { useTheme } from '../context/ThemeContext';

type ChartMetric = 'close' | 'dma50' | 'dma200' | 'volume';

const metricLabels: Record<ChartMetric, string> = {
  close: 'Price',
  dma50: 'DMA 50',
  dma200: 'DMA 200',
  volume: 'Volume',
};

const formatValue = (value: number, metric: ChartMetric) => {
  if (metric === 'volume') {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
};

export function MarketChart({
  data,
  symbol,
  interval,
  loading,
  error,
}: {
  data: MarketHistoryPoint[];
  symbol: string;
  interval: string;
  loading: boolean;
  error?: string | null;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [metric, setMetric] = useState<ChartMetric>('close');

  const chartData = useMemo(() => {
    if (!data || !data.length) return [];
    return [...data].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  }, [data]);

  const isPositiveTrend = useMemo(() => {
    if (chartData.length < 2) return true;
    const firstClose = Number(chartData[0]?.close ?? 0);
    const lastClose = Number(chartData[chartData.length - 1]?.close ?? 0);
    return lastClose >= firstClose;
  }, [chartData]);

  const trendColor = isPositiveTrend ? '#10B981' : '#EF4444';

  const formatXAxis = (dt: unknown) => {
    if (!dt || typeof dt !== 'string') return String(dt ?? '');
    const d = new Date(dt);
    if (isNaN(d.getTime())) return dt;
    const isMultiYear =
      interval.includes('yr') ||
      interval.includes('Year') ||
      interval.toLowerCase() === 'max' ||
      interval.toLowerCase() === 'maximum';
    if (isMultiYear) {
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTooltipDate = (label: unknown) => {
    if (!label || typeof label !== 'string') return String(label ?? '');
    const d = new Date(label);
    if (isNaN(d.getTime())) return label;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="rounded-[24px] border border-slate-200 bg-white/80 p-5 shadow-[0_14px_32px_-18px_rgba(15,23,42,0.18)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-emerald-100" />
        </div>
        <div className="h-[280px] animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
        <div className="mt-4 text-sm font-medium text-[#596579]">Loading market data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-[#E7C2C2] bg-[#FFF6F6] p-5 text-sm font-medium text-[#4A2020]">
        {error}
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="rounded-3xl border border-dashed border-[#D8DDE8] bg-[#F8FAFC] p-5 text-sm font-medium text-[#596579]">
        Market data unavailable.
      </div>
    );
  }

  return (
    <div className={`rounded-3xl border p-5 shadow-2xl transition-colors ${isDark ? "border-[#1F2937] bg-[#111827]" : "border-[#E2E8F0] bg-white"}`}>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className={`text-xs uppercase tracking-[0.2em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>{symbol}</div>
          <h3 className={`mt-2 text-xl font-semibold ${isDark ? "text-white" : "text-[#0F172A]"}`}>Historical Price & Volume</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['close', 'dma50', 'dma200', 'volume'] as ChartMetric[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMetric(item)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                metric === item
                  ? 'bg-gradient-to-r from-[#3B82F6] to-[#1D4ED8] text-white shadow-md'
                  : isDark ? 'border border-white/10 bg-[#1F2937] text-slate-300 hover:text-white' : 'border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {metricLabels[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {metric === 'volume' ? (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="volumeFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={trendColor} stopOpacity={0.82} />
                  <stop offset="100%" stopColor={trendColor} stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={isDark ? "rgba(148,163,184,0.12)" : "rgba(0,0,0,0.06)"} vertical={false} />
              <XAxis
                dataKey="datetime"
                stroke={isDark ? "#94A3B8" : "#64748B"}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
                tickFormatter={formatXAxis}
              />
              <YAxis
                stroke={isDark ? "#94A3B8" : "#64748B"}
                tickLine={false}
                axisLine={false}
                width={68}
                tickFormatter={(value) => `${Math.round(Number(value) / 1000000)}M`}
              />
              <Tooltip
                formatter={(value) => [new Intl.NumberFormat('en-US').format(Number(value ?? 0)), 'Volume']}
                labelFormatter={formatTooltipDate}
                contentStyle={{
                  backgroundColor: isDark ? '#111827' : '#FFFFFF',
                  borderColor: isDark ? '#1F2937' : '#E2E8F0',
                  color: isDark ? '#F8FAFC' : '#0F172A',
                  borderRadius: 12,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                }}
              />
              <Area
                type="monotone"
                dataKey="volume"
                stroke={trendColor}
                strokeWidth={2}
                fill="url(#volumeFill)"
                isAnimationActive={false}
                activeDot={{ r: 5, fill: '#FFFFFF', stroke: trendColor, strokeWidth: 2 }}
              />
            </AreaChart>
          ) : (
            <LineChart data={chartData}>
              <CartesianGrid stroke={isDark ? "rgba(148,163,184,0.12)" : "rgba(0,0,0,0.06)"} vertical={false} />
              <XAxis
                dataKey="datetime"
                stroke={isDark ? "#94A3B8" : "#64748B"}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
                tickFormatter={formatXAxis}
              />
              <YAxis
                stroke={isDark ? "#94A3B8" : "#64748B"}
                tickLine={false}
                axisLine={false}
                width={82}
                tickFormatter={(value) => `₹${Number(value).toFixed(0)}`}
              />
              <Tooltip
                formatter={(value) => [formatValue(Number(value ?? 0), metric), metricLabels[metric]]}
                labelFormatter={formatTooltipDate}
                contentStyle={{
                  backgroundColor: isDark ? '#111827' : '#FFFFFF',
                  borderColor: isDark ? '#1F2937' : '#E2E8F0',
                  color: isDark ? '#F8FAFC' : '#0F172A',
                  borderRadius: 12,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                }}
              />
              <Line
                type="monotone"
                dataKey={metric}
                stroke={trendColor}
                strokeWidth={2.5}
                dot={false}
                connectNulls
                isAnimationActive={false}
                activeDot={{ r: 5, fill: '#FFFFFF', stroke: trendColor, strokeWidth: 2.5 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className={`mt-4 grid gap-2 text-xs uppercase tracking-[0.12em] sm:grid-cols-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        <span>Data Source: IndianAPI</span>
        <span>Data Status: Historical provider data</span>
        <span>
          Last Updated:{' '}
          {chartData[chartData.length - 1]?.datetime
            ? new Date(chartData[chartData.length - 1].datetime).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'N/A'}
        </span>
        <span>Symbol: {symbol}</span>
        <span className="sm:col-span-2">Interval: {interval}</span>
      </div>
    </div>
  );
}
