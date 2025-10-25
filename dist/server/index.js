"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config();
const providers_1 = require("@ethersproject/providers");
const sdk_core_1 = require("@uniswap/sdk-core");
const smart_order_router_1 = require("@uniswap/smart-order-router");
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || 'http://localhost:3000');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    }
    else {
        next();
    }
});
app.use(express_1.default.json());
const NATIVE_NAMES_BY_ID = {
    [sdk_core_1.ChainId.MAINNET]: ['ETH'],
    [sdk_core_1.ChainId.BASE]: ['ETH'],
    [sdk_core_1.ChainId.POLYGON]: ['MATIC'],
    [sdk_core_1.ChainId.ARBITRUM_ONE]: ['ETH'],
    [sdk_core_1.ChainId.OPTIMISM]: ['ETH'],
};
function nativeOnChain(chainId) {
    const nativeAddresses = {
        [sdk_core_1.ChainId.MAINNET]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        [sdk_core_1.ChainId.BASE]: '0x4200000000000000000000000000000000000006',
        [sdk_core_1.ChainId.POLYGON]: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        [sdk_core_1.ChainId.ARBITRUM_ONE]: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        [sdk_core_1.ChainId.OPTIMISM]: '0x4200000000000000000000000000000000000006',
    };
    const nativeAddress = nativeAddresses[chainId];
    if (!nativeAddress) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    return new sdk_core_1.Token(chainId, nativeAddress, 18);
}
function parseAmount(amount, currency) {
    return smart_order_router_1.CurrencyAmount.fromRawAmount(currency, amount);
}
app.get('/health', (_req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.post('/swap-route', async (req, res) => {
    try {
        const { recipient, tokenInAddress, tokenInDecimals, tokenOutAddress, tokenOutDecimals, amountIn, rpcUrl, chainId = sdk_core_1.ChainId.BASE, exactIn = true, exactOut = false, forceCrossProtocol = false, forceMixedRoutes = false, debugRouting = true, enableFeeOnTransferFeeFetching = false, gasToken, } = req.body;
        console.log('=== Swap Route Request ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('Chain ID:', chainId);
        console.log('Token In:', tokenInAddress);
        console.log('Token Out:', tokenOutAddress);
        console.log('Amount In:', amountIn);
        if (!tokenInAddress || !tokenOutAddress || !amountIn) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }
        const finalRpcUrl = rpcUrl ||
            process.env.JSON_RPC_PROVIDER_BASE ||
            process.env.ALCHEMY_RPC_URL ||
            'https://mainnet.base.org';
        console.log('Environment variables check:');
        console.log('- JSON_RPC_PROVIDER_BASE:', process.env.JSON_RPC_PROVIDER_BASE);
        console.log('- ALCHEMY_RPC_URL:', process.env.ALCHEMY_RPC_URL);
        console.log('- Using RPC URL:', finalRpcUrl);
        if ((exactIn && exactOut) || (!exactIn && !exactOut)) {
            return res
                .status(400)
                .json({ error: 'Must set either exactIn or exactOut' });
        }
        const provider = new providers_1.JsonRpcProvider(finalRpcUrl, chainId);
        console.log('Provider created with chainId:', chainId);
        const router = new smart_order_router_1.AlphaRouter({
            chainId,
            provider,
        });
        console.log('AlphaRouter created');
        const parsedProtocols = [];
        let tokenIn;
        let tokenOut;
        if (NATIVE_NAMES_BY_ID[chainId]?.includes(tokenInAddress)) {
            tokenIn = nativeOnChain(chainId);
            console.log('Token In is native');
        }
        else {
            tokenIn = new sdk_core_1.Token(chainId, tokenInAddress, tokenInDecimals || 18);
            console.log('Token In created:', tokenInAddress, 'decimals:', tokenInDecimals || 18);
        }
        if (NATIVE_NAMES_BY_ID[chainId]?.includes(tokenOutAddress)) {
            tokenOut = nativeOnChain(chainId);
            console.log('Token Out is native');
        }
        else {
            tokenOut = new sdk_core_1.Token(chainId, tokenOutAddress, tokenOutDecimals || 18);
            console.log('Token Out created:', tokenOutAddress, 'decimals:', tokenOutDecimals || 18);
        }
        let swapRoutes;
        if (exactIn) {
            const amountInParsed = parseAmount(amountIn.toString(), tokenIn);
            console.log('Parsed amount in:', amountInParsed.toString());
            const options = recipient
                ? {
                    type: smart_order_router_1.SwapType.SWAP_ROUTER_02,
                    deadline: Math.floor(Date.now() / 1000) + 1800,
                    recipient,
                    slippageTolerance: new sdk_core_1.Percent(50, 10000),
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
            swapRoutes = await router.route(amountInParsed, tokenOut, sdk_core_1.TradeType.EXACT_INPUT, options, routingOptions);
            console.log('Route calculation completed');
        }
        else {
            const amountOutParsed = parseAmount(amountIn.toString(), tokenOut);
            const options = recipient
                ? {
                    type: smart_order_router_1.SwapType.SWAP_ROUTER_02,
                    deadline: Math.floor(Date.now() / 1000) + 1800,
                    recipient,
                    slippageTolerance: new sdk_core_1.Percent(50, 10000),
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
            swapRoutes = await router.route(amountOutParsed, tokenIn, sdk_core_1.TradeType.EXACT_OUTPUT, options, routingOptions);
            console.log('Route calculation completed');
        }
        if (!swapRoutes) {
            return res.status(404).json({
                error: 'Could not find route. Try adjusting parameters or check token addresses.',
            });
        }
        const { blockNumber, estimatedGasUsed, estimatedGasUsedQuoteToken, estimatedGasUsedUSD, estimatedGasUsedGasToken, gasPriceWei, methodParameters, quote, quoteGasAdjusted, route: routeAmounts, simulationStatus, } = swapRoutes;
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
    }
    catch (error) {
        console.error('Swap routing error:', error);
        res.status(500).json({
            error: 'Failed to generate swap route',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Swap route endpoint: POST http://localhost:${PORT}/swap-route`);
});
exports.default = app;
