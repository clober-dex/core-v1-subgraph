import {
  Address,
  BigDecimal,
  BigInt,
  ethereum,
  TypedMap,
} from '@graphprotocol/graph-ts'

import { ERC20 } from '../generated/MarketFactory/ERC20'
import { ERC20SymbolBytes } from '../generated/MarketFactory/ERC20SymbolBytes'
import { ERC20NameBytes } from '../generated/MarketFactory/ERC20NameBytes'
import { Token } from '../generated/schema'
import {
  OrderBook__getClaimableInputOrderKeyStruct,
  OrderBook__getOrderInputOrderKeyStruct,
} from '../generated/templates/OrderNFT/OrderBook'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

export const CHART_LOG_INTERVALS = new TypedMap<string, number>()
CHART_LOG_INTERVALS.set('1m', 60)
CHART_LOG_INTERVALS.set('3m', 3 * 60)
CHART_LOG_INTERVALS.set('5m', 5 * 60)
CHART_LOG_INTERVALS.set('10m', 10 * 60)
CHART_LOG_INTERVALS.set('15m', 15 * 60)
CHART_LOG_INTERVALS.set('30m', 30 * 60)
CHART_LOG_INTERVALS.set('1h', 60 * 60)
CHART_LOG_INTERVALS.set('2h', 2 * 60 * 60)
CHART_LOG_INTERVALS.set('4h', 4 * 60 * 60)
CHART_LOG_INTERVALS.set('6h', 6 * 60 * 60)
CHART_LOG_INTERVALS.set('1d', 24 * 60 * 60)
CHART_LOG_INTERVALS.set('1w', 7 * 24 * 60 * 60)

export function createToken(tokenAddress: Address): Token {
  let token = Token.load(tokenAddress.toHexString())
  if (token === null) {
    token = new Token(tokenAddress.toHexString())
    token.symbol = fetchTokenSymbol(tokenAddress)
    token.name = fetchTokenName(tokenAddress)
    token.decimals = fetchTokenDecimals(tokenAddress)
  }
  token.save()
  return token
}

export function formatUnits(
  price: BigInt,
  decimals: u8 = 18 as u8,
): BigDecimal {
  return BigDecimal.fromString(price.toString()).div(
    BigDecimal.fromString(BigInt.fromString('10').pow(decimals).toString()),
  )
}

export function buildOrderKey(
  isBid: boolean,
  priceIndex: i32,
  orderIndex: BigInt,
): OrderBook__getOrderInputOrderKeyStruct {
  const fixedSizedArray: Array<ethereum.Value> = [
    ethereum.Value.fromBoolean(isBid),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(priceIndex)),
    ethereum.Value.fromUnsignedBigInt(orderIndex),
  ]
  return changetype<OrderBook__getOrderInputOrderKeyStruct>(fixedSizedArray)
}

export function buildClaimKey(
  isBid: boolean,
  priceIndex: i32,
  orderIndex: BigInt,
): OrderBook__getClaimableInputOrderKeyStruct {
  const fixedSizedArray: Array<ethereum.Value> = [
    ethereum.Value.fromBoolean(isBid),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(priceIndex)),
    ethereum.Value.fromUnsignedBigInt(orderIndex),
  ]
  return changetype<OrderBook__getClaimableInputOrderKeyStruct>(fixedSizedArray)
}

export function isNullEthValue(value: string): boolean {
  return (
    value ==
    '0x0000000000000000000000000000000000000000000000000000000000000001'
  )
}

export function buildOpenOrderId(
  marketAddress: Address,
  nftId: BigInt,
): string {
  return marketAddress.toHexString().concat('-').concat(nftId.toString())
}

export function buildChartLogId(
  marketAddress: Address,
  intervalType: string,
  timestamp: i64,
): string {
  return marketAddress
    .toHexString()
    .concat('-')
    .concat(intervalType)
    .concat('-')
    .concat(timestamp.toString())
}

export function encodeToNftId(
  isBid: boolean,
  priceIndex: i32,
  orderIndex: BigInt,
): BigInt {
  return BigInt.fromI32(isBid ? 1 : 0)
    .leftShift(248)
    .plus(BigInt.fromI32(priceIndex).leftShift(232))
    .plus(orderIndex)
}

export function decodeIsBidFromNftId(nftId: BigInt): boolean {
  return nftId.rightShift(248).toU64() === 1
}

export function decodePriceIndexFromNftId(nftId: BigInt): i32 {
  return nftId
    .rightShift(232)
    .bitAnd(BigInt.fromI32(2).pow(16).minus(BigInt.fromI32(1)))
    .toI32()
}

export function decodeOrderIndexFromNftId(nftId: BigInt): BigInt {
  return nftId.bitAnd(BigInt.fromI32(2).pow(232).minus(BigInt.fromI32(1)))
}

export function fetchTokenSymbol(tokenAddress: Address): string {
  const contract = ERC20.bind(tokenAddress)
  const contractSymbolBytes = ERC20SymbolBytes.bind(tokenAddress)

  // try types string and bytes32 for symbol
  let symbolValue = 'unknown'
  const symbolResult = contract.try_symbol()
  if (symbolResult.reverted) {
    const symbolResultBytes = contractSymbolBytes.try_symbol()
    if (!symbolResultBytes.reverted) {
      // for broken pairs that have no symbol function exposed
      if (!isNullEthValue(symbolResultBytes.value.toHexString())) {
        symbolValue = symbolResultBytes.value.toString()
      }
    }
  } else {
    symbolValue = symbolResult.value
  }

  return symbolValue
}

export function fetchTokenName(tokenAddress: Address): string {
  const contract = ERC20.bind(tokenAddress)
  const contractNameBytes = ERC20NameBytes.bind(tokenAddress)

  // try types string and bytes32 for name
  let nameValue = 'unknown'
  const nameResult = contract.try_name()
  if (nameResult.reverted) {
    const nameResultBytes = contractNameBytes.try_name()
    if (!nameResultBytes.reverted) {
      // for broken exchanges that have no name function exposed
      if (!isNullEthValue(nameResultBytes.value.toHexString())) {
        nameValue = nameResultBytes.value.toString()
      }
    }
  } else {
    nameValue = nameResult.value
  }

  return nameValue
}

export function fetchTokenDecimals(tokenAddress: Address): BigInt {
  const contract = ERC20.bind(tokenAddress)
  // try types uint8 for decimals
  let decimalValue = 18
  const decimalResult = contract.try_decimals()
  if (!decimalResult.reverted) {
    decimalValue = decimalResult.value
  }
  return BigInt.fromI32(decimalValue as i32)
}
