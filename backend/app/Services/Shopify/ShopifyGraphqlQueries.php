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
        variants(first: 20) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id title sku barcode price compareAtPrice
              selectedOptions { name value }
              media(first: 1) { nodes { ... on MediaImage { image { url } } preview { image { url } } } }
              inventoryItem {
                id tracked
                inventoryLevels(first: 10) {
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
            inventoryLevels(first: 10) {
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
    variants(first: 20) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id title sku barcode price compareAtPrice
          selectedOptions { name value }
          media(first: 1) { nodes { ... on MediaImage { image { url } } preview { image { url } } } }
          inventoryItem {
            id tracked
            inventoryLevels(first: 10) {
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
        lineItems(first: 25) {
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
        fulfillmentOrders(first: 5) {
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
        lineItems(first: 25) {
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
        fulfillmentOrders(first: 5) {
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

    public const PRODUCT_VARIANTS_BULK_UPDATE_PRICES = <<<'GRAPHQL'
mutation ProductVariantsBulkUpdatePrices($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    productVariants { id price compareAtPrice }
    userErrors { field message code }
  }
}
GRAPHQL;

    public const DISCOUNT_CODE_BASIC_CREATE = <<<'GRAPHQL'
mutation DiscountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
  discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
    codeDiscountNode { id }
    userErrors { field message code }
  }
}
GRAPHQL;

    public const DISCOUNT_CODE_BASIC_UPDATE = <<<'GRAPHQL'
mutation DiscountCodeBasicUpdate($id: ID!, $basicCodeDiscount: DiscountCodeBasicInput!) {
  discountCodeBasicUpdate(id: $id, basicCodeDiscount: $basicCodeDiscount) {
    codeDiscountNode { id }
    userErrors { field message code }
  }
}
GRAPHQL;

    public const DISCOUNT_CODE_DEACTIVATE = <<<'GRAPHQL'
mutation DiscountCodeDeactivate($id: ID!) {
  discountCodeDeactivate(id: $id) {
    codeDiscountNode { id }
    userErrors { field message code }
  }
}
GRAPHQL;

    public const DISCOUNT_CODE_DELETE = <<<'GRAPHQL'
mutation DiscountCodeDelete($id: ID!) {
  discountCodeDelete(id: $id) {
    deletedCodeDiscountId
    userErrors { field message code }
  }
}
GRAPHQL;

    public const DISCOUNT_AUTOMATIC_BXGY_CREATE = <<<'GRAPHQL'
mutation DiscountAutomaticBxgyCreate($automaticBxgyDiscount: DiscountAutomaticBxgyInput!) {
  discountAutomaticBxgyCreate(automaticBxgyDiscount: $automaticBxgyDiscount) {
    automaticDiscountNode { id }
    userErrors { field message code }
  }
}
GRAPHQL;

    public const DISCOUNT_AUTOMATIC_BXGY_UPDATE = <<<'GRAPHQL'
mutation DiscountAutomaticBxgyUpdate($id: ID!, $automaticBxgyDiscount: DiscountAutomaticBxgyInput!) {
  discountAutomaticBxgyUpdate(id: $id, automaticBxgyDiscount: $automaticBxgyDiscount) {
    automaticDiscountNode { id }
    userErrors { field message code }
  }
}
GRAPHQL;

    public const DISCOUNT_AUTOMATIC_DELETE = <<<'GRAPHQL'
mutation DiscountAutomaticDelete($id: ID!) {
  discountAutomaticDelete(id: $id) {
    deletedAutomaticDiscountId
    userErrors { field message code }
  }
}
GRAPHQL;

    public const CODE_DISCOUNT_NODES_PAGE = <<<'GRAPHQL'
query FetchCodeDiscounts($first: Int!, $after: String) {
  codeDiscountNodes(first: $first, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      codeDiscount {
        ... on DiscountCodeBasic {
          title status startsAt endsAt usageLimit asyncUsageCount
          codes(first: 1) { nodes { code } }
          minimumRequirement { ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount } } }
          customerGets { value { ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } } } }
        }
      }
    }
  }
}
GRAPHQL;

    public const AUTOMATIC_DISCOUNT_NODES_PAGE = <<<'GRAPHQL'
query FetchAutomaticDiscounts($first: Int!, $after: String) {
  automaticDiscountNodes(first: $first, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      automaticDiscount {
        ... on DiscountAutomaticBxgy {
          title status startsAt endsAt
          customerBuys { value { ... on DiscountQuantity { quantity } } }
          customerGets { value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } } }
        }
      }
    }
  }
}
GRAPHQL;

    public const DISCOUNT_NODE_BY_ID = <<<'GRAPHQL'
query FetchDiscountNodeById($id: ID!) {
  discountNode(id: $id) {
    id
    discount {
      ... on DiscountCodeBasic {
        title status startsAt endsAt usageLimit asyncUsageCount
        codes(first: 1) { nodes { code } }
        minimumRequirement { ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount } } }
        customerGets { value { ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } } } }
      }
      ... on DiscountAutomaticBxgy {
        title status startsAt endsAt
        customerBuys { value { ... on DiscountQuantity { quantity } } }
        customerGets { value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } } }
      }
    }
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
