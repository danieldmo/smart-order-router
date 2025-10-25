require('dotenv').config();
import { JsonRpcProvider } from '@ethersproject/providers';
import {
  ChainId,
  Currency,
  Percent,
  Token,
  TradeType,
} from '@uniswap/sdk-core';
import {
  AlphaRouter,
  CurrencyAmount,
  SwapOptionsSwapRouter02,
  SwapType,
} from '@uniswap/smart-order-router';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Middleware
app.use(express.json());

// Native token names by chain ID
const NATIVE_NAMES_BY_ID: { [chainId: number]: string[] } = {
  [ChainId.MAINNET]: ['ETH'],
  [ChainId.BASE]: ['ETH'],
  [ChainId.POLYGON]: ['MATIC'],
  [ChainId.ARBITRUM_ONE]: ['ETH'],
  [ChainId.OPTIMISM]: ['ETH'],
};

// Helper function to get native currency for a chain
function nativeOnChain(chainId: ChainId): Currency {
  // For now, we'll create a token with the native address
  // This is a simplified approach - in production you'd want proper native currency handling
  const nativeAddresses: { [chainId: number]: string } = {
    [ChainId.MAINNET]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    [ChainId.BASE]: '0x4200000000000000000000000000000000000006', // WETH
    [ChainId.POLYGON]: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
    [ChainId.ARBITRUM_ONE]: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
    [ChainId.OPTIMISM]: '0x4200000000000000000000000000000000000006', // WETH
  };

  const nativeAddress = nativeAddresses[chainId];
  if (!nativeAddress) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  return new Token(chainId, nativeAddress, 18);
}

