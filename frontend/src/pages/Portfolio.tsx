import React, { useEffect, useState } from 'react';
import { RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { useTheme } from '../context/ThemeContext';
import { DashboardLayout } from '../components/layout/Sidebar';
import { MARKET_POLL_INTERVAL_MS, marketDataService, type AssetQuote } from '../services/marketDataService';

const watchSymbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'TATAMOTORS', 'ITC', 'WIPRO', 'BHARTIARTL'];
const formatPrice = (price: number | null): string => price == null ? 'N/A' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(price);

export const Portfolio: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [quotes, setQuotes] = useState<AssetQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshQuotes = async () => {
    try {
      const results = await marketDataService.getQuotes(watchSymbols);
      setQuotes(results);
      setError(results.length ? null : 'Market data unavailable.');
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
        const results = await marketDataService.getQuotes(watchSymbols);
        if (!mounted) return;
        setQuotes(results);
        setError(results.length ? null : 'Market data unavailable.');
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

  return (
    <>
      <Navbar />
      <DashboardLayout>
        <div className="space-y-6 p-6 md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2563EB]">NSE delayed quotes</p><h1 className={`mt-2 text-3xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>Portfolio Watchlist</h1><p className={`mt-1 text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>Actual provider prices only; this view does not represent owned positions.</p></div>
            <button type="button" onClick={() => { setRefreshing(true); void refreshQuotes(); }} disabled={loading || refreshing} className="inline-flex items-center gap-2 self-start rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#1D4ED8] hover:from-[#2563EB] hover:to-[#1E40AF] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)] disabled:opacity-60 transition-all sm:self-auto"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />Refresh</button>
          </div>

          {error && <div role="alert" className="rounded-xl border border-[#E7C2C2] bg-[#FFF6F6] p-4 text-sm text-[#7B3030]">{error}</div>}

          <div className={`overflow-x-auto rounded-2xl border shadow-sm ${isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'}`}>
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className={`border-b text-left text-xs uppercase tracking-[0.12em] ${isDark ? 'border-[#1F2937] bg-[#0B0F19] text-[#94A3B8]' : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]'}`}>
                <th className="px-5 py-4 font-semibold">Stock</th><th className="px-5 py-4 text-right font-semibold">Last Traded</th><th className="px-5 py-4 text-right font-semibold">Day Change</th><th className="px-5 py-4 text-right font-semibold">Open</th><th className="px-5 py-4 text-right font-semibold">High / Low</th><th className="px-5 py-4 text-right font-semibold">Volume</th><th className="px-5 py-4 text-right font-semibold">Provider Time</th>
              </tr></thead>
              <tbody>
                {quotes.map((quote) => <tr key={quote.symbol} className={`border-b last:border-0 transition-colors ${isDark ? 'border-[#1F2937] hover:bg-[#1F2937]/50' : 'border-[#E2E8F0] hover:bg-[#F8FAFC]'}`}>
                  <td className="px-5 py-4"><div className={`font-semibold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{quote.symbol}</div><div className={`mt-0.5 text-xs ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>{quote.companyName}</div></td>
                  <td className={`px-5 py-4 text-right font-semibold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{formatPrice(quote.price)}</td>
                  <td className={`px-5 py-4 text-right ${quote.change != null && quote.change >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {quote.change != null && (quote.change >= 0 ? <TrendingUp size={14} className="mr-1 inline" /> : <TrendingDown size={14} className="mr-1 inline" />)}
                    {quote.change == null || quote.changePercent == null ? 'N/A' : `${quote.change >= 0 ? '+' : ''}${quote.change.toFixed(2)} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)`}
                  </td>
                  <td className={`px-5 py-4 text-right ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{formatPrice(quote.open)}</td>
                  <td className={`px-5 py-4 text-right ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{formatPrice(quote.dayHigh)} / {formatPrice(quote.dayLow)}</td>
                  <td className={`px-5 py-4 text-right ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{quote.volume == null ? 'N/A' : new Intl.NumberFormat('en-IN').format(quote.volume)}</td>
                  <td className={`px-5 py-4 text-right text-xs ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>{quote.timestamp ? new Date(quote.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}</td>
                </tr>)}
                {!quotes.length && !loading && <tr><td colSpan={7} className={`px-5 py-12 text-center text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>Market data unavailable.</td></tr>}
                {loading && !quotes.length && <tr><td colSpan={7} className={`px-5 py-12 text-center text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>Loading provider quotes...</td></tr>}
              </tbody>
            </table>
          </div>
          <div className={`text-right text-xs ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>Source: IndianAPI · Batch refresh: {Math.round(MARKET_POLL_INTERVAL_MS / 1000)} seconds · Market may be closed.</div>
        </div>
      </DashboardLayout>
    </>
  );
};