import React, { useEffect, useState, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Navbar } from '../components/layout/Navbar';
import { useTheme } from '../context/ThemeContext';
import { DashboardLayout } from '../components/layout/Sidebar';
import { marketDataService, type MarketHistoryPoint } from '../services/marketDataService';

const symbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'TATAMOTORS', 'ITC', 'WIPRO', 'BHARTIARTL'];
const periods = [{ label: '1m', value: '1m' }, { label: '6m', value: '6m' }, { label: '1yr', value: '1yr' }, { label: '3yr', value: '3yr' }, { label: '5yr', value: '5yr' }, { label: '10yr', value: '10yr' }, { label: 'max', value: 'max' }];
const colors = ['#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#F59E0B', '#06B6D4'];
type Series = { symbol: string; history: MarketHistoryPoint[] };

export const Compare: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [selectedSymbols, setSelectedSymbols] = useState(['RELIANCE', 'TCS', 'INFY']);
  const [period, setPeriod] = useState('1yr');
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    const load = async () => {
      if (!selectedSymbols.length) {
        setSeries([]);
        return;
      }
      setLoading(true);
      setError(null);
      const results = await Promise.allSettled(
        selectedSymbols.map(async (symbol) => ({
          symbol,
          history: await marketDataService.getHistory(symbol, period, 'price'),
        }))
      );
      if (!current) return;
      const loaded = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
      setSeries(loaded);
      if (loaded.length < selectedSymbols.length) {
        setError('Some selected symbols are unavailable from the provider.');
      }
      setLoading(false);
    };
    void load();
    return () => {
      current = false;
    };
  }, [selectedSymbols, period]);

  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols((current) =>
      current.includes(symbol)
        ? current.filter((item) => item !== symbol)
        : current.length < 6
        ? [...current, symbol]
        : current
    );
  };

  const chartData = useMemo(() => {
    if (!series.length) return [];
    const dates = Array.from(new Set(series.flatMap((item) => item.history.map((point) => point.datetime)))).sort();
    const seriesMaps = series.map((s) => ({
      symbol: s.symbol,
      base: s.history[0]?.close || 1,
      map: new Map(s.history.map((p) => [p.datetime, p.close])),
    }));

    return dates.map((date) => {
      const row: Record<string, string | number | null> = { date };
      for (const sm of seriesMaps) {
        const close = sm.map.get(date);
        row[sm.symbol] = close != null ? Number(((close / sm.base) * 100).toFixed(2)) : null;
      }
      return row;
    });
  }, [series]);

  return (
    <>
      <Navbar />
      <DashboardLayout>
        <div className="space-y-6 p-6 md:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2563EB]">Provider history</p>
              <h1 className={`mt-2 text-3xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>Stock Comparison</h1>
              <p className={`mt-1 text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>
                Historical price performance indexed to 100 at the start of the selected period.
              </p>
            </div>
            <label className={`text-xs font-semibold uppercase tracking-[0.14em] ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>
              Period
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className={`mt-2 block rounded-xl border px-3 py-2.5 text-sm outline-none ${
                  isDark
                    ? 'border-[#1F2937] bg-[#0B0F19] text-white focus:border-[#2563EB]'
                    : 'border-[#E2E8F0] bg-white text-[#0F172A] focus:border-[#2563EB]'
                }`}
              >
                {periods.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <section className={`rounded-2xl border p-4 ${isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'}`}>
            <div className={`mb-3 text-xs font-semibold uppercase tracking-[0.16em] ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>
              Symbols · up to six
            </div>
            <div className="flex flex-wrap gap-2">
              {symbols.map((symbol) => {
                const isSelected = selectedSymbols.includes(symbol);
                const selectedIdx = selectedSymbols.indexOf(symbol);
                const symbolColor = isSelected ? colors[selectedIdx % colors.length] : undefined;
                return (
                  <button
                    key={symbol}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleSymbol(symbol)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-[#2563EB] bg-[#2563EB]/15 text-[#3B82F6] font-semibold shadow-sm'
                        : isDark
                        ? 'border-[#1F2937] text-[#94A3B8] hover:border-slate-700 hover:bg-[#1F2937]/50'
                        : 'border-[#E2E8F0] text-[#64748B] hover:border-slate-300 hover:bg-[#F8FAFC]'
                    }`}
                  >
                    {isSelected && (
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: symbolColor }}
                      />
                    )}
                    <span>{symbol}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {error && (
            <div role="status" className="rounded-xl border border-[#E7C2C2] bg-[#FFF6F6] p-4 text-sm text-[#7B3030]">
              {error}
            </div>
          )}

          <section className={`rounded-2xl border p-5 ${isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'}`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className={`font-semibold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>Historical Performance (Indexed to 100)</h2>
              {loading && <RefreshCw size={15} className="animate-spin text-[#3B82F6]" />}
            </div>
            {chartData.length ? (
              <div className="h-[380px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid stroke={isDark ? '#1F2937' : '#E2E8F0'} vertical={false} />
                    <XAxis
                      dataKey="date"
                      minTickGap={32}
                      stroke={isDark ? '#94A3B8' : '#64748B'}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      stroke={isDark ? '#94A3B8' : '#64748B'}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(val) => `${Number(val).toFixed(0)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#111827' : '#FFFFFF',
                        borderColor: isDark ? '#1F2937' : '#E2E8F0',
                        borderRadius: '12px',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                      }}
                      labelFormatter={(value) => `Date: ${value}`}
                      formatter={(value: any, name: any) => [
                        value == null ? 'N/A' : `${Number(value).toFixed(2)} pts`,
                        String(name),
                      ]}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ paddingBottom: '12px' }}
                    />
                    {series.map((item, index) => (
                      <Line
                        key={item.symbol}
                        type="monotone"
                        dataKey={item.symbol}
                        name={item.symbol}
                        stroke={colors[index % colors.length]}
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className={`rounded-xl border border-dashed p-10 text-center text-sm ${isDark ? 'border-[#1F2937] bg-[#0B0F19] text-[#94A3B8]' : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]'}`}>
                {loading ? 'Loading provider history...' : 'No historical data available.'}
              </div>
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {series.map((item, index) => {
              const first = item.history[0]?.close;
              const last = item.history[item.history.length - 1]?.close;
              const change = first && last ? ((last - first) / first) * 100 : null;
              const color = colors[index % colors.length];
              return (
                <div
                  key={item.symbol}
                  className={`rounded-xl border p-4 shadow-sm ${isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className={isDark ? 'text-white' : 'text-[#0F172A]'}>{item.symbol}</span>
                    </span>
                    <span className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>IndianAPI</span>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <span className={`text-xs block ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>
                        ₹{last?.toFixed(2) ?? 'N/A'} (base: ₹{first?.toFixed(2) ?? 'N/A'})
                      </span>
                      <span className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>
                        {item.history.length} trading days
                      </span>
                    </div>
                    <span
                      className={`text-lg font-bold ${
                        change != null && change >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }`}
                    >
                      {change == null ? 'N/A' : `${change > 0 ? '+' : ''}${change.toFixed(2)}%`}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                </div>
              );
            })}
          </section>
          <p className={`text-right text-xs ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>
            Source: IndianAPI · Period: {period} · Historical performance does not guarantee future results.
          </p>
        </div>
      </DashboardLayout>
    </>
  );
};