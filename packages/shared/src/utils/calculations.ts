import { InvoiceType, PartyType } from '../enums';
import { Money } from './currency';

export interface CalculationItem {
  quantity: number;
  unit_price: number;
  purchase_price?: number;
}

export interface InvoiceCalculations {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  remaining_amount: number;
  total_cost?: number;
  gross_profit?: number;
}

/**
 * حساب إجماليات الفاتورة باستخدام كائن Money لمنع أخطاء التقريب
 */
export function calculateInvoiceTotals(
  items: CalculationItem[],
  discount: number = 0,
  tax: number = 0,
  paid_amount: number = 0
): InvoiceCalculations {
  let subtotalMoney = Money.zero();
  let totalCostMoney = Money.zero();
  let hasCost = false;

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const itemTotal = Money.of(item.unit_price).multiply(qty);
    subtotalMoney = subtotalMoney.add(itemTotal);

    if (item.purchase_price !== undefined) {
      hasCost = true;
      const itemCost = Money.of(item.purchase_price).multiply(qty);
      totalCostMoney = totalCostMoney.add(itemCost);
    }
  }

  const discountMoney = Money.of(Math.max(0, Number(discount) || 0));
  const taxMoney = Money.of(Math.max(0, Number(tax) || 0));
  const totalMoney = subtotalMoney.subtract(discountMoney).add(taxMoney);
  const safeTotal = totalMoney.isNegative() ? Money.zero() : totalMoney;

  const paidMoney = Money.of(Math.max(0, Number(paid_amount) || 0));
  const remainingMoney = safeTotal.subtract(paidMoney);
  const safeRemaining = remainingMoney.isNegative() ? Money.zero() : remainingMoney;

  const grossProfitMoney = hasCost ? safeTotal.subtract(totalCostMoney) : undefined;

  return {
    subtotal: subtotalMoney.getAmount(),
    discount: discountMoney.getAmount(),
    tax: taxMoney.getAmount(),
    total: safeTotal.getAmount(),
    remaining_amount: safeRemaining.getAmount(),
    total_cost: hasCost ? totalCostMoney.getAmount() : undefined,
    gross_profit: grossProfitMoney !== undefined ? grossProfitMoney.getAmount() : undefined,
  };
}

/**
 * حساب صافي الربح باستخدام كائن Money
 */
export function calculateNetProfit(
  totalSales: number | string,
  costOfGoodsSold: number | string,
  totalExpenses: number | string
): { grossProfit: number; netProfit: number } {
  const gross = Money.of(totalSales).subtract(Money.of(costOfGoodsSold));
  const net = gross.subtract(Money.of(totalExpenses));
  return {
    grossProfit: gross.getAmount(),
    netProfit: net.getAmount(),
  };
}

/**
 * حساب حركة الرصيد في كشف الحساب باستخدام كائن Money
 */
export function calculatePartyBalanceImpact(
  partyType: PartyType,
  invoiceType?: InvoiceType,
  amount: number | string = 0,
  isPayment: boolean = false,
  paymentType?: 'PAYMENT' | 'RECEIPT'
): { debit: number; credit: number; balanceChange: number } {
  const moneyAmount = Money.of(amount);
  let debitMoney = Money.zero();
  let creditMoney = Money.zero();

  if (isPayment) {
    if (paymentType === 'RECEIPT') {
      creditMoney = moneyAmount;
    } else {
      debitMoney = moneyAmount;
    }
  } else if (invoiceType) {
    switch (invoiceType) {
      case InvoiceType.SALE:
        debitMoney = moneyAmount;
        break;
      case InvoiceType.SALE_RETURN:
        creditMoney = moneyAmount;
        break;
      case InvoiceType.PURCHASE:
        creditMoney = moneyAmount;
        break;
      case InvoiceType.PURCHASE_RETURN:
        debitMoney = moneyAmount;
        break;
    }
  }

  const balanceChangeMoney =
    partyType === PartyType.CUSTOMER
      ? debitMoney.subtract(creditMoney)
      : creditMoney.subtract(debitMoney);

  return {
    debit: debitMoney.getAmount(),
    credit: creditMoney.getAmount(),
    balanceChange: balanceChangeMoney.getAmount(),
  };
}

