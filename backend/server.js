const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// ============= BLOCKCHAIN DATA (Mock) =============
let trades = [];
let tradeIdCounter = 1;

// ============= WEBSOCKET HANDLERS =============
wss.on('connection', (ws) => {
  console.log('✅ Client connected to WebSocket');

  // Handle messages from client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'EXECUTE_TRADE') {
        // Create trade record
        const trade = {
          id: tradeIdCounter++,
          strategy: data.strategy,
          symbol: data.symbol,
          entryPrice: data.entryPrice,
          exitPrice: null,
          quantity: data.quantity,
          timestamp: new Date().toISOString(),
          status: 'OPEN',
          blockchainHash: null,
        };

        trades.push(trade);

        // Simulate blockchain transaction
        setTimeout(() => {
          trade.blockchainHash = `0x${Math.random().toString(16).substring(2).padEnd(64, '0')}`;
          trade.status = 'VERIFIED';

          ws.send(JSON.stringify({
            type: 'TRADE_VERIFIED',
            data: trade,
          }));
        }, 1500);

        ws.send(JSON.stringify({
          type: 'TRADE_CREATED',
          data: trade,
        }));
      }

      if (data.type === 'CLOSE_TRADE') {
        const trade = trades.find(t => t.id === data.tradeId);
        if (trade) {
          trade.exitPrice = data.exitPrice;
          trade.status = 'CLOSED';

          // Simulate blockchain update
          setTimeout(() => {
            trade.blockchainHash = `0x${Math.random().toString(16).substring(2).padEnd(64, '0')}`;
            ws.send(JSON.stringify({
              type: 'TRADE_CLOSED_VERIFIED',
              data: trade,
            }));
          }, 1500);
        }
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    console.log('❌ Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// ============= REST API ENDPOINTS =============

// Get all trades
app.get('/api/trades', (req, res) => {
  res.json({
    trades,
    count: trades.length,
    timestamp: new Date().toISOString()
  });
});

// Get trade by ID
app.get('/api/trades/:id', (req, res) => {
  const trade = trades.find(t => t.id === parseInt(req.params.id));
  
  if (!trade) {
    return res.status(404).json({ error: 'Trade not found' });
  }

  res.json(trade);
});

// Create trade (REST alternative to WebSocket)
app.post('/api/trades', (req, res) => {
  const { strategy, symbol, entryPrice, quantity } = req.body;

  const trade = {
    id: tradeIdCounter++,
    strategy,
    symbol,
    entryPrice,
    exitPrice: null,
    quantity,
    timestamp: new Date().toISOString(),
    status: 'OPEN',
    blockchainHash: `0x${Math.random().toString(16).substring(2).padEnd(64, '0')}`,
  };

  trades.push(trade);

  res.status(201).json({
    message: 'Trade created and recorded on blockchain',
    trade
  });
});

// Close trade
app.patch('/api/trades/:id/close', (req, res) => {
  const { exitPrice } = req.body;
  const trade = trades.find(t => t.id === parseInt(req.params.id));

  if (!trade) {
    return res.status(404).json({ error: 'Trade not found' });
  }

  trade.exitPrice = exitPrice;
  trade.status = 'CLOSED';
  trade.blockchainHash = `0x${Math.random().toString(16).substring(2).padEnd(64, '0')}`;

  res.json({
    message: 'Trade closed and recorded on blockchain',
    trade
  });
});

// Verify trade on blockchain
app.get('/api/trades/:id/verify', (req, res) => {
  const trade = trades.find(t => t.id === parseInt(req.params.id));

  if (!trade) {
    return res.status(404).json({ error: 'Trade not found' });
  }

  res.json({
    tradeId: trade.id,
    isVerified: trade.status === 'VERIFIED' || trade.status === 'CLOSED',
    blockchainHash: trade.blockchainHash,
    status: trade.status,
    message: trade.blockchainHash 
      ? '✅ Trade verified on blockchain'
      : '⏳ Trade verification pending'
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'QuantLab Backend Server Running'
  });
});

// ============= ERROR HANDLING =============
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============= START SERVER =============
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  🚀 QuantLab Backend Server Started    ║
║  📡 WebSocket: ws://localhost:${PORT}   ║
║  🌐 REST API: http://localhost:${PORT}  ║
║  ⛓️  Blockchain: Simulated (Ready)     ║
╚════════════════════════════════════════╝
  `);
});

module.exports = server;
