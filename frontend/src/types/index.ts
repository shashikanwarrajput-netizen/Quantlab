// User types
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: Date;
}

// Strategy types
export interface Indicator {
  type: 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'BOLLINGER';
  period?: number;
  params?: Record<string, any>;
}

export interface TradingCondition {
  id: string;
  indicator1: Indicator;
  operator: '>' | '<' | '==' | '>=' | '<=';
  indicator2?: Indicator | number;
  value?: number;
  action: 'BUY' | 'SELL';
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  asset: string;
  market: string;
  timeframe: string;
  indicators: Indicator[];
  entryRules: TradingCondition[];
  exitRules: TradingCondition[];
  stopLoss?: number;
  takeProfit?: number;
  positionSize?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Backtest types
export interface Trade {
  id: string;
  date: Date;
  asset: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  pnl?: number;
  returnPercent?: number;
}

export interface BacktestResult {
  id: string;
  strategyId: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  totalReturnPercent: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  trades: Trade[];
  equityCurve: EquityPoint[];
  createdAt: Date;
}

export interface EquityPoint {
  date: Date;
  value: number;
  drawdown: number;
}

// Portfolio types
export interface PortfolioMetrics {
  totalValue: number;
  totalReturn: number;
  totalReturnPercent?: number;
  annualizedReturn: number;
  volatility: number;
  maxDrawdown: number;
  sharpeRatio: number;
  strategies: number;
}

export interface AssetAllocation {
  asset: string;
  value: number;
  percentage: number;
}

// Market data types
export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  pe?: number;
}

export interface CandleData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// AI Assistant types
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  strategyContext?: Strategy;
}

export interface AIResponse {
  message: string;
  suggestions?: string[];
  insights?: string[];
}

// Auth types
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
