import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { DashboardLayout } from '../components/layout/Sidebar';
import { Button, Card } from '../components/common/Button';
import { useTheme } from '../context/ThemeContext';
import { MARKET_POLL_INTERVAL_MS, marketDataService, type MarketOverview } from '../services/marketDataService';

const asRows = (value: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
  if (value && typeof value === 'object') {
    const nested = Object.values(value).find(Array.isArray);
    if (Array.isArray(nested)) return nested.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
  }
  return [];
};

const numeric = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const result = Number(String(value).replace(/,/g, '').replace('%', ''));
  return Number.isFinite(result) ? result : null;
};

const formatPrice = (value: unknown): string => {
  const price = numeric(value);
  return price == null ? 'N/A' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(price);
};

const displayName = (row: Record<string, unknown>): string => String(row.name ?? row.company ?? row.company_name ?? row.displayName ?? row.ticker ?? row.ticker_id ?? 'Stock');

const weekRangeRows = (value: unknown, field: 'high52Week' | 'low52Week'): Array<Record<string, unknown>> => {
  if (!value || typeof value !== 'object') return [];
  const rows: Array<Record<string, unknown>> = [];
  for (const nested of Object.values(value)) {
    if (!nested || typeof nested !== 'object') continue;
    const records = (nested as Record<string, unknown>)[field];
    if (Array.isArray(records)) rows.push(...asRows(records));
    else rows.push(...weekRangeRows(nested, field));
  }
  return rows;
};

const marketIndices = (overview: MarketOverview | null) => {
  const indices = asRows(overview?.indices);
  return [
    { label: 'NIFTY 50', match: (name: string) => name.includes('nifty 50') },
    { label: 'SENSEX', match: (name: string) => name.includes('sensex') },
    { label: 'BANK NIFTY', match: (name: string) => name.includes('bank nifty') || name.includes('nifty bank') },
  ].map((target) => ({
    label: target.label,
    item: indices.find((row) => target.match(String(row.name ?? '').toLowerCase())),
  }));
};

