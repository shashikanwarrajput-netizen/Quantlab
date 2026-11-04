import React, { useEffect, useState } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  TrendingUp,
  BarChart2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RotateCcw,
  Code2,
  Eye,
  EyeOff,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { useTheme } from '../context/ThemeContext';
import { DashboardLayout } from '../components/layout/Sidebar';
import { Card, Button, Input, LoadingSpinner } from '../components/common/Button';
import {
  marketDataService,
  getSavedAnalytics,
  getActiveUserKey,
  type QuantAlgorithmResult,
  type AIChatResponse,
} from '../services/marketDataService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  provider?: string;
  technicalSummary?: AIChatResponse['technical_summary'];
}

const POPULAR_SYMBOLS = [
  'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK',
  'SBIN', 'TATAMOTORS', 'ITC', 'WIPRO', 'BHARTIARTL',
];

const PROMPT_CATEGORIES = [
  {
    category: 'Live Technicals',
    prompts: [
      'Analyze live RSI and moving average regime for {symbol}',
      'Which established algorithm best fits current market structure?',
      'Compare strategy performance vs buy-and-hold benchmark',
    ],
  },
  {
    category: 'Options & Derivatives',
    prompts: [
      'What is an option straddle and how do Greeks affect it?',
      'Explain Delta, Gamma, Theta, and Vega with examples',
      'How to hedge downside risk on equity portfolios using puts?',
    ],
  },
  {
    category: 'Risk & Mathematics',
    prompts: [
      'Explain the difference between Sharpe Ratio and Sortino Ratio',
      'How does the Kelly Criterion calculate optimal position sizing?',
      'What are Indian STCG and LTCG equity taxation rules?',
    ],
  },
];

