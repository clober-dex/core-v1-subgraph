import { BigInt, store } from '@graphprotocol/graph-ts'

import {
  OrderBook as OrderBookContract,
  TakeOrder,
  ClaimOrder,
} from '../generated/templates/OrderNFT/OrderBook'
import { Depth, Market, OpenOrder } from '../generated/schema'

import { buildOpenOrderId, encodeToNftId } from './helpers'

export function handleTakeOrder(event: TakeOrder): void {
  const marketAddress = event.address
  const priceIndex = event.params.priceIndex
  const isTakingBidSide = event.params.options & 1 ? 0 : 1
  const depthId = marketAddress
    .toHexString()
    .concat('-')
    .concat(priceIndex.toString())
    .concat('-')
    .concat(isTakingBidSide.toString())
  const market = Market.load(marketAddress.toHexString())
  const depth = Depth.load(depthId)
  if (market === null || depth === null) {
    return
  }
  const orderBookContract = OrderBookContract.bind(marketAddress)
  const depthRawAmount = orderBookContract.getDepth(
    isTakingBidSide === 1,
    priceIndex,
  )
  const price = orderBookContract.indexToPrice(priceIndex)
  market.latestPriceIndex = BigInt.fromI32(priceIndex)
  market.latestPrice = price
  depth.rawAmount = depthRawAmount
  depth.baseAmount = orderBookContract.rawToBase(
    depthRawAmount,
    priceIndex,
    false,
  )

  let currentOrderIndex = depth.latestTakenOrderIndex
  let rawAmount = event.params.rawAmount
  while (rawAmount.gt(BigInt.zero())) {
    const nftId = encodeToNftId(
      isTakingBidSide === 1,
      priceIndex,
      currentOrderIndex,
    )
    const openOrderId = buildOpenOrderId(marketAddress, nftId)
    const openOrder = OpenOrder.load(openOrderId)

    currentOrderIndex = currentOrderIndex.plus(BigInt.fromI32(1))

    if (openOrder === null) {
      continue
    }

    const openOrderRemainingRawAmount = openOrder.rawAmount.minus(
      openOrder.rawFilledAmount,
    )
    const filledRawAmount = rawAmount.lt(openOrderRemainingRawAmount)
      ? rawAmount
      : openOrderRemainingRawAmount
    openOrder.rawFilledAmount = openOrder.rawFilledAmount.plus(filledRawAmount)
    openOrder.baseFilledAmount = openOrder.baseFilledAmount.plus(
      orderBookContract.rawToBase(filledRawAmount, priceIndex, false),
    )
    rawAmount = rawAmount.minus(filledRawAmount)
    openOrder.save()
  }
  depth.latestTakenOrderIndex = currentOrderIndex.minus(BigInt.fromI32(1))

  if (depthRawAmount.equals(BigInt.fromI32(0))) {
    store.remove('Depth', depthId)
  } else {
    depth.save()
  }

  market.save()
}

export function handleClaimOrder(event: ClaimOrder): void {
  const marketAddress = event.address
  const isBid = event.params.isBase
  const priceIndex = event.params.priceIndex
  const orderIndex = event.params.orderIndex
  const rawAmount = event.params.rawAmount
  const nftId = encodeToNftId(isBid, priceIndex, orderIndex)
  const openOrderId = buildOpenOrderId(marketAddress, nftId)
  const openOrder = OpenOrder.load(openOrderId)
  if (openOrder === null) {
    return
  }
  const orderBookContract = OrderBookContract.bind(marketAddress)
  openOrder.rawClaimedAmount = openOrder.rawClaimedAmount.plus(rawAmount)
  openOrder.baseClaimedAmount = openOrder.baseClaimedAmount.plus(
    orderBookContract.rawToBase(rawAmount, priceIndex, isBid),
  )
  openOrder.save()
}
