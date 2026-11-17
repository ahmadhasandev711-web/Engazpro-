<?php

use App\Enums\EcommercePlatform;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('online_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('platform', 32);
            $table->string('external_order_id', 64);
            $table->string('external_order_number', 64)->nullable();
            $table->timestamp('order_date')->nullable();
            $table->foreignId('party_id')->nullable()->constrained('parties')->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('mandob_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('shipping_type')->nullable();
            $table->foreignId('courier_party_id')->nullable()->constrained('parties')->nullOnDelete();
            $table->string('courier_name')->nullable();
            $table->string('tracking_number')->nullable();
            $table->timestamp('shipped_at')->nullable();
            $table->foreignId('invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
            $table->string('status')->default(WcOrderStatus::PENDING_CONFIRMATION->value);
            $table->timestamp('call_confirmed_at')->nullable();
            $table->string('call_confirmed_by')->nullable();
            $table->foreignId('call_confirmed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('payment_status')->default(WcPaymentStatus::PENDING_COD->value);
            $table->string('payment_method_label', 64)->nullable();
            $table->decimal('shipping_cost', 12, 2)->default(0);
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount_total', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);
            $table->string('customer_name')->nullable();
            $table->string('customer_phone')->nullable();
            $table->string('customer_email')->nullable();
            $table->text('customer_address')->nullable();
            $table->string('governorate')->nullable();
            $table->string('city')->nullable();
            $table->text('notes')->nullable();
            $table->json('coupon_codes')->nullable();
            $table->json('discount_breakdown')->nullable();
            $table->json('items_snapshot')->nullable();
            $table->json('platform_meta')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'platform', 'external_order_id'], 'online_orders_user_platform_ext_unique');
            $table->index(['user_id', 'platform', 'status']);
            $table->index(['user_id', 'status']);
            $table->index(['branch_id', 'status']);
            $table->index(['mandob_id', 'status']);
            $table->index(['courier_party_id', 'status']);
            $table->index(['user_id', 'order_date']);
        });

        Schema::create('online_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('online_order_id')->constrained('online_orders')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->string('external_product_id', 64)->nullable();
            $table->string('external_variant_id', 64)->nullable();
            $table->decimal('quantity', 10, 2);
            $table->timestamps();

            $table->index(['user_id', 'product_id', 'product_variant_id'], 'online_order_items_user_prod_var_idx');
            $table->index('online_order_id');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->foreignId('online_order_id')->nullable()->after('shopify_order_id')
                ->constrained('online_orders')->nullOnDelete();
            $table->unique(['user_id', 'online_order_id'], 'invoices_user_online_order_unique');
        });

        $wcIdMap = $this->migrateWooCommerceOrders();
        $this->migrateShopifyOrders();
        $this->rebuildAnoofyOutbox($wcIdMap);

        Schema::dropIfExists('wc_order_items');
        Schema::dropIfExists('wc_orders');
        Schema::dropIfExists('shopify_order_items');
        Schema::dropIfExists('shopify_orders');
    }

    /**
     * @return array<int, int> Old wc_orders.id => new online_orders.id
     */
    private function migrateWooCommerceOrders(): array
    {
        if (!Schema::hasTable('wc_orders')) {
            return [];
        }

        $idMap = [];
        $orders = DB::table('wc_orders')->orderBy('id')->get();
        foreach ($orders as $row) {
            $newId = DB::table('online_orders')->insertGetId([
                'user_id' => $row->user_id,
                'platform' => EcommercePlatform::WOOCOMMERCE->value,
                'external_order_id' => (string) $row->wc_order_id,
                'external_order_number' => '#' . $row->wc_order_id,
                'order_date' => $row->order_date,
                'party_id' => $row->party_id,
                'branch_id' => $row->branch_id,
                'mandob_id' => $row->mandob_id,
                'shipping_type' => $row->shipping_type,
                'courier_party_id' => $row->courier_party_id,
                'courier_name' => $row->courier_name,
                'tracking_number' => $row->tracking_number,
                'shipped_at' => $row->shipped_at,
                'invoice_id' => $row->invoice_id,
                'status' => $row->status,
                'call_confirmed_at' => $row->call_confirmed_at,
                'call_confirmed_by' => $row->call_confirmed_by,
                'payment_status' => $row->payment_status,
                'payment_method_label' => $row->wc_payment_method,
                'shipping_cost' => $row->shipping_cost,
                'subtotal' => $row->subtotal,
                'discount_total' => $row->discount_total,
                'total' => $row->total,
                'customer_name' => $row->customer_name,
                'customer_phone' => $row->customer_phone,
                'customer_email' => $row->customer_email,
                'customer_address' => $row->customer_address,
                'governorate' => $row->governorate,
                'city' => $row->city,
                'notes' => $row->notes,
                'coupon_codes' => $row->wc_coupon_codes,
                'discount_breakdown' => null,
                'items_snapshot' => $row->items_snapshot,
                'platform_meta' => json_encode([
                    'anoofy_order_version' => $row->anoofy_order_version ?? null,
                    'anoofy_outbound_version' => $row->anoofy_outbound_version ?? 0,
                ]),
                'created_at' => $row->created_at,
                'updated_at' => $row->updated_at,
            ]);
            $idMap[(int) $row->id] = $newId;

            if ($row->invoice_id) {
                DB::table('invoices')->where('id', $row->invoice_id)->update(['online_order_id' => $newId]);
            }
        }

        if (Schema::hasTable('wc_order_items')) {
            foreach (DB::table('wc_order_items')->orderBy('id')->get() as $item) {
                if (!isset($idMap[(int) $item->wc_order_id])) {
                    continue;
                }
                DB::table('online_order_items')->insert([
                    'user_id' => $item->user_id,
                    'online_order_id' => $idMap[(int) $item->wc_order_id],
                    'product_id' => $item->product_id,
                    'product_variant_id' => $item->product_variant_id,
                    'external_product_id' => $item->wc_product_id !== null ? (string) $item->wc_product_id : null,
                    'external_variant_id' => $item->wc_variation_id !== null ? (string) $item->wc_variation_id : null,
                    'quantity' => $item->quantity,
                    'created_at' => $item->created_at,
                    'updated_at' => $item->updated_at,
                ]);
            }
        }

        return $idMap;
    }

    private function migrateShopifyOrders(): void
    {
        if (!Schema::hasTable('shopify_orders')) {
            return;
        }

        $idMap = [];
        foreach (DB::table('shopify_orders')->orderBy('id')->get() as $row) {
            $newId = DB::table('online_orders')->insertGetId([
                'user_id' => $row->user_id,
                'platform' => EcommercePlatform::SHOPIFY->value,
                'external_order_id' => (string) $row->shopify_order_id,
                'external_order_number' => $row->shopify_order_number ?: '#' . $row->shopify_order_id,
                'order_date' => $row->order_date,
                'party_id' => $row->party_id,
                'branch_id' => $row->branch_id,
                'mandob_id' => $row->mandob_id,
                'shipping_type' => $row->shipping_type,
                'courier_party_id' => $row->courier_party_id,
                'courier_name' => $row->courier_name,
                'tracking_number' => $row->tracking_number,
                'shipped_at' => $row->shipped_at,
                'invoice_id' => $row->invoice_id,
                'status' => $row->status,
                'call_confirmed_at' => $row->call_confirmed_at,
                'call_confirmed_by' => $row->call_confirmed_by,
                'payment_status' => $row->payment_status,
                'payment_method_label' => $row->shopify_payment_gateway,
                'shipping_cost' => $row->shipping_cost,
                'subtotal' => $row->subtotal,
                'discount_total' => $row->discount_total,
                'total' => $row->total,
                'customer_name' => $row->customer_name,
                'customer_phone' => $row->customer_phone,
                'customer_email' => $row->customer_email,
                'customer_address' => $row->customer_address,
                'governorate' => $row->governorate,
                'city' => $row->city,
                'notes' => $row->notes,
                'coupon_codes' => $row->coupon_codes,
                'discount_breakdown' => $row->discount_breakdown,
                'items_snapshot' => $row->items_snapshot,
                'platform_meta' => json_encode([
                    'shopify_location_id' => $row->shopify_location_id,
                    'fulfillment_order_id' => $row->fulfillment_order_id,
                ]),
                'created_at' => $row->created_at,
                'updated_at' => $row->updated_at,
            ]);
            $idMap[(int) $row->id] = $newId;

            if ($row->invoice_id) {
                DB::table('invoices')->where('id', $row->invoice_id)->update(['online_order_id' => $newId]);
            }
        }

        if (Schema::hasTable('shopify_order_items')) {
            foreach (DB::table('shopify_order_items')->orderBy('id')->get() as $item) {
                if (!isset($idMap[(int) $item->shopify_order_id])) {
                    continue;
                }
                DB::table('online_order_items')->insert([
                    'user_id' => $item->user_id,
                    'online_order_id' => $idMap[(int) $item->shopify_order_id],
                    'product_id' => $item->product_id,
                    'product_variant_id' => $item->product_variant_id,
                    'external_product_id' => $item->shopify_product_id !== null ? (string) $item->shopify_product_id : null,
                    'external_variant_id' => $item->shopify_variant_id !== null ? (string) $item->shopify_variant_id : null,
                    'quantity' => $item->quantity,
                    'created_at' => $item->created_at,
                    'updated_at' => $item->updated_at,
                ]);
            }
        }
    }

    /**
     * @param array<int, int> $wcIdMap
     */
    private function rebuildAnoofyOutbox(array $wcIdMap): void
    {
        if (!Schema::hasTable('anoofy_outbox_events')) {
            return;
        }

        $existing = DB::table('anoofy_outbox_events')->orderBy('id')->get();
        Schema::drop('anoofy_outbox_events');

        Schema::create('anoofy_outbox_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->uuid('event_id')->unique();
            $table->string('event_type', 50);
            $table->foreignId('online_order_id')->nullable()->constrained('online_orders')->cascadeOnDelete();
            $table->unsignedBigInteger('wc_order_id')->nullable();
            $table->unsignedInteger('order_version');
            $table->json('payload');
            $table->string('status', 30);
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->text('last_error')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });

        foreach ($existing as $row) {
            DB::table('anoofy_outbox_events')->insert([
                'id' => $row->id,
                'user_id' => $row->user_id,
                'event_id' => $row->event_id,
                'event_type' => $row->event_type,
                'online_order_id' => $wcIdMap[(int) $row->wc_order_id] ?? null,
                'wc_order_id' => $row->wc_order_id,
                'order_version' => $row->order_version,
                'payload' => $row->payload,
                'status' => $row->status,
                'attempts' => $row->attempts,
                'last_error' => $row->last_error,
                'sent_at' => $row->sent_at,
                'created_at' => $row->created_at,
                'updated_at' => $row->updated_at,
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropUnique('invoices_user_online_order_unique');
            $table->dropConstrainedForeignId('online_order_id');
        });
        Schema::dropIfExists('online_order_items');
        Schema::dropIfExists('online_orders');
    }
};
