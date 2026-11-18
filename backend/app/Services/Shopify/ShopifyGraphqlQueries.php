<?php

namespace App\Services\Shopify;

final class ShopifyGraphqlQueries
{
    public const SHOP_INFO = '{ shop { name currencyCode myshopifyDomain } }';

    public const LOCATIONS = '{ locations(first: 50, includeLegacy: true) { edges { node { id name isActive fulfillsOnlineOrders } } } }';

    public const PRODUCTS_PAGE = <<<'GRAPHQL'
query FetchProducts($first: Int!, $after: String) {
  products(first: $first, after: $after) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        id title productType hasOnlyDefaultVariant status
        featuredMedia { preview { image { url } } }
        variants(first: 50) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id title sku barcode price compareAtPrice
              selectedOptions { name value }
              media(first: 1) { nodes { ... on MediaImage { image { url } } preview { image { url } } } }
              inventoryItem {
                id tracked
                inventoryLevels(first: 20) {
                  nodes { location { id name } quantities(names: ["available"]) { quantity } }
                }
              }
            }
          }
        }
      }
    }
  }
}
GRAPHQL;

    public const PRODUCT_VARIANTS_PAGE = <<<'GRAPHQL'
query FetchProductVariants($id: ID!, $first: Int!, $after: String) {
  product(id: $id) {
    variants(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id title sku barcode price compareAtPrice
          selectedOptions { name value }
          media(first: 1) { nodes { ... on MediaImage { image { url } } preview { image { url } } } }
          inventoryItem {
            id tracked
            inventoryLevels(first: 20) {
              nodes { location { id name } quantities(names: ["available"]) { quantity } }
            }
          }
        }
      }
    }
  }
}
GRAPHQL;

    public const PRODUCT_BY_ID = <<<'GRAPHQL'
query FetchProductById($id: ID!) {
  product(id: $id) {
    id title productType hasOnlyDefaultVariant status
    featuredMedia { preview { image { url } } }
    variants(first: 50) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id title sku barcode price compareAtPrice
          selectedOptions { name value }
          media(first: 1) { nodes { ... on MediaImage { image { url } } preview { image { url } } } }
          inventoryItem {
            id tracked
            inventoryLevels(first: 20) {
              nodes { location { id name } quantities(names: ["available"]) { quantity } }
            }
          }
        }
      }
    }
  }
}
GRAPHQL;

    public const SET_INVENTORY_QUANTITIES = <<<'GRAPHQL'
mutation SetInventory($input: InventorySetQuantitiesInput!, $idempotencyKey: String!) {
  inventorySetQuantities(input: $input) @idempotent(key: $idempotencyKey) {
    inventoryAdjustmentGroup { reason createdAt }
    userErrors { field message code }
  }
}
GRAPHQL;

    public const INVENTORY_ACTIVATE = <<<'GRAPHQL'
mutation ActivateInventory($inventoryItemId: ID!, $locationId: ID!) {
  inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId) {
    inventoryLevel { id }
    userErrors { field message code }
  }
}
GRAPHQL;

    public const ORDERS_PAGE = <<<'GRAPHQL'
query FetchOrders($first: Int!, $after: String, $query: String) {
  orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        id name createdAt displayFinancialStatus displayFulfillmentStatus cancelledAt note
        taxesIncluded currencyCode paymentGatewayNames discountCodes
        currentTotalPriceSet { shopMoney { amount currencyCode } }
        currentTotalDiscountsSet { shopMoney { amount } }
        totalShippingPriceSet { shopMoney { amount } }
        currentTotalTaxSet { shopMoney { amount } }
        customer { id firstName lastName email phone }
        shippingAddress { firstName lastName phone address1 address2 city province }
        discountApplications(first: 10) {
          edges { node { allocationMethod targetType value { ... on MoneyV2 { amount } ... on PricingPercentageValue { percentage } } } }
        }
        lineItems(first: 50) {
          edges {
            node {
              id title quantity currentQuantity sku
              originalUnitPriceSet { shopMoney { amount } }
              product { id }
              variant {
                id title price compareAtPrice
                media(first: 1) { nodes { ... on MediaImage { image { url } } preview { image { url } } } }
              }
            }
          }
        }
        fulfillmentOrders(first: 10) {
          edges { node { id status assignedLocation { location { id name } } } }
        }
      }
    }
  }
}
GRAPHQL;

    public const ORDERS_PAGE_NO_PII = <<<'GRAPHQL'