const StockList = ({ title, rows, unavailable }: { title: string; rows: Array<Record<string, unknown>>; unavailable: boolean }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <Card className={isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'}>
      <h2 className={`mb-4 text-lg font-semibold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{title}</h2>
      {unavailable ? (
        <p className={`text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>Market data unavailable for this endpoint.</p>
      ) : rows.length ? (
        <div className={`divide-y ${isDark ? 'divide-[#1F2937]' : 'divide-[#E2E8F0]'}`}>
          {rows.slice(0, 5).map((row, index) => {
            const change = numeric(row.percent_change ?? row.percentChange);
            return (
              <div key={`${displayName(row)}-${index}`} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className={`truncate text-sm font-medium ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{displayName(row)}</p>
                  <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>{String(row.ticker ?? row.exchange_type ?? '')}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>₹{formatPrice(row.price ?? row.ltp)}</p>
                  <p className={`text-xs font-semibold ${change != null && change >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {change == null ? 'Change N/A' : `${change > 0 ? '+' : ''}${change.toFixed(2)}%`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className={`text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>No provider data available.</p>
      )}
    </Card>
  );
};

export const Dashboard: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshOverview = async () => {
    try {
      const data = await marketDataService.getOverview();
      setOverview(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to retrieve market data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await marketDataService.getOverview();
        if (!mounted) return;
        setOverview(data);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Unable to retrieve market data.');
      } finally {
        if (mounted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), MARKET_POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const trending = overview?.trending;
  const indices = marketIndices(overview);
  const nseActive = asRows(overview?.nseMostActive);
  const bseActive = asRows(overview?.bseMostActive);
  const gainers = asRows(trending?.top_gainers);
  const losers = asRows(trending?.top_losers);
  const hasOverview = !!overview;
  const unavailable = overview?.unavailable ?? [];
  const weekHighs = weekRangeRows(overview?.weekHighLow, 'high52Week');
  const weekLows = weekRangeRows(overview?.weekHighLow, 'low52Week');
  const latestIndex = asRows(overview?.indices).find((row) => row.date || row.time);

  return (
    <>
      <Navbar />
      <DashboardLayout>
        <div className="space-y-6 p-6 md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2563EB]">Indian equities · provider delayed</p>
              <h1 className={`mt-2 text-3xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>Market Overview</h1>
              <p className={`mt-1 text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>NSE and BSE market data from IndianAPI</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>
                Last provider update: {latestIndex ? `${String(latestIndex.date ?? '')} ${String(latestIndex.time ?? '')}` : 'N/A'}
              </span>
              <span className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>· {Math.round(MARKET_POLL_INTERVAL_MS / 1000)} sec</span>
              <button
                type="button"
                onClick={() => { setRefreshing(true); void refreshOverview(); }}
                disabled={refreshing || loading}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#1D4ED8] hover:from-[#2563EB] hover:to-[#1E40AF] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)] disabled:opacity-60 transition-all"
              >
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/15 p-4 text-sm text-[#EF4444]">
              {error}
              {error.includes('not configured') && (
                <p className="mt-2 text-xs">Add your IndianAPI key to <code>backend/.env</code> as <code>INDIAN_API_KEY</code>, then restart FastAPI.</p>
              )}
            </div>
          )}

          <section className="grid gap-4 md:grid-cols-3">
            {indices.map(({ label, item }) => {
              const change = numeric(item?.percentChange);
              return (
                <div
                  key={label}
                  className={`rounded-2xl border p-5 shadow-sm transition-all ${
                    isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>{label}</span>
                    <Activity size={16} className="text-[#3B82F6]" />
                  </div>
                  {item ? (
                    <>
                      <div className={`mt-4 text-3xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{formatPrice(item.price)}</div>
                      <div className={`mt-2 flex items-center gap-1 text-sm font-medium ${change != null && change >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                        {change != null && (change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />)}
                        {change == null ? 'Change unavailable' : `${numeric(item.netChange) != null && numeric(item.netChange)! > 0 ? '+' : ''}${formatPrice(item.netChange)} · ${change > 0 ? '+' : ''}${change.toFixed(2)}%`}
                      </div>
                      <div className={`mt-2 text-xs ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>{String(item.date ?? '')} {String(item.time ?? '')}</div>
                    </>
                  ) : (
                    <div className={`mt-4 text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>{loading ? 'Loading provider data...' : 'Index data unavailable.'}</div>
                  )}
                </div>
              );
            })}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <StockList title="Trending Gainers" rows={gainers} unavailable={unavailable.includes('trending') || !hasOverview} />
            <StockList title="Trending Losers" rows={losers} unavailable={unavailable.includes('trending') || !hasOverview} />
            <StockList title="NSE Most Active" rows={nseActive} unavailable={unavailable.includes('nseMostActive') || !hasOverview} />
            <StockList title="BSE Most Active" rows={bseActive} unavailable={unavailable.includes('bseMostActive') || !hasOverview} />
            <StockList title="52 Week Highs" rows={weekHighs} unavailable={unavailable.includes('weekHighLow') || !hasOverview} />
            <StockList title="52 Week Lows" rows={weekLows} unavailable={unavailable.includes('weekHighLow') || !hasOverview} />
          </div>

          <section className={`flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${
            isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'
          }`}>
            <div>
              <h2 className={`font-semibold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>Explore a stock</h2>
              <p className={`mt-1 text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>Quotes, historical prices, DMA, volume, and intraday session data.</p>
            </div>
            <Link to="/market-data"><Button className="gap-2"><Activity size={16} />Open Market Data</Button></Link>
          </section>

          <div className={`text-right text-xs ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>Source: IndianAPI · Quotes may be delayed or stale outside market hours.</div>
        </div>
      </DashboardLayout>
    </>
  );
};
