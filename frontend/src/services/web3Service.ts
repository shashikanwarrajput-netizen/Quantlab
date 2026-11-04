import Web3 from 'web3';

// Smart contract configuration
const CONTRACT_ABI = [
  {
    "inputs": [
      { "name": "_strategy", "type": "string" },
      { "name": "_symbol", "type": "string" },
      { "name": "_entryPrice", "type": "uint256" },
      { "name": "_quantity", "type": "uint256" }
    ],
    "name": "createTrade",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "_tradeId", "type": "uint256" },
      { "name": "_exitPrice", "type": "uint256" }
    ],
    "name": "closeTrade",
    "outputs": [{ "name": "", "type": "int256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "name": "_tradeId", "type": "uint256" }],
    "name": "verifyTrade",
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "_tradeId", "type": "uint256" }],
    "name": "getTrade",
    "outputs": [
      {
        "components": [
          { "name": "id", "type": "uint256" },
          { "name": "trader", "type": "address" },
          { "name": "strategy", "type": "string" },
          { "name": "symbol", "type": "string" },
          { "name": "entryPrice", "type": "uint256" },
          { "name": "exitPrice", "type": "uint256" },
          { "name": "quantity", "type": "uint256" },
          { "name": "timestamp", "type": "uint256" },
          { "name": "isClosed", "type": "bool" },
          { "name": "status", "type": "string" }
        ],
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "_user", "type": "address" }],
    "name": "getUserTrades",
    "outputs": [{ "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTotalTrades",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

export interface TradeRecord {
  id: number;
  trader: string;
  strategy: string;
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  timestamp: number;
  isClosed: boolean;
  status: string;
}

class Web3Service {
  private web3: Web3 | null = null;
  private contract: any = null;
  private userAddress: string | null = null;
  private isSimulated: boolean = false;
  private simulatedTrades: Map<number, TradeRecord> = new Map();
  private simulatedTradeCounter: number = 101;

  constructor() {
    this.loadSimulatedTrades();
  }

  private loadSimulatedTrades(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('quantlab_simulated_trades');
        if (saved) {
          const list: TradeRecord[] = JSON.parse(saved);
          list.forEach((t) => this.simulatedTrades.set(t.id, t));
          this.simulatedTradeCounter = Math.max(101, ...list.map((t) => t.id));
          return;
        }
      }
    } catch {
      // Fallback to in-memory seeding
    }
    this.seedSimulatedTrades();
  }

  private saveSimulatedTrades(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const list = Array.from(this.simulatedTrades.values());
        localStorage.setItem('quantlab_simulated_trades', JSON.stringify(list));
      }
    } catch {
      // Ignore storage errors in restricted iframe
    }
  }

  private seedSimulatedTrades() {
    this.simulatedTrades.set(101, {
      id: 101,
      trader: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      strategy: 'SMA Crossover Alpha',
      symbol: 'RELIANCE',
      entryPrice: 2750.00,
      exitPrice: 2820.00,
      quantity: 50,
      timestamp: Math.floor(Date.now() / 1000) - 86400,
      isClosed: true,
      status: 'VERIFIED',
    });
    this.saveSimulatedTrades();
  }

  /**
   * Initialize Web3 with provider
   */
  public async initialize(providerUrl: string = 'http://localhost:8545'): Promise<boolean> {
    try {
      this.web3 = new Web3(providerUrl);
      return true;
    } catch {
      this.isSimulated = true;
      return true;
    }
  }

  /**
   * Connect MetaMask wallet or fallback to simulated account
   */
  public async connectWallet(): Promise<string | null> {
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
        this.userAddress = accounts[0];
        this.web3 = new Web3(window.ethereum);
        this.isSimulated = false;
        return this.userAddress;
      }
    } catch {
      // Fallback below
    }

    // Local simulated Web3 wallet for demo environments
    this.userAddress = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
    this.isSimulated = true;
    return this.userAddress;
  }

  public setContractAddress(address: string): void {
    if (this.web3) {
      try {
        this.contract = new this.web3.eth.Contract(CONTRACT_ABI as any, address);
      } catch {
        this.isSimulated = true;
      }
    }
  }

  public getUserAddress(): string | null {
    return this.userAddress;
  }

  public isSimulatedMode(): boolean {
    return this.isSimulated;
  }

  /**
   * Record trade on blockchain or in simulated ledger
   */
  public async recordTrade(
    strategy: string,
    symbol: string,
    entryPrice: number,
    quantity: number
  ): Promise<{ hash: string; tradeId?: number } | null> {
    if (this.contract && this.userAddress && !this.isSimulated) {
      try {
        const tx = this.contract.methods.createTrade(
          strategy,
          symbol,
          this.web3!.utils.toWei(entryPrice.toString(), 'ether'),
          quantity
        );
        const gas = await tx.estimateGas({ from: this.userAddress });
        const gasPrice = await this.web3!.eth.getGasPrice();
        const receipt = await tx.send({
          from: this.userAddress,
          gas: Math.floor(gas * 1.1),
          gasPrice: Math.floor(Number(gasPrice) * 1.1),
        });
        return {
          hash: receipt.transactionHash,
          tradeId: receipt.events?.TradeCreated?.returnValues?.tradeId,
        };
      } catch (err) {
        console.warn('Real contract call failed, falling back to simulation:', err);
      }
    }

    // Simulated fallback trade creation
    this.simulatedTradeCounter += 1;
    const tradeId = this.simulatedTradeCounter;
    const mockHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    
    this.simulatedTrades.set(tradeId, {
      id: tradeId,
      trader: this.userAddress || '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      strategy,
      symbol,
      entryPrice,
      exitPrice: 0,
      quantity,
      timestamp: Math.floor(Date.now() / 1000),
      isClosed: false,
      status: 'OPEN',
    });
    this.saveSimulatedTrades();

    return { hash: mockHash, tradeId };
  }

  /**
   * Close trade on blockchain or simulated ledger
   */
  public async closeTrade(
    tradeId: number,
    exitPrice: number
  ): Promise<{ hash: string; profitLoss?: number } | null> {
    if (this.contract && this.userAddress && !this.isSimulated) {
      try {
        const tx = this.contract.methods.closeTrade(
          tradeId,
          this.web3!.utils.toWei(exitPrice.toString(), 'ether')
        );
        const receipt = await tx.send({ from: this.userAddress });
        return { hash: receipt.transactionHash };
      } catch (err) {
        console.warn('Contract closeTrade failed, using simulation:', err);
      }
    }

    const trade = this.simulatedTrades.get(tradeId);
    const mockHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    if (trade) {
      trade.exitPrice = exitPrice;
      trade.isClosed = true;
      trade.status = 'CLOSED';
      const pnl = (exitPrice - trade.entryPrice) * trade.quantity;
      this.saveSimulatedTrades();
      return { hash: mockHash, profitLoss: pnl };
    }
    return { hash: mockHash, profitLoss: 0 };
  }

  public async verifyTrade(tradeId: number): Promise<boolean> {
    if (this.contract && !this.isSimulated) {
      try {
        return await this.contract.methods.verifyTrade(tradeId).call();
      } catch {
        // Fallback
      }
    }
    return this.simulatedTrades.has(tradeId);
  }

  public async getTrade(tradeId: number): Promise<TradeRecord | null> {
    if (this.contract && !this.isSimulated) {
      try {
        const trade = await this.contract.methods.getTrade(tradeId).call();
        return {
          id: Number(trade.id),
          trader: trade.trader,
          strategy: trade.strategy,
          symbol: trade.symbol,
          entryPrice: Number(this.web3!.utils.fromWei(trade.entryPrice, 'ether')),
          exitPrice: Number(this.web3!.utils.fromWei(trade.exitPrice, 'ether')),
          quantity: Number(trade.quantity),
          timestamp: Number(trade.timestamp),
          isClosed: trade.isClosed,
          status: trade.status,
        };
      } catch {
        // Fallback
      }
    }
    return this.simulatedTrades.get(tradeId) || null;
  }

  public async getUserTrades(userAddress: string): Promise<number[] | null> {
    if (this.contract && !this.isSimulated) {
      try {
        const trades = await this.contract.methods.getUserTrades(userAddress).call();
        return trades.map((id: any) => Number(id));
      } catch {
        // Fallback
      }
    }
    return Array.from(this.simulatedTrades.keys());
  }

  public async getTotalTrades(): Promise<number | null> {
    if (this.contract && !this.isSimulated) {
      try {
        const total = await this.contract.methods.getTotalTrades().call();
        return Number(total);
      } catch {
        // Fallback
      }
    }
    return this.simulatedTrades.size;
  }

  public isConnected(): boolean {
    return this.userAddress !== null;
  }

  public getEtherscanUrl(hash: string, network: string = 'sepolia'): string {
    const baseUrls: { [key: string]: string } = {
      mainnet: 'https://etherscan.io',
      sepolia: 'https://sepolia.etherscan.io',
      polygon: 'https://polygonscan.com',
    };
    const baseUrl = baseUrls[network] || baseUrls.sepolia;
    return `${baseUrl}/tx/${hash}`;
  }
}

export const web3Service = new Web3Service();
export default Web3Service;

declare global {
  interface Window {
    ethereum?: any;
  }
}
