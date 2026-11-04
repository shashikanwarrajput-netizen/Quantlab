// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title QuantLabTrades
 * @dev Store and verify trading strategy results on blockchain
 * @notice This contract records all trades from strategies with immutable verification
 */
contract QuantLabTrades {
    
    // ============= DATA STRUCTURES =============
    
    struct Trade {
        uint256 id;
        address trader;
        string strategy;
        string symbol;
        uint256 entryPrice;
        uint256 exitPrice;
        uint256 quantity;
        uint256 timestamp;
        bool isClosed;
        string status; // OPEN, VERIFIED, CLOSED
    }

    struct Strategy {
        string name;
        address owner;
        uint256 totalTrades;
        uint256 totalReturn;
        uint256 winRate;
        uint256 createdAt;
    }

    // ============= STATE VARIABLES =============
    
    mapping(uint256 => Trade) public trades;
    mapping(address => uint256[]) public userTrades;
    mapping(string => Strategy) public strategies;
    
    uint256 public tradeCounter = 0;
    uint256 public totalTrades = 0;
    
    address public owner;

    // ============= EVENTS =============
    
    event TradeCreated(
        uint256 indexed tradeId,
        address indexed trader,
        string strategy,
        string symbol,
        uint256 entryPrice,
        uint256 timestamp
    );

    event TradeClosed(
        uint256 indexed tradeId,
        uint256 exitPrice,
        int256 profitLoss,
        uint256 timestamp
    );

    event TradeVerified(
        uint256 indexed tradeId,
        bool verified,
        uint256 timestamp
    );

    event StrategyCreated(
        string indexed strategyName,
        address indexed owner,
        uint256 timestamp
    );

    // ============= MODIFIERS =============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    // ============= CONSTRUCTOR =============
    
    constructor() {
        owner = msg.sender;
    }

    // ============= TRADE FUNCTIONS =============
    
    /**
     * @dev Record a new trade on the blockchain
     */
    function createTrade(
        string memory _strategy,
        string memory _symbol,
        uint256 _entryPrice,
        uint256 _quantity
    ) public returns (uint256) {
        uint256 tradeId = tradeCounter++;
        
        trades[tradeId] = Trade({
            id: tradeId,
            trader: msg.sender,
            strategy: _strategy,
            symbol: _symbol,
            entryPrice: _entryPrice,
            exitPrice: 0,
            quantity: _quantity,
            timestamp: block.timestamp,
            isClosed: false,
            status: "OPEN"
        });

        userTrades[msg.sender].push(tradeId);
        totalTrades++;

        emit TradeCreated(
            tradeId,
            msg.sender,
            _strategy,
            _symbol,
            _entryPrice,
            block.timestamp
        );

        return tradeId;
    }

    /**
     * @dev Close a trade and record exit price
     */
    function closeTrade(uint256 _tradeId, uint256 _exitPrice) public returns (int256) {
        Trade storage trade = trades[_tradeId];
        
        require(trade.trader == msg.sender, "Only trade owner can close");
        require(!trade.isClosed, "Trade already closed");

        trade.exitPrice = _exitPrice;
        trade.isClosed = true;
        trade.status = "CLOSED";

        // Calculate P&L (simplified)
        int256 priceChange = int256(_exitPrice) - int256(trade.entryPrice);
        int256 profitLoss = (priceChange * int256(trade.quantity)) / 100;

        emit TradeClosed(_tradeId, _exitPrice, profitLoss, block.timestamp);
        emit TradeVerified(_tradeId, true, block.timestamp);

        return profitLoss;
    }

    /**
     * @dev Verify a trade is recorded on blockchain
     */
    function verifyTrade(uint256 _tradeId) public view returns (bool) {
        Trade memory trade = trades[_tradeId];
        return trade.trader != address(0);
    }

    /**
     * @dev Get trade details
     */
    function getTrade(uint256 _tradeId) public view returns (Trade memory) {
        require(verifyTrade(_tradeId), "Trade does not exist");
        return trades[_tradeId];
    }

    /**
     * @dev Get all trades for a user
     */
    function getUserTrades(address _user) public view returns (uint256[] memory) {
        return userTrades[_user];
    }

    /**
     * @dev Get trade count for a user
     */
    function getUserTradeCount(address _user) public view returns (uint256) {
        return userTrades[_user].length;
    }

    // ============= STRATEGY FUNCTIONS =============
    
    /**
     * @dev Register a new strategy
     */
    function createStrategy(string memory _name) public returns (bool) {
        strategies[_name] = Strategy({
            name: _name,
            owner: msg.sender,
            totalTrades: 0,
            totalReturn: 0,
            winRate: 0,
            createdAt: block.timestamp
        });

        emit StrategyCreated(_name, msg.sender, block.timestamp);
        return true;
    }

    /**
     * @dev Get strategy details
     */
    function getStrategy(string memory _name) public view returns (Strategy memory) {
        return strategies[_name];
    }

    // ============= ADMIN FUNCTIONS =============
    
    /**
     * @dev Get total trades recorded
     */
    function getTotalTrades() public view returns (uint256) {
        return totalTrades;
    }

    /**
     * @dev Get contract statistics
     */
    function getStats() public view returns (
        uint256 _totalTrades,
        uint256 _tradeCounter,
        address _owner
    ) {
        return (totalTrades, tradeCounter, owner);
    }
}
