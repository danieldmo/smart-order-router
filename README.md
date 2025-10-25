# Uniswap Smart Order Router Express Server

A simple Express server that exposes the Uniswap Smart Order Router functionality via HTTP endpoints.

## Features

- 🚀 **Fast & Lightweight** - Uses the official npm package instead of building from source
- 🔄 **CORS Enabled** - Ready for frontend integration
- 📊 **Comprehensive Logging** - Detailed request/response logging
- 🌐 **Multi-chain Support** - Supports Ethereum, Base, Polygon, Arbitrum, Optimism
- 💰 **Native Token Support** - Handles ETH, MATIC, and other native tokens
- 🛡️ **TypeScript** - Full type safety and IntelliSense support

## Quick Start

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env` file in the root directory:

```env
# RPC URLs (optional - defaults to Base mainnet)
JSON_RPC_PROVIDER_BASE=https://mainnet.base.org
ALCHEMY_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY

# Server port (optional - defaults to 3001)
PORT=3001
```

### Running the Server

**Development:**

```bash
npm run start
```

**Production:**

```bash
npm run build
npm run start:prod
```

The server will start on port 3001 (or your configured PORT).

## API Endpoints

### Health Check

- **GET** `/health`
- Returns server status and timestamp

### Swap Route

- **POST** `/swap-route`
- Generates optimal swap routes using the Uniswap Smart Order Router

#### Request Parameters

| Parameter          | Type    | Required | Description                               |
| ------------------ | ------- | -------- | ----------------------------------------- |
| `tokenInAddress`   | string  | ✅       | Address of input token                    |
| `tokenOutAddress`  | string  | ✅       | Address of output token                   |
| `amountIn`         | string  | ✅       | Amount to swap (in token's smallest unit) |
| `tokenInDecimals`  | number  | ❌       | Decimals for input token (default: 18)    |
| `tokenOutDecimals` | number  | ❌       | Decimals for output token (default: 18)   |
| `recipient`        | string  | ❌       | Address to receive output tokens          |
| `rpcUrl`           | string  | ❌       | Custom RPC URL                            |
| `chainId`          | number  | ❌       | Chain ID (default: 8453 for Base)         |
| `exactIn`          | boolean | ❌       | Use exact input (default: true)           |
| `exactOut`         | boolean | ❌       | Use exact output (default: false)         |

#### Example Request

```bash
curl -X POST http://localhost:3001/swap-route \
  -H "Content-Type: application/json" \
  -d '{
    "tokenInAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "tokenOutAddress": "0x4200000000000000000000000000000000000006",
    "amountIn": "1000000",
    "tokenInDecimals": 6,
    "tokenOutDecimals": 18,
    "recipient": "0x1234567890123456789012345678901234567890",
    "chainId": 8453
  }'
```

#### Example Response

```json
{
  "success": true,
  "route": {
    "blockNumber": 12345678,
    "estimatedGasUsed": "150000",
    "estimatedGasUsedQuoteToken": "0.001",
    "estimatedGasUsedUSD": "2.50",
    "gasPriceWei": "20000000000",
    "methodParameters": {
      "calldata": "0x...",
      "value": "0x0"
    },
    "quote": "0.95",
    "quoteGasAdjusted": "0.94",
    "routeAmounts": [...],
    "simulationStatus": "SUCCESS"
  },
  "amountOut": "0.95"
}
```

## Supported Chains

| Chain            | Chain ID | Native Token |
| ---------------- | -------- | ------------ |
| Ethereum Mainnet | 1        | ETH          |
| Base             | 8453     | ETH          |
| Polygon          | 137      | MATIC        |
| Arbitrum One     | 42161    | ETH          |
| Optimism         | 10       | ETH          |

## Deployment

### Railway

1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy - Railway will automatically run `npm ci` and `npm run start`

### Other Platforms

The server works with any Node.js hosting platform:

- Vercel
- Heroku
- DigitalOcean App Platform
- AWS Lambda (with serverless-express)

## Development

### Project Structure

```
├── server/
│   └── index.ts          # Main server file
├── package.json          # Dependencies and scripts
├── .env                  # Environment variables
└── README.md            # This file
```

### Adding New Features

1. Modify `server/index.ts`
2. Add new endpoints as needed
3. Test locally with `npm run start`
4. Deploy to your platform

## Troubleshooting

### Common Issues

**Network Detection Error:**

- Ensure your RPC URL is correct and accessible
- Check that the chainId matches your RPC provider

**Token Not Found:**

- Verify token addresses are correct for the specified chain
- Check token decimals are accurate

**Route Not Found:**

- Ensure sufficient liquidity exists for the token pair
- Try adjusting amount or slippage tolerance

### Logs

The server provides detailed logging for debugging:

- Request parameters
- Environment variables
- Token creation
- Route calculation progress
- Error details

## License

This project is licensed under the GPL License - see the LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:

- Check the logs for detailed error information
- Verify your environment variables
- Ensure all dependencies are properly installed
