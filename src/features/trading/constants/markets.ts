import { Market } from '@/features/trading/types';

const letterLogo = (text: string, bg: string, fg: string = '#0B0F1A') =>
  `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' rx='32' ry='32' fill='${encodeURIComponent(
    bg,
  )}'/><text x='50%' y='54%' font-family='Inter,Arial,sans-serif' font-size='28' font-weight='700' fill='${encodeURIComponent(
    fg,
  )}' text-anchor='middle' dominant-baseline='middle'>${encodeURIComponent(text)}</text></svg>`;

export const ALL_MARKETS: Market[] = [
  {
    symbol: 'BTC',
    tradingViewSymbol: 'BINANCE:BTCUSDT',
    logoUrl:
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png',
    binanceSymbol: 'BTCUSDT',
    category: 'crypto',
    maxLeverage: 100,
  },
  {
    symbol: 'ETH',
    tradingViewSymbol: 'BINANCE:ETHUSDT',
    logoUrl:
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    binanceSymbol: 'ETHUSDT',
    category: 'crypto',
    maxLeverage: 100,
  },
  {
    symbol: 'SOL',
    tradingViewSymbol: 'BINANCE:SOLUSDT',
    logoUrl:
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
    binanceSymbol: 'SOLUSDT',
    category: 'crypto',
    maxLeverage: 100,
  },
  {
    symbol: 'AVAX',
    tradingViewSymbol: 'BINANCE:AVAXUSDT',
    logoUrl:
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchex/info/logo.png',
    binanceSymbol: 'AVAXUSDT',
    category: 'crypto',
    maxLeverage: 100,
  },
  {
    symbol: 'BNB',
    tradingViewSymbol: 'BINANCE:BNBUSDT',
    logoUrl:
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
    binanceSymbol: 'BNBUSDT',
    category: 'crypto',
    maxLeverage: 100,
  },
  {
    symbol: 'XRP',
    tradingViewSymbol: 'BINANCE:XRPUSDT',
    logoUrl:
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ripple/info/logo.png',
    binanceSymbol: 'XRPUSDT',
    category: 'crypto',
    maxLeverage: 100,
  },
  {
    symbol: 'AAVE',
    tradingViewSymbol: 'BINANCE:AAVEUSDT',
    logoUrl:
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9/logo.png',
    binanceSymbol: 'AAVEUSDT',
    category: 'crypto',
    maxLeverage: 100,
  },
  {
    symbol: 'ARB',
    tradingViewSymbol: 'BINANCE:ARBUSDT',
    logoUrl:
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
    binanceSymbol: 'ARBUSDT',
    category: 'crypto',
    maxLeverage: 100,
  },
  {
    symbol: 'CRV',
    tradingViewSymbol: 'BINANCE:CRVUSDT',
    logoUrl:
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xD533a949740bb3306d119CC777fa900bA034cd52/logo.png',
    binanceSymbol: 'CRVUSDT',
    category: 'crypto',
    maxLeverage: 100,
  },
  {
    symbol: 'DOGE',
    tradingViewSymbol: 'BINANCE:DOGEUSDT',
    logoUrl:
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/doge/info/logo.png',
    binanceSymbol: 'DOGEUSDT',
    category: 'crypto',
    maxLeverage: 100,
  },
  {
    symbol: 'LINK',
    tradingViewSymbol: 'BINANCE:LINKUSDT',
    logoUrl:
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png',
    binanceSymbol: 'LINKUSDT',
    category: 'crypto',
    maxLeverage: 100,
  },
  {
    symbol: 'PEPE',
    tradingViewSymbol: 'BINANCE:1000PEPEUSDT',
    logoUrl:
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6982508145454Ce325dDbE47a25d4ec3d2311933/logo.png',
    binanceSymbol: '1000PEPEUSDT',
    category: 'crypto',
    maxLeverage: 100,
  },
  // Forex
  {
    symbol: 'EURUSD',
    tradingViewSymbol: 'OANDA:EURUSD',
    logoUrl: letterLogo('€', '#C7D2FE', '#111827'),
    category: 'forex',
    maxLeverage: 100,
  },
  {
    symbol: 'GBPUSD',
    tradingViewSymbol: 'OANDA:GBPUSD',
    logoUrl: letterLogo('£', '#BFDBFE', '#0B0F1A'),
    category: 'forex',
    maxLeverage: 100,
  },
  // Commodities
  {
    symbol: 'XAUUSD',
    tradingViewSymbol: 'OANDA:XAUUSD',
    logoUrl: letterLogo('Au', '#FDE68A', '#0B0F1A'),
    category: 'commodities',
    maxLeverage: 100,
  },
  {
    symbol: 'XAGUSD',
    tradingViewSymbol: 'OANDA:XAGUSD',
    logoUrl: letterLogo('Ag', '#E5E7EB', '#0B0F1A'),
    category: 'commodities',
    maxLeverage: 100,
  },
  // Indices / ETFs
  {
    symbol: 'QQQUSD',
    tradingViewSymbol: 'NASDAQ:QQQ',
    logoUrl: letterLogo('QQQ', '#C084FC', '#0B0F1A'),
    category: 'indices',
    maxLeverage: 100,
  },
  {
    symbol: 'SPYUSD',
    tradingViewSymbol: 'AMEX:SPY',
    logoUrl: letterLogo('SPY', '#A7F3D0', '#0B0F1A'),
    category: 'indices',
    maxLeverage: 100,
  },
  // Stocks
  {
    symbol: 'AAPLUSD',
    tradingViewSymbol: 'NASDAQ:AAPL',
    logoUrl: letterLogo('AAPL', '#D8B4FE', '#0B0F1A'),
    category: 'stocks',
    maxLeverage: 100,
  },
  {
    symbol: 'GOOGLUSD',
    tradingViewSymbol: 'NASDAQ:GOOGL',
    logoUrl: letterLogo('GOOG', '#BFDBFE', '#0B0F1A'),
    category: 'stocks',
    maxLeverage: 100,
  },
];
