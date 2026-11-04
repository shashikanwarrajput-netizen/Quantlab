interface AIResponses {
  weaknesses: string[];
  improvements: string[];
  explanations: Record<string, string>;
}

export const mockAIResponses: AIResponses = {
  'weaknesses': [
    "Your strategy shows a high win rate of 62.5%, but the average losing trade is larger than your average winning trade. Consider adjusting your risk-reward ratio or implementing tighter stop losses.",
    "I notice your strategy has a maximum drawdown of 8.3%, which is reasonable but could be reduced. Consider adding a trailing stop loss to protect profits during downtrends.",
    "Your strategy performs well in trending markets but struggles during consolidation periods. Consider adding a volatility filter to reduce entries during low-volatility conditions.",
  ],
  'improvements': [
    "Add a moving average filter to trade only in the direction of the major trend. This could improve your win rate by 5-10%.",
    "Consider adding RSI confirmation to your moving average crossover. Enter only when both indicators align. This should reduce false signals.",
    "Implement position sizing based on volatility (ATR-based). This can improve risk-adjusted returns and reduce drawdown.",
    "Add a money management rule: skip trades if you've already had 2 losses in a row. This can improve psychological resilience.",
  ],
  'explanations': {
    'sharpeRatio': "The Sharpe Ratio of 1.85 measures risk-adjusted returns. Higher is better. Ratios above 1.0 are generally considered good, above 2.0 are excellent. Your strategy is performing very well.",
    'maxDrawdown': "Maximum drawdown of 8.3% means the largest peak-to-trough decline in equity. This is acceptable for an aggressive strategy. Conservative traders typically target below 10%.",
    'winRate': "Your 62.5% win rate means 62.5% of your trades are profitable. This is good, but remember that many profitable systems have lower win rates compensated by larger winning trades.",
    'RSI': "RSI (Relative Strength Index) ranges from 0-100. Values above 70 suggest overbought conditions (potential sell signal), below 30 suggest oversold (potential buy signal). Use it to confirm entries.",
    'MACD': "MACD (Moving Average Convergence Divergence) is a trend-following momentum indicator. Trading signals occur when the MACD line crosses above/below the signal line.",
    'SMA': "Simple Moving Average (SMA) smooths price data over a specified period. Fast SMAs (50) are more responsive; slow SMAs (200) show the major trend. Crossovers often signal trend changes.",
    'drawdown': "Drawdown measures the peak-to-trough decline during a specific period. Maximum drawdown is the largest such decline. It's important for understanding worst-case scenarios.",
  },
};

export const suggestedPrompts = [
  "Why is my strategy losing money?",
  "Explain RSI to me.",
  "How can I reduce drawdown?",
  "Analyze my latest backtest.",
  "Suggest improvements to my strategy.",
  "What is Sharpe Ratio?",
  "How do I optimize position sizing?",
  "Explain the MACD indicator.",
];

export const getAIResponse = (userMessage: string): string => {
  const message = userMessage.toLowerCase();
  
  if (message.includes('why') && message.includes('losing')) {
    return mockAIResponses.weaknesses[0];
  }
  
  if (message.includes('improve') || message.includes('optimization')) {
    return mockAIResponses.improvements[Math.floor(Math.random() * mockAIResponses.improvements.length)];
  }
  
  if (message.includes('rsi')) {
    return mockAIResponses.explanations.RSI;
  }
  
  if (message.includes('macd')) {
    return mockAIResponses.explanations.MACD;
  }
  
  if (message.includes('sharpe')) {
    return mockAIResponses.explanations.sharpeRatio;
  }
  
  if (message.includes('drawdown') || message.includes('drawdown')) {
    return mockAIResponses.explanations.drawdown;
  }
  
  if (message.includes('moving average') || message.includes('sma')) {
    return mockAIResponses.explanations.SMA;
  }
  
  // Default response
  const defaultResponses = [
    "That's an interesting question about trading strategies. Based on your recent backtest results, your strategy shows strong performance with a Sharpe Ratio of 1.85. Would you like me to analyze any specific aspect?",
    "I can help you optimize your strategy! The key areas to focus on are: risk management, market conditions, and indicator selection. What would you like to improve?",
    "Great question! Successful trading is about managing risk as much as finding opportunities. Focus on position sizing, stop losses, and only trading high-probability setups.",
  ];
  
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
};
