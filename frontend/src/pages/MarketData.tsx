import React, { useEffect, useRef, useState } from 'react';
import { Activity, Clock3, Database, RefreshCw, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MarketChart } from '../components/MarketChart';
import { Navbar } from '../components/layout/Navbar';
import { useTheme } from '../context/ThemeContext';
import { DashboardLayout } from '../components/layout/Sidebar';
import { MARKET_POLL_INTERVAL_MS, marketDataService, type AssetQuote, type IntradayPoint, type MarketHistoryPoint } from '../services/marketDataService';

const supportedSymbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'TATAMOTORS', 'ITC', 'WIPRO', 'BHARTIARTL'];
const periodOptions = [
  { label: '1 Month', value: '1m' },
  { label: '6 Months', value: '6m' },
  { label: '1 Year', value: '1yr' },
  { label: '3 Years', value: '3yr' },
  { label: '5 Years', value: '5yr' },
  { label: '10 Years', value: '10yr' },
  { label: 'Maximum', value: 'max' },
];

const formatCurrency = (value: number | null | undefined): string => {
  if (value == null) return 'N/A';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
};

const formatTimestamp = (value: string | null | undefined): string => value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A';

export const MarketData: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [searchTerm, setSearchTerm] = useState('RELIANCE');
  const [selectedSymbol, setSelectedSymbol] = useState('RELIANCE');
  const [period, setPeriod] = useState('1yr');
  const [quote, setQuote] = useState<AssetQuote | null>(null);
  const [history, setHistory] = useState<MarketHistoryPoint[]>([]);
  const [intraday, setIntraday] = useState<IntradayPoint[]>([]);
  const [intradayTimestamp, setIntradayTimestamp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshLock = useRef(false);

  const loadSelectedData = async (symbol: string, nextPeriod = period) => {
    setLoading(true);
    setError(null);
    try {
      const [quoteResult, historyResult, intradayResult] = await Promise.allSettled([
        marketDataService.getQuote(symbol),
        marketDataService.getHistory(symbol, nextPeriod),
        marketDataService.getIntraday(symbol),
      ]);

      // Quote is the primary data — surface its error if it failed
      if (quoteResult.status === 'rejected') {
        throw quoteResult.reason;
      }
      setQuote(quoteResult.value);

      // History is important but non-fatal if it fails
      if (historyResult.status === 'fulfilled') {
        setHistory(historyResult.value);
      } else {
        setHistory([]);
      }

      // Intraday may 404 on free tier — silently set to empty
      if (intradayResult.status === 'fulfilled') {
        setIntraday(intradayResult.value?.data ?? []);
        setIntradayTimestamp(intradayResult.value?.timestamp ?? null);
      } else {
        setIntraday([]);
        setIntradayTimestamp(null);
      }
    } catch (err) {
      setQuote(null);
      setHistory([]);
      setIntraday([]);
      setIntradayTimestamp(null);
      setError(err instanceof Error ? err.message : 'Unable to retrieve market data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      await Promise.resolve();
      if (mounted) await loadSelectedData(selectedSymbol);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [selectedSymbol]);

  useEffect(() => {
    const refreshQuote = async () => {
      if (refreshLock.current) return;
      refreshLock.current = true;
      try {
        const updatedQuote = await marketDataService.getQuote(selectedSymbol);
        setQuote(updatedQuote);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to retrieve market data.');
      } finally {
        refreshLock.current = false;
      }
    };
    const timer = window.setInterval(() => void refreshQuote(), MARKET_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [selectedSymbol]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const symbol = searchTerm.trim().toUpperCase().split(':')[0];
    if (!symbol) {
      setError('Invalid or unsupported stock symbol.');
      return;
    }
    setSelectedSymbol(symbol);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSelectedData(selectedSymbol);
    setRefreshing(false);
  };

  const currentPrice = quote?.price ?? null;
  const dailyChange = quote?.change;
  const percentageChange = quote?.changePercent;
  const latestQuoteTimestamp = quote?.timestamp ?? intradayTimestamp;

  return (
    <>
      <Navbar />
      <DashboardLayout>
        <div className="space-y-6 p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[#2563EB]">Indian markets</p>
              <h1 className={`mt-2 text-3xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>MARKET DATA</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'} ${error ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                <span className={`h-2 w-2 rounded-full ${error ? 'bg-[#EF4444]' : 'bg-[#10B981]'}`} /> {quote?.dataStatus ?? (error ? 'UNAVAILABLE' : 'DELAYED DATA')}
              </span>
              <button type="button" onClick={() => void handleRefresh()} disabled={loading || refreshing} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#1D4ED8] hover:from-[#2563EB] hover:to-[#1E40AF] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)] disabled:opacity-60 transition-all">
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          {error && <div role="alert" className="rounded-xl border border-[#E7C2C2] bg-[#FFF6F6] p-4 text-sm text-[#7B3030]">{error}{error.includes('not configured') && <p className="mt-2">Add your IndianAPI key to <code>backend/.env</code> as <code>INDIAN_API_KEY</code>, then restart FastAPI.</p>}</div>}

          <section className={`grid gap-4 rounded-2xl border p-4 shadow-sm md:grid-cols-[minmax(220px,1fr)_220px_auto] ${isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'}`}>
            <form onSubmit={handleSearch} className="space-y-2">
              <label htmlFor="stock-symbol" className={`text-xs font-semibold uppercase tracking-[0.16em] ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>Stock search</label>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`} />
                  <input id="stock-symbol" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="RELIANCE" className={`w-full rounded-xl border py-3 pl-10 pr-3 text-sm outline-none ${isDark ? 'border-[#1F2937] bg-[#0B0F19] text-white focus:border-[#2563EB]' : 'border-[#E2E8F0] bg-white text-[#0F172A] focus:border-[#2563EB]'}`} />
                </div>
                <button type="submit" className="rounded-xl border border-[#2563EB] bg-[#2563EB]/10 px-4 text-sm font-semibold text-[#3B82F6] hover:bg-[#2563EB]/20 transition-colors">Search</button>
              </div>
            </form>
            <label className="space-y-2">
              <span className={`block text-xs font-semibold uppercase tracking-[0.16em] ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>Historical period</span>
              <select value={period} onChange={(event) => { setPeriod(event.target.value); void loadSelectedData(selectedSymbol, event.target.value); }} className={`w-full rounded-xl border px-3 py-3 text-sm outline-none ${isDark ? 'border-[#1F2937] bg-[#0B0F19] text-white focus:border-[#2563EB]' : 'border-[#E2E8F0] bg-white text-[#0F172A] focus:border-[#2563EB]'}`}>
                {periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <div className="space-y-2">
              <span className={`block text-xs font-semibold uppercase tracking-[0.16em] ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>Symbol selector</span>
              <select value={supportedSymbols.includes(selectedSymbol) ? selectedSymbol : ''} onChange={(event) => { setSearchTerm(event.target.value); setSelectedSymbol(event.target.value); }} className={`w-full rounded-xl border px-3 py-3 text-sm outline-none ${isDark ? 'border-[#1F2937] bg-[#0B0F19] text-white focus:border-[#2563EB]' : 'border-[#E2E8F0] bg-white text-[#0F172A] focus:border-[#2563EB]'}`}>
                {!supportedSymbols.includes(selectedSymbol) && <option value="">Choose symbol</option>}
                {supportedSymbols.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}
              </select>
            </div>
          </section>

          <section className={`grid gap-5 rounded-2xl border p-5 shadow-sm md:grid-cols-[1fr_auto] md:items-end ${isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'}`}>
            <div>
              <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}><Database size={14} /> {selectedSymbol} · IndianAPI</div>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <h2 className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{formatCurrency(currentPrice)}</h2>
                {dailyChange != null && percentageChange != null && <span className={`inline-flex items-center gap-1 text-sm font-semibold ${dailyChange >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                  {dailyChange >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {dailyChange >= 0 ? '+' : ''}{dailyChange.toFixed(2)} ({percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(2)}%)
                </span>}
              </div>
              <p className={`mt-1 text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>{quote?.companyName ?? selectedSymbol}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:text-right">
              <span className={isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}>Market status</span><span className={`font-medium ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{quote?.marketStatus ?? 'Unavailable'}</span>
              <span className={isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}>Last updated</span><span className={`font-medium ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{formatTimestamp(latestQuoteTimestamp)}</span>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Open', value: quote?.open },
              { label: 'High', value: quote?.dayHigh },
              { label: 'Low', value: quote?.dayLow },
              { label: 'Previous Close', value: quote?.previousClose },
              { label: 'Volume', value: quote?.volume == null ? 'N/A' : new Intl.NumberFormat('en-IN').format(quote.volume) },
              { label: 'Day Change', value: quote?.change == null ? 'N/A' : formatCurrency(quote.change) },
              { label: '52 Week High', value: formatCurrency(quote?.fiftyTwoWeekHigh) },
              { label: '52 Week Low', value: formatCurrency(quote?.fiftyTwoWeekLow) },
            ].map((item) => <div key={item.label} className={`rounded-xl border p-4 ${isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'}`}>
              <div className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>{item.label}</div>
              <div className={`mt-2 text-base font-semibold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{typeof item.value === 'number' ? formatCurrency(item.value) : item.value}</div>
            </div>)}
          </section>

          <MarketChart data={history} symbol={selectedSymbol} interval={periodOptions.find((item) => item.value === period)?.label ?? period} loading={loading} />

          <section className={`rounded-2xl border p-5 shadow-sm ${isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'}`}>
            <div className={`mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}><Activity size={16} className="text-[#3B82F6]" /><h3 className="text-lg font-semibold">INTRADAY PRICE</h3></div>
            {intraday.length ? <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={intraday}>
                  <defs><linearGradient id="intradayFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#3B82F6" stopOpacity={0.25} /><stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid stroke={isDark ? '#1F2937' : '#E8EBF0'} vertical={false} />
                  <XAxis dataKey="time" stroke={isDark ? '#94A3B8' : '#64748B'} tickFormatter={(value) => String(value).slice(-8, -3)} minTickGap={28} />
                  <YAxis width={75} stroke={isDark ? '#94A3B8' : '#64748B'} tickFormatter={(value) => `₹${Number(value).toFixed(0)}`} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#111827' : '#FFFFFF',
                      borderColor: isDark ? '#1F2937' : '#E2E8F0',
                      borderRadius: '12px',
                      color: isDark ? '#FFFFFF' : '#0F172A',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    }}
                    formatter={(value) => [formatCurrency(Number(value)), `${selectedSymbol} Price`]}
                    labelFormatter={(value) => `Time: ${String(value).slice(-8, -3)} IST`}
                  />
                  <Area type="monotone" dataKey="price" stroke="#3B82F6" strokeWidth={2} fill="url(#intradayFill)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div> : <div className={`rounded-xl border border-dashed p-8 text-center text-sm ${isDark ? "border-[#1F2937] bg-[#0B0F19] text-[#94A3B8]" : "border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]"}`}>Intraday market data unavailable for this symbol or session.</div>}
            <div className={`mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t pt-3 text-xs ${isDark ? "border-[#1F2937] text-[#94A3B8]" : "border-[#E2E8F0] text-[#64748B]"}`}>
              <span>Symbol: {selectedSymbol}</span><span>Source: IndianAPI</span><span>Last Updated: {formatTimestamp(intradayTimestamp)}</span><span><Clock3 size={12} className="mr-1 inline" /> Five-minute session data</span>
            </div>
          </section>
        </div>
      </DashboardLayout>
    </>
  );
};