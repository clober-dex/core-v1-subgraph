import { BigInt, store } from '@graphprotocol/graph-ts'

import {
  Transfer,
  OrderNFT as OrderNFTContract,
} from '../generated/templates/OrderNFT/OrderNFT'
import { OrderBook as OrderBookContract } from '../generated/templates/OrderNFT/OrderBook'
import { Depth, OpenOrder } from '../generated/schema'

import {
  ADDRESS_ZERO,
  buildOpenOrderId,
  buildOrderKey,
  decodeIsBidFromNftId,
  decodeOrderIndexFromNftId,
  decodePriceIndexFromNftId,
} from './helpers'

export function handleNFTTransfer(event: Transfer): void {
  const from = event.params.from.toHexString()
  const to = event.params.to.toHexString()
  const orderNFTContract = OrderNFTContract.bind(event.address)
  const marketAddress = orderNFTContract.market()
  const orderBookContract = OrderBookContract.bind(marketAddress)
  const nftId = event.params.tokenId
  const bidSide = decodeIsBidFromNftId(nftId)
  const isBid = bidSide ? 1 : 0
  const priceIndex = decodePriceIndexFromNftId(nftId)
  const price = orderBookContract.indexToPrice(priceIndex)
  const orderIndex = decodeOrderIndexFromNftId(nftId)

  /// open order
  const orderInfo = orderBookContract.getOrder(
    buildOrderKey(bidSide, priceIndex, orderIndex),
  )
  const openOrderId = buildOpenOrderId(marketAddress, nftId)
  let openOrder = OpenOrder.load(openOrderId)
  if (openOrder === null) {
    openOrder = new OpenOrder(openOrderId)
  }

  if (from == ADDRESS_ZERO) {
    // MakeOrder
    openOrder.market = marketAddress.toHexString()
    openOrder.priceIndex = BigInt.fromI32(priceIndex)
    openOrder.price = price
    openOrder.isBid = bidSide
    openOrder.orderIndex = orderIndex
    openOrder.rawAmount = orderInfo.amount
    openOrder.amount = bidSide
      ? orderBookContract.rawToQuote(orderInfo.amount)
      : orderBookContract.rawToBase(orderInfo.amount, priceIndex, true)
    openOrder.rawFilledAmount = BigInt.zero()
    openOrder.baseFilledAmount = BigInt.zero()
    openOrder.rawClaimedAmount = BigInt.zero()
    openOrder.baseClaimedAmount = BigInt.zero()
    openOrder.bountyAmount = orderInfo.claimBounty
    openOrder.createdAt = event.block.timestamp
    openOrder.txHash = event.transaction.hash.toHexString()
    openOrder.user = to
    openOrder.save()
  } else if (to == ADDRESS_ZERO) {
    store.remove('OpenOrder', openOrderId)
  } else {
    openOrder.user = to
    openOrder.save()
  }

  // depth
  if (from != ADDRESS_ZERO && to != ADDRESS_ZERO) {
    return
  }

  const depthId = marketAddress
    .toHexString()
    .concat('-')
    .concat(priceIndex.toString())
    .concat('-')
    .concat(isBid.toString())
  let depth = Depth.load(depthId)
  const depthRawAmount = orderBookContract.getDepth(bidSide, priceIndex)
  if (depth === null) {
    depth = new Depth(depthId)
    depth.market = marketAddress.toHexString()
    depth.priceIndex = BigInt.fromI32(priceIndex)
    depth.price = price
    depth.isBid = bidSide
    depth.latestTakenOrderIndex = BigInt.zero()
  }
  depth.rawAmount = depthRawAmount
  depth.baseAmount = orderBookContract.rawToBase(
    depthRawAmount,
    priceIndex,
    true,
  )

  if (depthRawAmount.equals(BigInt.fromI32(0))) {
    store.remove('Depth', depthId)
  } else {
    depth.save()
  }
}
