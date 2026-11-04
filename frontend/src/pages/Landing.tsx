import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sun, Moon, Bot, BrainCircuit, ChartNoAxesCombined, Gauge, LineChart, Menu, ShieldCheck, Sparkles, X, Zap } from 'lucide-react';
import './Landing.css';
import { useTheme } from '../context/ThemeContext';
import { MarketChart } from '../components/MarketChart';
import { marketDataService, type MarketHistoryPoint } from '../services/marketDataService';

const features = [
  { icon: <Zap size={18} />, title: 'Strategy Builder', text: 'Define rules with signals and indicators, then validate before risking capital.' },
  { icon: <LineChart size={18} />, title: 'Backtesting Engine', text: 'Evaluate historical behavior against real market data and track your assumptions.' },
  { icon: <ChartNoAxesCombined size={18} />, title: 'Portfolio Analytics', text: 'Review allocations, drawdown, volatility and return using actual calculations.' },
  { icon: <Bot size={18} />, title: 'AI Assistant', text: 'Interpret strategy results with context-aware explanations grounded in your backtest.' },
];

const Brand = () => (
  <Link to="/" className="ql-brand">
    <img src="/logo.svg" alt="" />
    <span>
      Quant<span>Lab</span>
    </span>
  </Link>
);

const Reveal = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 18 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.18 }}
    transition={{ duration: 0.55 }}
  >
    {children}
  </motion.div>
);

function Header() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    ['Home', '#top'],
    ['Markets', '/market-data'],
    ['Strategies', '/strategy-builder'],
    ['Backtesting', '/backtesting'],
    ['Analytics', '/portfolio'],
    ['AI Assistant', '/ai-assistant'],
  ];

  return (
    <motion.header className={`ql-header ${scrolled ? 'is-scrolled' : 'is-top'}`} layout transition={{ type: 'spring', stiffness: 260, damping: 25 }}>
      <div className="ql-nav">
        <Brand />

        <nav>
          {links.map(([name, href]) => (
            <Link key={name} to={href.startsWith('/') ? href : '/'}>{name}</Link>
          ))}
        </nav>

        <div className="ql-actions">
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              isDark
                ? 'text-slate-300 hover:text-white hover:bg-[#1F2937]'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/80 border border-slate-300'
            }`}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Theme`}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-blue-600" />}
          </button>
          <Link to="/login" className="ql-action-link">Login</Link>
          <Link to="/signup" className="ql-button ql-button--nav compact">
            Get Started <ArrowRight size={14} />
          </Link>
        </div>

        <button className="ql-menu" onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <motion.div className="ql-mobile" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer ${
              isDark
                ? 'text-slate-300 hover:text-white hover:bg-[#1F2937]'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/80 border border-slate-300'
            }`}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Theme`}
          >
            {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-blue-600" />}
            <span className="text-xs font-semibold">{isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}</span>
          </button>
          {links.map(([name, href]) => (
            <Link key={name} to={href.startsWith('/') ? href : '/'} onClick={() => setOpen(false)}>
              {name}
            </Link>
          ))}
          <Link to="/login">Login</Link>
          <Link to="/signup" className="ql-button">
            Get Started
          </Link>
        </motion.div>
      )}
    </motion.header>
  );
}

function MarketPreview({ data, loading, error }: { data: MarketHistoryPoint[]; loading: boolean; error: string | null }) {
  const status = error ? 'Unavailable' : loading ? 'Loading' : data.length ? 'Delayed' : 'Unavailable';

  return (
    <div className="market-preview">
      <div className="market-preview-header">
        <div>
          <small>Data Source</small>
          <strong>IndianAPI</strong>
        </div>
        <span className={`market-status ${status === 'Delayed' ? 'is-live' : status === 'Unavailable' ? 'is-unavailable' : 'is-loading'}`}>
          <span className="market-status-dot" />
          {status}
        </span>
      </div>
      <MarketChart data={data} symbol="RELIANCE" interval="1m" loading={loading} error={error} />
    </div>
  );
}