query FetchOrdersNoPii($first: Int!, $after: String, $query: String) {
  orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        id name createdAt displayFinancialStatus displayFulfillmentStatus cancelledAt note
        taxesIncluded currencyCode paymentGatewayNames discountCodes
        currentTotalPriceSet { shopMoney { amount currencyCode } }
        currentTotalDiscountsSet { shopMoney { amount } }
        totalShippingPriceSet { shopMoney { amount } }
        currentTotalTaxSet { shopMoney { amount } }
        discountApplications(first: 10) {
          edges { node { allocationMethod targetType value { ... on MoneyV2 { amount } ... on PricingPercentageValue { percentage } } } }
        }
        lineItems(first: 50) {
          edges {
            node {
              id title quantity currentQuantity sku
              originalUnitPriceSet { shopMoney { amount } }
              product { id }
              variant {
                id title price compareAtPrice
                media(first: 1) { nodes { ... on MediaImage { image { url } } preview { image { url } } } }
              }
            }
          }
        }
        fulfillmentOrders(first: 10) {
          edges { node { id status assignedLocation { location { id name } } } }
        }
      }
    }
  }
}
GRAPHQL;

    public const ORDER_BY_ID = <<<'GRAPHQL'
query FetchOrderById($id: ID!) {
  order(id: $id) {
    id name createdAt displayFinancialStatus displayFulfillmentStatus cancelledAt note
    taxesIncluded currencyCode paymentGatewayNames discountCodes
    currentTotalPriceSet { shopMoney { amount currencyCode } }
    currentTotalDiscountsSet { shopMoney { amount } }
    totalShippingPriceSet { shopMoney { amount } }
    currentTotalTaxSet { shopMoney { amount } }
    customer { id firstName lastName email phone }
    shippingAddress { firstName lastName phone address1 address2 city province }
    discountApplications(first: 10) {
      edges { node { allocationMethod targetType value { ... on MoneyV2 { amount } ... on PricingPercentageValue { percentage } } } }
    }
    lineItems(first: 50) {
      edges {
        node {
          id title quantity currentQuantity sku
          originalUnitPriceSet { shopMoney { amount } }
          product { id }
          variant {
            id title price compareAtPrice
            media(first: 1) { nodes { ... on MediaImage { image { url } } preview { image { url } } } }
          }
        }
      }
    }
    fulfillmentOrders(first: 10) {
      edges { node { id status assignedLocation { location { id name } } } }
    }
  }
}
GRAPHQL;

    public const ORDER_FULFILLMENT_ORDERS = <<<'GRAPHQL'
query FetchFulfillmentOrders($id: ID!) {
  order(id: $id) {
    fulfillmentOrders(first: 10) {
      edges {
        node {
          id status
          assignedLocation { location { id name } }
          lineItems(first: 50) { edges { node { id remainingQuantity } } }
        }
      }
    }
  }
}
GRAPHQL;

    public const CREATE_FULFILLMENT = <<<'GRAPHQL'
mutation CreateFulfillment($fulfillment: FulfillmentInput!) {
  fulfillmentCreate(fulfillment: $fulfillment) {
    fulfillment { id status }
    userErrors { field message }
  }
}
GRAPHQL;

    public const REGISTER_WEBHOOK = <<<'GRAPHQL'
mutation RegisterWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
  webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
    webhookSubscription { id topic uri }
    userErrors { field message }
  }
}
GRAPHQL;

    public const ORDER_CANCEL = <<<'GRAPHQL'
mutation CancelOrder($orderId: ID!, $reason: OrderCancelReason!, $notifyCustomer: Boolean, $restock: Boolean!, $staffNote: String) {
  orderCancel(
    orderId: $orderId
    reason: $reason
    notifyCustomer: $notifyCustomer
    restock: $restock
    staffNote: $staffNote
  ) {
    job { id }
    orderCancelUserErrors { field message code }
  }
}
GRAPHQL;

    /**
     * Shared media extraction for GraphQL ProductVariant `media` connection and legacy `image` payload.
     *
     * @param  array<string, mixed>  $variantNode
     */
    public static function extractVariantMediaUrl(array $variantNode): ?string
    {
        $mediaNode = $variantNode['media']['nodes'][0] ?? null;
        if (is_array($mediaNode)) {
            $url = $mediaNode['image']['url'] ?? ($mediaNode['preview']['image']['url'] ?? null);
            if (!empty($url)) {
                return (string) $url;
            }
        }

        return !empty($variantNode['image']['url']) ? (string) $variantNode['image']['url'] : null;
    }
}
