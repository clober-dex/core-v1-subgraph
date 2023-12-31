import { BigInt, store } from '@graphprotocol/graph-ts'

import {
  OrderBook as OrderBookContract,
  TakeOrder,
  ClaimOrder,
} from '../generated/templates/OrderNFT/OrderBook'
import { Depth, Market, OpenOrder } from '../generated/schema'

import { buildClaimKey, buildOpenOrderId, encodeToNftId } from './helpers'

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
  let remainingTakenRawAmount = event.params.rawAmount
  while (remainingTakenRawAmount.gt(BigInt.zero())) {
    const nftId = encodeToNftId(
      isTakingBidSide === 1,
      priceIndex,
      currentOrderIndex,
    )
    const openOrderId = buildOpenOrderId(marketAddress, nftId)
    const openOrder = OpenOrder.load(openOrderId)
    if (openOrder === null) {
      currentOrderIndex = currentOrderIndex.plus(BigInt.fromI32(1))
      continue
    }
    const claimableResult = orderBookContract.getClaimable(
      buildClaimKey(isTakingBidSide === 1, priceIndex, currentOrderIndex),
    )
    openOrder.claimableAmount = claimableResult.getClaimableAmount()
    const openOrderRemainingRawAmount = openOrder.rawAmount.minus(
      openOrder.rawFilledAmount,
    )
    const filledRawAmount = remainingTakenRawAmount.lt(
      openOrderRemainingRawAmount,
    )
      ? remainingTakenRawAmount
      : openOrderRemainingRawAmount

    remainingTakenRawAmount = remainingTakenRawAmount.minus(filledRawAmount)
    openOrder.rawFilledAmount = openOrder.rawFilledAmount.plus(filledRawAmount)
    openOrder.baseFilledAmount = orderBookContract.rawToBase(
      openOrder.rawFilledAmount,
      priceIndex,
      false,
    )
    openOrder.save()

    if (openOrder.rawAmount == openOrder.rawFilledAmount) {
      currentOrderIndex = currentOrderIndex.plus(BigInt.fromI32(1))
    }
  }

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
  const claimableResult = orderBookContract.getClaimable(
    buildClaimKey(isBid, priceIndex, orderIndex),
  )
  openOrder.rawClaimedAmount = openOrder.rawClaimedAmount.plus(claimedRawAmount)
  openOrder.claimableAmount = claimableResult.getClaimableAmount()
  openOrder.save()
}