export const Landing = () => {
  const [history, setHistory] = useState<MarketHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await marketDataService.getHistory('RELIANCE', '1m');
        if (live) {
          setHistory(result);
        }
      } catch (err) {
        if (live) {
          setError(err instanceof Error ? err.message : 'Unable to retrieve market data.');
          setHistory([]);
        }
      } finally {
        if (live) setLoading(false);
      }
    };

    load();
    return () => {
      live = false;
    };
  }, []);

  return (
    <main className="ql-page" id="top">
      <Header />

      <section className="hero">
        <div className="orb one" />
        <div className="orb two" />

        <div className="wrap hero-grid">
          <Reveal>
            <div className="eyebrow">
              <Sparkles size={13} /> AI-POWERED TRADING LABORATORY
            </div>
            <h1>
              Build.
              <br />
              Backtest.
              <br />
              <span>Optimize.</span>
            </h1>
            <p>
              An AI-powered virtual laboratory for creating, testing and improving stock-market strategies.
            </p>

            <div className="buttons">
              <Link to="/signup" className="ql-button accent">
                Start Building <ArrowRight size={17} />
              </Link>
              <Link to="/market-data" className="ql-button quiet">
                Explore Markets
              </Link>
            </div>

            <div className="hero-meta">
              <div>
                <ShieldCheck size={16} />
                <span>Real market data routing</span>
              </div>
              <div>
                <Gauge size={16} />
                <span>Strategy-backed analytics</span>
              </div>
            </div>
          </Reveal>

          <Reveal>
            <MarketPreview data={history} loading={loading} error={error} />
          </Reveal>
        </div>
      </section>

      <section id="features" className="section strategy-section">
        <div className="wrap">
          <Reveal className="heading">
            <div className="eyebrow">THE QUANTLAB WORKSPACE</div>
            <h2>
              Minimal tooling for
              <br />
              serious strategy work.
            </h2>
          </Reveal>

          <div className="feature-grid">
            {features.map((feature, index) => (
              <Reveal key={feature.title}>
                <article className="feature">
                  <div>{feature.icon}</div>
                  <small>0{index + 1}</small>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="analytics" className="section backtesting-section">
        <div className="wrap">
          <Reveal className="heading">
            <div className="eyebrow">A CLEARER PROCESS</div>
            <h2>From idea to evidence.</h2>
          </Reveal>

          <div className="steps">
            {[
              ['01', 'Design', 'Define the trade logic and market context.'],
              ['02', 'Backtest', 'Run the strategy against historical price data.'],
              ['03', 'Review', 'Inspect return, volatility and drawdown.'],
              ['04', 'Improve', 'Use AI feedback to refine the next iteration.'],
            ].map(([step, title, text]) => (
              <Reveal key={step}>
                <article>
                  <b>{step}</b>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section portfolio-section">
        <div className="wrap">
          <Reveal className="heading light-heading">
            <div className="eyebrow eyebrow-light">Portfolio Analytics</div>
            <h2>See the signal behind the returns.</h2>
          </Reveal>

          <div className="how-grid">
            {[
              ['01', 'Build', 'Define your strategy and market context in a precise, repeatable workflow.'],
              ['02', 'Backtest', 'Run strategy logic against historical data and measure performance objectively.'],
              ['03', 'Analyze', 'Review drawdown, volatility, and trend quality using clear financial signals.'],
              ['04', 'Improve', 'Use AI-backed feedback to refine rules and iterate with confidence.'],
            ].map(([step, title, text]) => (
              <Reveal key={step}>
                <article className="how-step">
                  <b>{step}</b>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section workflow">
        <div className="wrap">
          <Reveal className="heading">
            <div className="eyebrow">How QuantLab Works</div>
            <h2>From idea to evidence.</h2>
          </Reveal>

          <div className="how-grid">
            {[
              ['01', 'Build', 'Define your strategy and market context in a precise, repeatable workflow.'],
              ['02', 'Backtest', 'Run strategy logic against historical data and measure performance objectively.'],
              ['03', 'Analyze', 'Review drawdown, volatility, and trend quality using clear financial signals.'],
              ['04', 'Improve', 'Use AI-backed feedback to refine rules and iterate with confidence.'],
            ].map(([step, title, text]) => (
              <Reveal key={step}>
                <article className="how-step workflow-step">
                  <b>{step}</b>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section risk-section">
        <div className="wrap">
          <Reveal className="heading">
            <div className="eyebrow">Risk / Analysis</div>
            <h2>Measure the downside before it changes your plan.</h2>
          </Reveal>

          <div className="risk-grid">
            {[
              ['Drawdown', 'Track deterioration in equity curves before a position turns structural.'],
              ['Volatility', 'Measure how sharply returns stretch and where noise overwhelms signal.'],
              ['Concentration', 'Monitor where portfolio risk clusters across sectors and exposures.'],
            ].map(([title, text]) => (
              <Reveal key={title}>
                <article className="risk-card">
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="ai-assistant" className="section ai-section">
        <div className="wrap">
          <Reveal className="ai-grid">
            <div className="ai-panel">
              <div className="eyebrow">
                <BrainCircuit size={13} /> AI STRATEGY ANALYSIS
              </div>
              <h2>
                Understand what changed,
                <br />
                not just whether it worked.
              </h2>
              <p>
                Ask the assistant why a setup underperformed, how a rule interacts with volatility, and what to adjust next.
              </p>
              <Link to="/ai-assistant" className="ql-button">
                Open AI Assistant <ArrowRight size={17} />
              </Link>
            </div>

            <div className="ai-card">
              <div className="chip">Strategy review</div>
              <p>“The model is sensitive to sharp volatility spikes during earnings windows. Rebalancing the entry filter should reduce noise.”</p>
              <div className="meta-row">
                <span>Analysis example</span>
                <span>Updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section premium-section">
        <div className="wrap">
          <Reveal className="cta-box">
            <div>
              <div className="eyebrow">QuantLab</div>
              <h2>Turn Trading Ideas Into Tested Strategies.</h2>
            </div>
            <Link to="/signup" className="ql-button accent cta-button">
              Start Building <ArrowRight size={17} />
            </Link>
          </Reveal>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap footer-grid">
          <div>
            <Brand />
            <p className="footer-tag">Build • Backtest • Optimize</p>
          </div>

          <nav>
            <a href="/market-data">Markets</a>
            <a href="/strategy-builder">Strategy Builder</a>
            <a href="/backtesting">Backtesting</a>
            <a href="/portfolio">Analytics</a>
            <a href="/ai-assistant">AI Assistant</a>
          </nav>

          <nav>
            <a href="/">About</a>
            <a href="/">Privacy</a>
            <a href="/">Terms</a>
          </nav>
        </div>

        <div className="wrap footer-note">
          <p>Market data is provided by external data providers and may be delayed.</p>
          <p>QuantLab is an educational and research platform. Backtest results are based on historical data and do not guarantee future performance. Market data may be delayed.</p>
        </div>
      </footer>
    </main>
  );
};
