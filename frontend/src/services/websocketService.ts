import { io, Socket } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

interface MarketData {
  [key: string]: {
    price: number;
    change: number;
    volume: number;
  };
}

interface Trade {
  id: number;
  strategy: string;
  symbol: string;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  timestamp: string;
  status: 'OPEN' | 'CLOSED' | 'VERIFIED';
  blockchainHash: string | null;
}

type MessageCallback = (data: any) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<MessageCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  /**
   * Initialize WebSocket connection
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Try WebSocket first, fallback to HTTP long-polling
        this.socket = io(BACKEND_URL, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: this.maxReconnectAttempts,
        });

        this.socket.on('connect', () => {
          console.log('✅ Connected to backend server');
          this.reconnectAttempts = 0;
          resolve();
        });

        this.socket.on('disconnect', () => {
          console.log('❌ Disconnected from backend server');
        });

        this.socket.on('connect_error', (error) => {
          this.reconnectAttempts += 1;
          console.error('Connection error:', error);
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(error);
            return;
          }
        });

        // Use direct WebSocket fallback if Socket.IO doesn't work
        if (!this.socket.connected) {
          setTimeout(() => {
            this.connectDirectWebSocket();
          }, 1000);
        }
      } catch (error) {
        console.error('Failed to initialize Socket.IO:', error);
        this.connectDirectWebSocket();
        resolve(); // Continue anyway with direct WebSocket
      }
    });
  }

  /**
   * Fallback: Connect using direct WebSocket
   */
  private connectDirectWebSocket() {
    try {
      const wsUrl = BACKEND_URL.replace(/^http/, 'ws');
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ Direct WebSocket connection established');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.emit(message.type, message.data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
      };
    } catch (error) {
      console.error('Failed to establish direct WebSocket:', error);
    }
  }

  /**
   * Register event listener
   */
  public on(event: string, callback: MessageCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Also register with socket.io if available
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Remove event listener
   */
  public off(event: string, callback: MessageCallback): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }

    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  /**
   * Emit event (internal)
   */
  private emit(event: string, data: any): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Send message to backend
   */
  public send(message: any): void {
    if (this.socket?.connected) {
      this.socket.emit('message', message);
    } else if (this.socket) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected');
    }
  }

  /**
   * Execute trade
   */
  public executeTrade(trade: {
    strategy: string;
    symbol: string;
    entryPrice: number;
    quantity: number;
  }): void {
    this.send({
      type: 'EXECUTE_TRADE',
      ...trade,
    });
  }

  /**
   * Close trade
   */
  public closeTrade(tradeId: number, exitPrice: number): void {
    this.send({
      type: 'CLOSE_TRADE',
      tradeId,
      exitPrice,
    });
  }

  /**
   * Subscribe to market updates
   */
  public subscribeToMarketData(callback: (data: MarketData) => void): () => void {
    this.on('MARKET_UPDATE', callback);
    this.on('MARKET_DATA', callback);

    return () => {
      this.off('MARKET_UPDATE', callback);
      this.off('MARKET_DATA', callback);
    };
  }

  /**
   * Subscribe to trade events
   */
  public subscribeToTrades(callback: (data: Trade) => void): () => void {
    this.on('TRADE_CREATED', callback);
    this.on('TRADE_VERIFIED', callback);
    this.on('TRADE_CLOSED_VERIFIED', callback);

    return () => {
      this.off('TRADE_CREATED', callback);
      this.off('TRADE_VERIFIED', callback);
      this.off('TRADE_CLOSED_VERIFIED', callback);
    };
  }

  /**
   * Disconnect WebSocket
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Check connection status
   */
  public isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// Export singleton instance
export const wsService = new WebSocketService();
export default WebSocketService;