const renderFormattedInline = (text: string, isDark: boolean = false): React.ReactNode => {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className={`font-semibold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <span
          key={i}
          className={`px-1.5 py-0.5 rounded font-mono text-xs ${
            isDark ? 'bg-[#2563EB]/20 text-[#60A5FA]' : 'bg-[#EEF4FF] text-[#2563EB]'
          }`}
        >
          {part.slice(1, -1)}
        </span>
      );
    }
    return part;
  });
};

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language = 'python' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[#1E293B] bg-[#0F172A] text-slate-100 text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1E293B] text-[11px] text-slate-400">
        <span className="font-mono flex items-center gap-1.5">
          <Code2 size={13} className="text-[#38BDF8]" />
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition px-2 py-0.5 rounded bg-slate-800"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3 overflow-x-auto font-mono text-[11.5px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const FormattedMessage: React.FC<{ content: string }> = ({ content }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const segments = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className={`space-y-2 text-sm leading-relaxed ${isDark ? 'text-slate-100' : 'text-[#0F172A]'}`}>
      {segments.map((segment, sIdx) => {
        if (segment.startsWith('```') && segment.endsWith('```')) {
          const firstLineEnd = segment.indexOf('\n');
          const lang = segment.slice(3, firstLineEnd).trim() || 'python';
          const code = segment.slice(firstLineEnd + 1, -3);
          return <CodeBlock key={sIdx} code={code} language={lang} />;
        }

        const lines = segment.split('\n');
        return (
          <div key={sIdx} className="space-y-1.5">
            {lines.map((line, idx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={idx} className="h-1" />;
              if (trimmed.startsWith('## ')) {
                return (
                  <h2 key={idx} className={`text-base font-bold mt-2 mb-1 flex items-center gap-2 ${isDark ? "text-white" : "text-[#0F172A]"}`}>
                    <Bot size={18} className="text-[#3B82F6]" />
                    {trimmed.replace(/^##\s+/, '')}
                  </h2>
                );
              }
              if (trimmed.startsWith('### ')) {
                return (
                  <h3 key={idx} className={`text-sm font-bold mt-3 mb-1 pb-0.5 border-b ${isDark ? "text-[#60A5FA] border-[#1F2937]" : "text-[#2563EB] border-[#E2E8F0]"}`}>
                    {trimmed.replace(/^###\s+/, '')}
                  </h3>
                );
              }
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const itemText = trimmed.replace(/^[-*]\s+/, '');
                return (
                  <div key={idx} className="flex items-start gap-2 ml-1 text-xs sm:text-sm">
                    <span className={`font-bold mt-0.5 ${isDark ? "text-[#3B82F6]" : "text-[#2563EB]"}`}>•</span>
                    <div>{renderFormattedInline(itemText, isDark)}</div>
                  </div>
                );
              }
              return <p key={idx} className="text-xs sm:text-sm">{renderFormattedInline(trimmed, isDark)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
};

const generateMsgId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const formatMsgTime = (): string =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const getWelcomeMessage = (): Message => ({
  id: 'welcome',
  role: 'assistant',
  content: `## QuantLab Universal Quantitative AI Assistant
Hello! I am your AI Quantitative Analyst and Trading Assistant. Ask me **anything** about:

- **Algorithmic Trading**: SMA crossovers, RSI mean reversion, Bollinger bands, MACD.
- **Quantitative Mathematics**: Sharpe, Sortino, Calmar ratios, Kelly criterion, drawdown formulas.
- **Options & Greeks**: Delta, Gamma, Theta, Vega, straddles, iron condors, Black-Scholes.
- **Live Stock Technicals & Backtests**: Real-time regime diagnostics on Indian equities.`,
  timestamp: formatMsgTime(),
  provider: 'quantlab_engine',
});

export const AIAssistant: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      const key = `quantlab_ai_chat_history_${getActiveUserKey()}`;
      const saved = sessionStorage.getItem(key);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // fallback
        }
      }
    }
    return [getWelcomeMessage()];
  });

  const [input, setInput] = useState('');
  const [symbol, setSymbol] = useState('RELIANCE');
  const [isLoading, setIsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const [latestBacktest, setLatestBacktest] = useState<QuantAlgorithmResult | null>(null);

  // User preference: Answer with or without backtest data
  const [includeBacktest, setIncludeBacktest] = useState<boolean>(true);

  // User preference: Hide or unhide automated questions
  const [showSuggestions, setShowSuggestions] = useState<boolean>(true);

  // User preference: Expandable spacious chat window (toggle metrics sidebar)
  const [showSidebar, setShowSidebar] = useState<boolean>(true);

  // Save chat to sessionStorage scoped by user
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const key = `quantlab_ai_chat_history_${getActiveUserKey()}`;
      sessionStorage.setItem(key, JSON.stringify(messages));
    }
  }, [messages]);

  // Reload chat on auth switch
  useEffect(() => {
    const handleAuthChange = () => {
      const userKey = getActiveUserKey();
      const chatKey = `quantlab_ai_chat_history_${userKey}`;
      const saved = sessionStorage.getItem(chatKey);
      if (saved) {
        try {
          setMessages(JSON.parse(saved));
        } catch {
          setMessages([getWelcomeMessage()]);
        }
      } else {
        setMessages([getWelcomeMessage()]);
      }
    };
    window.addEventListener('quantlab-auth-changed', handleAuthChange);
    return () => window.removeEventListener('quantlab-auth-changed', handleAuthChange);
  }, []);

  const loadLatestBacktest = (sym: string) => {
    const saved = getSavedAnalytics();
    const cleanSym = sym.split(':')[0].trim().toUpperCase();
    const matching = saved.find((item) => item.symbol.toUpperCase() === cleanSym) || saved[0] || null;
    setLatestBacktest(matching);
  };

  useEffect(() => {
    let active = true;
    const fetchLatest = async () => {
      await Promise.resolve();
      if (!active) return;
      const saved = getSavedAnalytics();
      const cleanSym = symbol.split(':')[0].trim().toUpperCase();
      const matching = saved.find((item) => item.symbol.toUpperCase() === cleanSym) || saved[0] || null;
      setLatestBacktest(matching);
    };
    void fetchLatest();
    const handleUpdate = () => void fetchLatest();
    window.addEventListener('quantlab-analytics-updated', handleUpdate);
    return () => {
      active = false;
      window.removeEventListener('quantlab-analytics-updated', handleUpdate);
    };
  }, [symbol]);

  const handleClearChat = () => {
    if (confirm('Clear entire conversation history?')) {
      const resetMsg: Message = {
        id: 'reset',
        role: 'assistant',
        content: `Conversation cleared. Ask me any question about quantitative trading, mathematical finance, options, or live Indian market technicals!`,
        timestamp: formatMsgTime(),
        provider: 'quantlab_engine',
      };
      setMessages([resetMsg]);
      const key = `quantlab_ai_chat_history_${getActiveUserKey()}`;
      sessionStorage.removeItem(key);
    }
  };

  const handleSendMessage = async (textToSend?: string): Promise<void> => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: generateMsgId("user"),
      role: 'user',
      content: text,
      timestamp: formatMsgTime(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    // Format chat history for context
    const historyPayload = nextMessages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await marketDataService.sendAIChatMessage(text, {
        symbol,
        includeBacktest: includeBacktest,
        latestAnalytics: includeBacktest ? latestBacktest : null,
        history: historyPayload,
      });

      const aiMessage: Message = {
        id: generateMsgId("ai"),
        role: 'assistant',
        content: response.response,
        timestamp: formatMsgTime(),
        provider: response.provider,
        technicalSummary: response.technical_summary,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      const errorMessage: Message = {
        id: generateMsgId("err"),
        role: 'assistant',
        content: `**Error retrieving AI analysis**: ${err instanceof Error ? err.message : 'Unable to complete AI request.'}`,
        timestamp: formatMsgTime(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const currentPrompts = PROMPT_CATEGORIES[activeCategory]?.prompts.map((p) =>
    p.replace('{symbol}', symbol)
  ) || [];

  return (
    <>
      <Navbar />
      <DashboardLayout>
        <div className="p-3 sm:p-5 md:p-6 w-full max-w-[1700px] mx-auto h-[calc(100vh-68px)] flex flex-col">
          {/* Top Bar */}
          <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className={`text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2 ${isDark ? "text-white" : "text-[#0F172A]"}`}>
                <Sparkles className="text-[#3B82F6]" size={26} />
                QuantLab Universal AI Assistant
              </h1>
              <p className={`text-xs md:text-sm ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
                Full-spectrum quantitative intelligence, options engineering, & live market analysis
              </p>
            </div>

            {/* Controls: Ticker + Sidebar Toggle + Clear */}
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              {/* Ticker Selector */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shadow-xs text-xs ${isDark ? "border-[#1F2937] bg-[#111827]" : "border-[#E2E8F0] bg-white"}`}>
                <span className={`font-semibold uppercase ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>Ticker:</span>
                <select
                  value={symbol}
                  onChange={(e) => {
                    setSymbol(e.target.value);
                    loadLatestBacktest(e.target.value);
                  }}
                  className={`font-bold bg-transparent outline-none cursor-pointer ${isDark ? "text-white" : "text-[#0F172A]"}`}
                >
                  {POPULAR_SYMBOLS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Toggle Sidebar (Expand Chat Screen) */}
              <button
                type="button"
                onClick={() => setShowSidebar(!showSidebar)}
                className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                  showSidebar
                    ? isDark ? 'border-[#1F2937] bg-[#111827] text-slate-300 hover:bg-[#1F2937]' : 'border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F8FAFC]'
                    : 'bg-[#3B82F6] border-[#2563EB] text-white shadow-xs'
                }`}
                title={showSidebar ? 'Maximize Chat Window' : 'Show Metrics Sidebar'}
              >
                {showSidebar ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
                <span>{showSidebar ? 'Wide Chat' : 'Show Metrics'}</span>
              </button>

              {/* Clear Chat Button */}
              <button
                type="button"
                onClick={handleClearChat}
                className={`p-2 rounded-xl border transition ${isDark ? "border-[#1F2937] bg-[#111827] text-[#94A3B8] hover:text-red-400 hover:border-red-900/50" : "border-[#E2E8F0] bg-white text-[#64748B] hover:text-red-600 hover:border-red-200"}`}
                title="Clear conversation"
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </div>

          {/* Context & Backtest Inclusion Banner */}
          <div className="mb-3">
            {latestBacktest ? (
              <div className={`flex items-center justify-between flex-wrap gap-2 px-3.5 py-2.5 rounded-xl text-xs border transition ${
                includeBacktest
                  ? 'bg-[#EEF4FF] border-[#B9CFF5]'
                  : isDark ? 'bg-[#111827] border-[#1F2937]' : 'bg-[#F8FAFC] border-[#E2E8F0]'
              }`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <CheckCircle2 size={16} className={includeBacktest ? 'text-[#3B82F6] shrink-0' : 'text-slate-400 shrink-0'} />
                  
                  {includeBacktest ? (
                    <>
                      <span className={isDark ? "text-white font-medium" : "text-[#0F172A] font-medium"}>
                        <strong>Backtest Context:</strong> {latestBacktest.symbol} -- {latestBacktest.algorithm.toUpperCase().replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        latestBacktest.metrics.totalReturnPct >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        Return: {latestBacktest.metrics.totalReturnPct > 0 ? '+' : ''}{latestBacktest.metrics.totalReturnPct.toFixed(2)}%
                      </span>
                      <span className={isDark ? "text-[#94A3B8]" : "text-[#64748B]"}>
                        Sharpe: {latestBacktest.metrics.sharpeRatio != null ? latestBacktest.metrics.sharpeRatio.toFixed(2) : 'N/A'} | Max DD: {latestBacktest.metrics.maxDrawdownPct.toFixed(2)}%
                      </span>
                    </>
                  ) : (
                    <span className={isDark ? "text-[#94A3B8]" : "text-[#64748B]"}>
                      <strong className={isDark ? "text-slate-200" : "text-slate-800"}>General Mode:</strong> Backtest data excluded from AI analysis by user preference.
                    </span>
                  )}
                </div>

                {/* User Choice Toggle: With or Without Backtest Data */}
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
                    Include in Answers:
                  </span>
                  <button
                    type="button"
                    onClick={() => setIncludeBacktest(!includeBacktest)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition border shadow-xs ${
                      includeBacktest
                        ? 'bg-[#3B82F6] text-white border-[#2563EB]'
                        : isDark ? 'border-[#374151] bg-[#1F2937] text-slate-300 hover:border-slate-500' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${includeBacktest ? 'bg-emerald-300 animate-pulse' : 'bg-slate-400'}`} />
                    <span>{includeBacktest ? 'With Backtest Data' : 'Without Backtest Data'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className={`flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-xs border ${isDark ? "border-[#1F2937] bg-[#0B0F19] text-[#94A3B8]" : "border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]"}`}>
                <div className="flex items-center gap-2">
                  <AlertCircle size={15} className="text-amber-500 shrink-0" />
                  <span>
                    No backtest loaded. AI is answering in <strong>General Quantitative & Live Market Mode</strong>.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Main Chat Interface (Expanded & Spacious) */}
          <div className="flex-1 grid lg:grid-cols-12 gap-5 min-h-0">
            {/* Chat Messages & Input Area */}
            <div className={`${showSidebar ? 'lg:col-span-9' : 'lg:col-span-12'} flex flex-col border rounded-2xl overflow-hidden shadow-xs transition-all duration-200 ${isDark ? "border-[#1F2937] bg-[#111827]" : "border-[#E2E8F0] bg-white"}`}>
              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[95%] sm:max-w-[90%] rounded-2xl p-4 sm:p-5 ${
                        message.role === 'user'
                          ? 'bg-[#2F4E76] text-[#EAF2EC] border border-[rgba(98,142,120,0.35)] shadow-md'
                          : isDark ? 'bg-[#1F2937]/70 border border-[#1F2937] text-white shadow-md' : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1.5 pb-1 border-b border-black/5 text-[10px] opacity-75">
                        <span className="font-semibold flex items-center gap-1">
                          {message.role === 'user' ? (
                            <>
                              <User size={12} /> You
                            </>
                          ) : (
                            <>
                              <Bot size={12} /> QuantLab AI
                              {message.provider && message.provider !== 'quantlab_engine' && (
                                <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded font-mono font-normal ${isDark ? "bg-[#2563EB]/20 text-[#60A5FA]" : "bg-[#EEF4FF] text-[#2563EB]"}`}>
                                  {message.provider}
                                </span>
                              )}
                            </>
                          )}
                        </span>
                        <span>{message.timestamp}</span>
                      </div>

                      {/* Technical Summary Badge for Assistant Message */}
                      {message.technicalSummary && (
                        <div className={`mb-3 p-2.5 rounded-xl border flex flex-wrap gap-2 text-xs ${isDark ? "border-[#1F2937] bg-[#0B0F19]" : "border-[#E2E8F0] bg-white"}`}>
                          <span className={`font-bold ${isDark ? "text-white" : "text-[#0F172A]"}`}>₹{message.technicalSummary.current_price.toFixed(2)}</span>
                          <span className={`font-semibold ${message.technicalSummary.change_pct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {message.technicalSummary.change_pct > 0 ? '+' : ''}{message.technicalSummary.change_pct.toFixed(2)}%
                          </span>
                          <span className={isDark ? "text-[#94A3B8]" : "text-[#64748B]"}>|</span>
                          <span className={isDark ? "text-[#94A3B8]" : "text-[#64748B]"}>
                            RSI: <strong>{message.technicalSummary.rsi_14.toFixed(1)}</strong>
                          </span>
                          <span className={isDark ? "text-[#94A3B8]" : "text-[#64748B]"}>|</span>
                          <span className={isDark ? "text-[#94A3B8]" : "text-[#64748B]"}>
                            20-DMA: ₹{message.technicalSummary.sma_20.toFixed(1)}
                          </span>
                          <span className={isDark ? "text-[#94A3B8]" : "text-[#64748B]"}>|</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${isDark ? "bg-[#2563EB]/20 text-[#60A5FA]" : "bg-[#EEF4FF] text-[#2563EB]"}`}>
                            {message.technicalSummary.regime}
                          </span>
                        </div>
                      )}

                      {message.role === 'user' ? (
                        <p className="text-sm sm:text-base whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      ) : (
                        <FormattedMessage content={message.content} />
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className={`border px-4 py-3 rounded-2xl flex items-center gap-3 ${isDark ? "border-[#1F2937] bg-[#1F2937]/50" : "border-[#E2E8F0] bg-[#F8FAFC]"}`}>
                      <LoadingSpinner size="sm" />
                      <p className={`text-xs ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
                        QuantLab AI is formulating comprehensive analysis...
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Categorized Quick Query Tabs (Hide/Unhide Supported) */}
              <div className={`border-t px-4 py-2 ${isDark ? "border-[#1F2937] bg-[#0B0F19]" : "border-[#E2E8F0] bg-[#FBFDFF]"}`}>
                {/* Header with Hide / Unhide Toggle */}
                <div className="flex items-center justify-between pb-1">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
                    <Sparkles size={13} className="text-[#3B82F6]" />
                    Automated Questions
                  </span>

                  <button
                    type="button"
                    onClick={() => setShowSuggestions(!showSuggestions)}
                    className={`text-[11px] font-semibold flex items-center gap-1 transition px-2 py-0.5 rounded-md ${
                      isDark ? 'text-[#60A5FA] hover:bg-[#1F2937]' : 'text-[#2563EB] hover:bg-[#EEF4FF]'
                    }`}
                  >
                    {showSuggestions ? (
                      <>
                        <EyeOff size={13} />
                        <span>Hide Questions</span>
                      </>
                    ) : (
                      <>
                        <Eye size={13} />
                        <span>Show Questions</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Collapsible Questions List */}
                {showSuggestions && (
                  <div className="pt-1.5 space-y-2">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold">
                      {PROMPT_CATEGORIES.map((cat, idx) => (
                        <button
                          key={cat.category}
                          type="button"
                          onClick={() => setActiveCategory(idx)}
                          className={`px-3 py-1 rounded-lg text-[11px] whitespace-nowrap transition ${
                            activeCategory === idx
                              ? 'bg-gradient-to-r from-[#3B82F6] to-[#1D4ED8] text-white shadow-xs'
                              : isDark ? 'border border-[#1F2937] bg-[#111827] text-[#94A3B8] hover:bg-[#1F2937]' : 'border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F1F5F9]'
                          }`}
                        >
                          {cat.category}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto py-1">
                      {currentPrompts.map((prompt, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSendMessage(prompt)}
                          disabled={isLoading}
                          className={`text-[11.5px] px-3.5 py-1.5 rounded-full whitespace-nowrap transition border ${
                            isDark
                              ? 'border-[#1F2937] bg-[#111827] text-slate-200 hover:border-[#2563EB] hover:bg-[#1F2937]'
                              : 'border-[#E2E8F0] bg-white text-[#0F172A] hover:border-[#3B82F6] hover:bg-slate-50'
                          }`}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <div className={`p-3 md:p-4 border-t ${isDark ? "border-[#1F2937] bg-[#111827]" : "border-[#E2E8F0] bg-white"}`}>
                <div className="flex gap-2">
                  <Input
                    placeholder={`Ask ANY question (quant, options, or ${symbol} technicals)...`}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && void handleSendMessage()}
                    disabled={isLoading}
                  />
                  <Button
                    onClick={() => void handleSendMessage()}
                    disabled={isLoading || !input.trim()}
                    className="shrink-0 gap-2 px-6"
                  >
                    <Send size={16} />
                    <span className="hidden sm:inline">Send</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Sidebar: Context & Capability Guide (Expandable / Collapsible) */}
            {showSidebar && (
              <div className="lg:col-span-3 space-y-4 overflow-y-auto hidden lg:block">
                {/* Backtest Context */}
                <Card>
                  <h3 className={`text-sm font-semibold mb-3 flex items-center justify-between ${isDark ? "text-white" : "text-[#0F172A]"}`}>
                    <span className="flex items-center gap-2">
                      <BarChart2 size={16} className="text-[#3B82F6]" />
                      Active Backtest Metrics
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      includeBacktest ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {includeBacktest ? 'ACTIVE IN AI' : 'EXCLUDED'}
                    </span>
                  </h3>
                  {latestBacktest ? (
                    <div className="space-y-2 text-xs">
                      <div className={`flex justify-between py-1 border-b ${isDark ? "border-[#1F2937]" : "border-[#E2E8F0]"}`}>
                        <span className={isDark ? "text-[#94A3B8]" : "text-[#64748B]"}>Algorithm</span>
                        <span className={`font-bold ${isDark ? "text-white" : "text-[#0F172A]"}`}>
                          {latestBacktest.algorithm.toUpperCase().replace('_', ' ')}
                        </span>
                      </div>
                      <div className={`flex justify-between py-1 border-b ${isDark ? "border-[#1F2937]" : "border-[#E2E8F0]"}`}>
                        <span className={isDark ? "text-[#94A3B8]" : "text-[#64748B]"}>Symbol</span>
                        <span className={`font-bold ${isDark ? "text-white" : "text-[#0F172A]"}`}>{latestBacktest.symbol}</span>
                      </div>
                      <div className={`flex justify-between py-1 border-b ${isDark ? "border-[#1F2937]" : "border-[#E2E8F0]"}`}>
                        <span className={isDark ? "text-[#94A3B8]" : "text-[#64748B]"}>Total Return</span>
                        <span className={`font-bold ${latestBacktest.metrics.totalReturnPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {latestBacktest.metrics.totalReturnPct > 0 ? '+' : ''}{latestBacktest.metrics.totalReturnPct.toFixed(2)}%
                        </span>
                      </div>
                      <div className={`flex justify-between py-1 border-b ${isDark ? "border-[#1F2937]" : "border-[#E2E8F0]"}`}>
                        <span className={isDark ? "text-[#94A3B8]" : "text-[#64748B]"}>Benchmark Return</span>
                        <span className={`font-semibold ${isDark ? "text-white" : "text-[#0F172A]"}`}>
                          {latestBacktest.metrics.benchmarkReturnPct.toFixed(2)}%
                        </span>
                      </div>
                      <div className={`flex justify-between py-1 border-b ${isDark ? "border-[#1F2937]" : "border-[#E2E8F0]"}`}>
                        <span className={isDark ? "text-[#94A3B8]" : "text-[#64748B]"}>Sharpe Ratio</span>
                        <span className={`font-bold ${isDark ? "text-white" : "text-[#0F172A]"}`}>
                          {latestBacktest.metrics.sharpeRatio != null ? latestBacktest.metrics.sharpeRatio.toFixed(2) : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className={isDark ? "text-[#94A3B8]" : "text-[#64748B]"}>Max Drawdown</span>
                        <span className="font-bold text-amber-700">{latestBacktest.metrics.maxDrawdownPct.toFixed(2)}%</span>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-xs ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
                      No backtests saved yet. Execute an algorithm in Strategy Builder to see detailed risk metrics here.
                    </p>
                  )}
                </Card>

                {/* AI Capabilities Card */}
                <Card>
                  <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? "text-white" : "text-[#0F172A]"}`}>
                    <TrendingUp size={16} className="text-[#3B82F6]" />
                    What You Can Ask Me
                  </h3>
                  <ul className={`space-y-2 text-xs ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
                    <li className={`p-2 rounded-lg ${isDark ? "bg-[#1F2937]" : "bg-[#F8FAFC]"}`}>
                      <strong className={`block ${isDark ? "text-white" : "text-[#0F172A]"}`}>
                        Options & Greeks
                      </strong>
                      Delta, Gamma, Theta decay, straddles, iron condors, and implied volatility.
                    </li>
                    <li className={`p-2 rounded-lg ${isDark ? "bg-[#1F2937]" : "bg-[#F8FAFC]"}`}>
                      <strong className={`block ${isDark ? "text-white" : "text-[#0F172A]"}`}>
                        Risk Ratios & Formulas
                      </strong>
                      Sharpe, Sortino, Calmar, Value at Risk (VaR), and Kelly criterion.
                    </li>
                    <li className={`p-2 rounded-lg ${isDark ? "bg-[#1F2937]" : "bg-[#F8FAFC]"}`}>
                      <strong className={`block ${isDark ? "text-white" : "text-[#0F172A]"}`}>
                        NSE & Indian Market Tax
                      </strong>
                      STCG (20%), LTCG (12.5%), STT, and market trading hours.
                    </li>
                  </ul>
                </Card>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </>
  );
};
