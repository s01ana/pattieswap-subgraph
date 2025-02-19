/* eslint-disable prefer-const */
import { Address, BigDecimal } from "@graphprotocol/graph-ts/index";
import { Bundle, Pair, Token } from "../generated/schema";
import { ADDRESS_ZERO, factoryContract, ONE_BD, ZERO_BD } from "./utils";

let WETH_ADDRESS = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";
let WETH_USDT_PAIR = "0xb36d3427d6229efc153a2d2ec0ba64f706349127";

export function getETHPriceInUSD(): BigDecimal {
  // fetch eth prices for each stablecoin
  let usdtPair = Pair.load(WETH_USDT_PAIR); // usdt is token1

  if (usdtPair !== null) {
    return usdtPair.token0Price;
  } else {
    return ZERO_BD;
  }
}

// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", // WETH
  // "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", // DAI
  "0x55d398326f99059fF775485246999027B3197955", // USDT
  // "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // USDC
  // "0x23396cf899ca06c4472205fc903bdb4de249d6fc", // UST
  // "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", // BTCB
  // "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", // WBTC (new)

  // "0x912CE59144191C1204E64559FE8253a0e49E6548", // ARB
];

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_ETH = BigDecimal.fromString("0.001");

/**
 * Search through graph to find derived BNB per token.
 * @todo update to be derived BNB (add stablecoin estimates)
 **/
export function findEthPerToken(token: Token): BigDecimal {
  if (token.id == WETH_ADDRESS) {
    return ONE_BD;
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairAddress = factoryContract.getPair(Address.fromString(token.id), Address.fromString(WHITELIST[i]));
    if (pairAddress.toHex() != ADDRESS_ZERO) {
      let pair = Pair.load(pairAddress.toHex());
      if (pair.token0 == token.id && pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token1 = Token.load(pair.token1);
        return pair.token1Price.times(token1.derivedETH as BigDecimal); // return token1 per our token * BNB per token 1
      }
      if (pair.token1 == token.id && pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token0 = Token.load(pair.token0);
        return pair.token0Price.times(token0.derivedETH as BigDecimal); // return token0 per our token * BNB per token 0
      }
    }
  }
  return ZERO_BD; // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  bundle: Bundle,
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedETH.times(bundle.ethPrice);
  let price1 = token1.derivedETH.times(bundle.ethPrice);

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1)).div(BigDecimal.fromString("2"));
  }

  // take full value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0);
  }

  // take full value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1);
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  bundle: Bundle,
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedETH.times(bundle.ethPrice);
  let price1 = token1.derivedETH.times(bundle.ethPrice);

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1));
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString("2"));
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString("2"));
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}
