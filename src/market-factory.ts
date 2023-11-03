import { BigInt } from '@graphprotocol/graph-ts'

import {
  CreateStableMarket,
  CreateVolatileMarket,
} from '../generated/MarketFactory/MarketFactory'
import { Market } from '../generated/schema'
import {
  OrderNFT as OrderNFTTemplate,
  OrderBook as OrderBookTemplate,
} from '../generated/templates'
import { OrderBook as OrderBookContract } from '../generated/templates/OrderNFT/OrderBook'
import { PriceBook as PriceBookContract } from '../generated/MarketFactory/PriceBook'

import { createToken } from './helpers'

export function handleCreateStableMarket(event: CreateStableMarket): void {
  const quoteToken = createToken(event.params.quoteToken)
  const baseToken = createToken(event.params.baseToken)
  const market = new Market(event.params.market.toHexString()) as Market
  const orderBookContract = OrderBookContract.bind(event.params.market)
  const priceBookContract = PriceBookContract.bind(
    orderBookContract.priceBook(),
  )
  market.orderToken = event.params.orderToken
  market.baseToken = baseToken.id
  market.quoteToken = quoteToken.id
  market.quoteUnit = event.params.quoteUnit
  market.makerFee = BigInt.fromI32(event.params.makerFee)
  market.takerFee = BigInt.fromI32(event.params.takerFee)
  market.a = event.params.a
  market.d = event.params.d
  market.r = BigInt.fromI32(0)
  market.latestPriceIndex = BigInt.zero()
  market.latestPrice = BigInt.zero()

  market.maxPriceIndex = BigInt.fromI32(priceBookContract.maxPriceIndex())
  market.priceUpperBound = priceBookContract.priceUpperBound()

  // create the tracked contract based on the template
  OrderNFTTemplate.create(event.params.orderToken)
  OrderBookTemplate.create(event.params.market)

  market.save()
}

export function handleCreateVolatileMarket(event: CreateVolatileMarket): void {
  const quoteToken = createToken(event.params.quoteToken)
  const baseToken = createToken(event.params.baseToken)
  const market = new Market(event.params.market.toHexString()) as Market
  const orderBookContract = OrderBookContract.bind(event.params.market)
  const priceBookContract = PriceBookContract.bind(
    orderBookContract.priceBook(),
  )
  market.orderToken = event.params.orderToken
  market.baseToken = baseToken.id
  market.quoteToken = quoteToken.id
  market.quoteUnit = event.params.quoteUnit
  market.makerFee = BigInt.fromI32(event.params.makerFee)
  market.takerFee = BigInt.fromI32(event.params.takerFee)
  market.a = event.params.a
  market.d = BigInt.fromI32(0)
  market.r = event.params.r
  market.latestPriceIndex = BigInt.zero()
  market.latestPrice = BigInt.zero()

  market.maxPriceIndex = BigInt.fromI32(priceBookContract.maxPriceIndex())
  market.priceUpperBound = priceBookContract.priceUpperBound()

  // create the tracked contract based on the template
  OrderNFTTemplate.create(event.params.orderToken)
  OrderBookTemplate.create(event.params.market)

  market.save()
}
