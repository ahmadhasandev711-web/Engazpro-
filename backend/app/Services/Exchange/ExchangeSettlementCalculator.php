<?php

namespace App\Services\Exchange;

use App\Enums\ExchangeSettlementType;
use App\Support\Money;

class ExchangeSettlementCalculator
{
    /**
     * @return array{
     *   return_total: Money,
     *   replacement_total: Money,
     *   shipping_fee: Money,
     *   gross_replacement_due: Money,
     *   exchange_offset: Money,
     *   store_credit_used: Money,
     *   net_customer_due: Money,
     *   net_refund: Money,
     *   store_credit_earned: Money,
     *   signed_net_amount: Money,
     *   settlement_type: ExchangeSettlementType
     * }
     */
    public function calculate(
        Money $returnTotal,
        Money $replacementTotal,
        Money $shippingFee,
        Money $requestedStoreCredit,
        ExchangeSettlementType $surplusPreference = ExchangeSettlementType::STORE_CREDIT
    ): array {
        $grossDue = $replacementTotal->add($shippingFee);
        $offset = $returnTotal->lessThan($grossDue) ? $returnTotal : $grossDue;
        $rawDiff = $grossDue->subtract($returnTotal);

        if ($rawDiff->isZero()) {
            return $this->buildPlan($returnTotal, $replacementTotal, $shippingFee, $grossDue, $offset, Money::zero(), Money::zero(), Money::zero(), Money::zero(), Money::zero(), ExchangeSettlementType::EVEN_EXCHANGE);
        }

        if ($rawDiff->isPositive()) {
            $creditUsed = $requestedStoreCredit->lessThan($rawDiff) ? $requestedStoreCredit : $rawDiff;
            $rawRemaining = $rawDiff->subtract($creditUsed);
            $due = $rawRemaining->isNegative() ? Money::zero() : $rawRemaining;

            return $this->buildPlan($returnTotal, $replacementTotal, $shippingFee, $grossDue, $offset, $creditUsed, $due, Money::zero(), Money::zero(), $due, ExchangeSettlementType::CUSTOMER_PAYS);
        }

        return $this->buildSurplusPlan($returnTotal, $replacementTotal, $shippingFee, $grossDue, $offset, $returnTotal->subtract($grossDue), $surplusPreference);
    }

    private function buildSurplusPlan(
        Money $returnTotal,
        Money $replacementTotal,
        Money $shippingFee,
        Money $grossDue,
        Money $offset,
        Money $surplus,
        ExchangeSettlementType $preference
    ): array {
        $isCashRefund = $preference === ExchangeSettlementType::REFUND_CASH;
        $refund = $isCashRefund ? $surplus : Money::zero();
        $earned = $isCashRefund ? Money::zero() : $surplus;
        $signed = Money::zero()->subtract($surplus);
        $type = $isCashRefund ? ExchangeSettlementType::REFUND_CASH : ExchangeSettlementType::STORE_CREDIT;

        return $this->buildPlan($returnTotal, $replacementTotal, $shippingFee, $grossDue, $offset, Money::zero(), Money::zero(), $refund, $earned, $signed, $type);
    }

    private function buildPlan(
        Money $returnTotal,
        Money $replacementTotal,
        Money $shippingFee,
        Money $grossDue,
        Money $offset,
        Money $creditUsed,
        Money $due,
        Money $refund,
        Money $earned,
        Money $signedNet,
        ExchangeSettlementType $type
    ): array {
        return [
            'return_total' => $returnTotal,
            'replacement_total' => $replacementTotal,
            'shipping_fee' => $shippingFee,
            'gross_replacement_due' => $grossDue,
            'exchange_offset' => $offset,
            'store_credit_used' => $creditUsed,
            'net_customer_due' => $due,
            'net_refund' => $refund,
            'store_credit_earned' => $earned,
            'signed_net_amount' => $signedNet,
            'settlement_type' => $type,
        ];
    }
}
