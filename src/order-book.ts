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
  const expendInput = (event.params.options & 2) === 2
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
    true,
  )

  let currentOrderIndex = depth.latestTakenOrderIndex
  let remainingTakenRawAmount = event.params.rawAmount
  while (remainingTakenRawAmount.gt(BigInt.zero())) {
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
    const filledRawAmount = remainingTakenRawAmount.lt(
      openOrderRemainingRawAmount,
    )
      ? remainingTakenRawAmount
      : openOrderRemainingRawAmount
    openOrder.rawFilledAmount = openOrder.rawFilledAmount.plus(filledRawAmount)
    const inputAmount =
      isTakingBidSide === 1
        ? orderBookContract.rawToBase(filledRawAmount, priceIndex, true)
        : orderBookContract.rawToQuote(filledRawAmount)
    const outputAmount =
      isTakingBidSide === 1
        ? orderBookContract.rawToQuote(filledRawAmount)
        : orderBookContract.rawToBase(filledRawAmount, priceIndex, false)
    openOrder.filledAmount = openOrder.filledAmount.plus(
      expendInput ? inputAmount : outputAmount,
    )
    remainingTakenRawAmount = remainingTakenRawAmount.minus(filledRawAmount)
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
  const claimedRawAmount = event.params.rawAmount
  const nftId = encodeToNftId(isBid, priceIndex, orderIndex)
  const openOrderId = buildOpenOrderId(marketAddress, nftId)
  const openOrder = OpenOrder.load(openOrderId)
  if (openOrder === null) {
    return
  }
  const orderBookContract = OrderBookContract.bind(marketAddress)
  openOrder.rawClaimedAmount = openOrder.rawClaimedAmount.plus(claimedRawAmount)
  openOrder.baseClaimedAmount = openOrder.baseClaimedAmount.plus(
    orderBookContract.rawToBase(claimedRawAmount, priceIndex, isBid),
  )
  openOrder.save()
}