// Helper function to parse amount with proper decimals
function parseAmount(amount: string, currency: Currency): CurrencyAmount {
  return CurrencyAmount.fromRawAmount(currency, amount);
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Swap routing endpoint
app.post('/swap-route', async (req, res): Promise<any> => {
  try {
    const {
      recipient,
      tokenInAddress,
      tokenInDecimals,
      tokenOutAddress,
      tokenOutDecimals,
      amountIn,
      rpcUrl,
      chainId = ChainId.BASE,
      exactIn = true,
      exactOut = false,
      forceCrossProtocol = false,
      forceMixedRoutes = false,
      debugRouting = true,
      enableFeeOnTransferFeeFetching = false,
      gasToken,
    } = req.body;

    // Log the incoming request
    console.log('=== Swap Route Request ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Chain ID:', chainId);
    console.log('Token In:', tokenInAddress);
    console.log('Token Out:', tokenOutAddress);
    console.log('Amount In:', amountIn);

    if (!tokenInAddress || !tokenOutAddress || !amountIn) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Use environment variable for RPC URL if not provided
    const finalRpcUrl =
      rpcUrl ||
      process.env.JSON_RPC_PROVIDER_BASE ||
      process.env.ALCHEMY_RPC_URL ||
      'https://mainnet.base.org';
    console.log('Environment variables check:');
    console.log(
      '- JSON_RPC_PROVIDER_BASE:',
      process.env.JSON_RPC_PROVIDER_BASE
    );
    console.log('- ALCHEMY_RPC_URL:', process.env.ALCHEMY_RPC_URL);
    console.log('- Using RPC URL:', finalRpcUrl);

    if ((exactIn && exactOut) || (!exactIn && !exactOut)) {
      return res
        .status(400)
        .json({ error: 'Must set either exactIn or exactOut' });
    }

    const provider = new JsonRpcProvider(finalRpcUrl, chainId);
    console.log('Provider created with chainId:', chainId);

    const router = new AlphaRouter({
      chainId,
      provider,
    });
    console.log('AlphaRouter created');

    // Skip protocol parsing for now to avoid JSBI issues
    const parsedProtocols: any[] = [];

    // Create token objects
    let tokenIn: Currency;
    let tokenOut: Currency;

    // Check if tokens are native
    if (NATIVE_NAMES_BY_ID[chainId]?.includes(tokenInAddress)) {
      tokenIn = nativeOnChain(chainId);
      console.log('Token In is native');
    } else {
      tokenIn = new Token(chainId, tokenInAddress, tokenInDecimals || 18);
      console.log(
        'Token In created:',
        tokenInAddress,
        'decimals:',
        tokenInDecimals || 18
      );
    }

    if (NATIVE_NAMES_BY_ID[chainId]?.includes(tokenOutAddress)) {
      tokenOut = nativeOnChain(chainId);
      console.log('Token Out is native');
    } else {
      tokenOut = new Token(chainId, tokenOutAddress, tokenOutDecimals || 18);
      console.log(
        'Token Out created:',
        tokenOutAddress,
        'decimals:',
        tokenOutDecimals || 18
      );
    }

    let swapRoutes;

    if (exactIn) {
      const amountInParsed = parseAmount(amountIn.toString(), tokenIn);
      console.log('Parsed amount in:', amountInParsed.toString());

      const options: SwapOptionsSwapRouter02 | undefined = recipient
        ? {
            type: SwapType.SWAP_ROUTER_02,
            deadline: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
            recipient,
            slippageTolerance: new Percent(50, 10000), // 0.5% slippage
          }
        : undefined;

      const routingOptions = {
        v3PoolSelection: {
          topN: 2,
          topNTokenInOut: 2,
          topNSecondHop: 1,
          topNWithEachBaseToken: 2,
          topNWithBaseToken: 6,
          topNWithBaseTokenInSet: 2,
          topNDirectSwaps: 2,
        },
        maxSwapsPerPath: 3,
        minSplits: 1,
        maxSplits: 2,
        distributionPercent: 10,
        protocols: parsedProtocols,
        forceCrossProtocol,
        forceMixedRoutes,
        debugRouting,
        enableFeeOnTransferFeeFetching,
        gasToken,
      };

      console.log('Starting route calculation...');
      swapRoutes = await router.route(
        amountInParsed,
        tokenOut,
        TradeType.EXACT_INPUT,
        options,
        routingOptions
      );
      console.log('Route calculation completed');
    } else {
      const amountOutParsed = parseAmount(amountIn.toString(), tokenOut);

      const options: SwapOptionsSwapRouter02 | undefined = recipient
        ? {
            type: SwapType.SWAP_ROUTER_02,
            deadline: Math.floor(Date.now() / 1000) + 1800,
            recipient,
            slippageTolerance: new Percent(50, 10000), // 0.5% slippage
          }
        : undefined;

      const routingOptions = {
        v3PoolSelection: {
          topN: 2,
          topNTokenInOut: 2,
          topNSecondHop: 1,
          topNWithEachBaseToken: 2,
          topNWithBaseToken: 6,
          topNWithBaseTokenInSet: 2,
          topNDirectSwaps: 2,
        },
        maxSwapsPerPath: 3,
        minSplits: 1,
        maxSplits: 2,
        distributionPercent: 10,
        protocols: parsedProtocols,
        forceCrossProtocol,
        forceMixedRoutes,
        debugRouting,
        enableFeeOnTransferFeeFetching,
        gasToken,
      };

      console.log('Starting route calculation (exact output)...');
      swapRoutes = await router.route(
        amountOutParsed,
        tokenIn,
        TradeType.EXACT_OUTPUT,
        options,
        routingOptions
      );
      console.log('Route calculation completed');
    }

    if (!swapRoutes) {
      return res.status(404).json({
        error:
          'Could not find route. Try adjusting parameters or check token addresses.',
      });
    }

    const {
      blockNumber,
      estimatedGasUsed,
      estimatedGasUsedQuoteToken,
      estimatedGasUsedUSD,
      estimatedGasUsedGasToken,
      gasPriceWei,
      methodParameters,
      quote,
      quoteGasAdjusted,
      route: routeAmounts,
      simulationStatus,
    } = swapRoutes;

    res.json({
      success: true,
      route: {
        blockNumber,
        estimatedGasUsed,
        estimatedGasUsedQuoteToken,
        estimatedGasUsedUSD,
        estimatedGasUsedGasToken,
        gasPriceWei,
        methodParameters,
        quote,
        quoteGasAdjusted,
        routeAmounts,
        simulationStatus,
      },
      amountOut: quote.toExact(),
    });
  } catch (error) {
    console.error('Swap routing error:', error);
    res.status(500).json({
      error: 'Failed to generate swap route',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Swap route endpoint: POST http://localhost:${PORT}/swap-route`);
});

export default app;
