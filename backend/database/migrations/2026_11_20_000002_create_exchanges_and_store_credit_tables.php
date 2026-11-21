<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('parties', function (Blueprint $table) {
            $table->decimal('store_credit_balance', 12, 2)->default(0)->after('balance');
        });

        Schema::create('exchanges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('salesperson_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('exchange_number', 64);
            $table->string('idempotency_key', 100)->nullable();
            $table->string('source', 32);
            $table->string('status', 32);
            $table->foreignId('party_id')->nullable()->constrained('parties')->nullOnDelete();
            $table->foreignId('original_invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
            $table->foreignId('original_online_order_id')->nullable()->constrained('online_orders')->nullOnDelete();
            $table->foreignId('return_invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
            $table->foreignId('replacement_invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
            $table->foreignId('replacement_online_order_id')->nullable()->constrained('online_orders')->nullOnDelete();
            $table->decimal('return_total', 12, 2)->default(0);
            $table->decimal('replacement_total', 12, 2)->default(0);
            $table->decimal('exchange_shipping_fee', 12, 2)->default(0);
            $table->decimal('store_credit_used', 12, 2)->default(0);
            $table->decimal('net_amount', 12, 2)->default(0);
            $table->string('settlement_type', 32);
            $table->string('payment_method', 32)->nullable();
            $table->foreignId('treasury_id')->nullable()->constrained('treasuries')->nullOnDelete();
            $table->foreignId('shift_id')->nullable()->constrained('shifts')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'exchange_number']);
            $table->index(['user_id', 'status']);
            $table->index(['user_id', 'party_id']);
            $table->index(['user_id', 'idempotency_key']);
        });

        Schema::create('exchange_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('exchange_id')->constrained('exchanges')->cascadeOnDelete();
            $table->string('direction', 16);
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->foreignId('product_batch_id')->nullable()->constrained('product_batches')->nullOnDelete();
            $table->string('product_name');
            $table->string('variant_name')->nullable();
            $table->decimal('quantity', 12, 2);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('total', 12, 2);
            $table->string('condition', 16)->nullable();
            $table->timestamp('received_into_stock_at')->nullable();
            $table->timestamps();

            $table->index(['exchange_id', 'direction']);
        });

        Schema::create('store_credit_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('party_id')->constrained('parties')->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type', 32);
            $table->decimal('amount', 12, 2);
            $table->decimal('balance_after', 12, 2);
            $table->foreignId('exchange_id')->nullable()->constrained('exchanges')->nullOnDelete();
            $table->foreignId('invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
            $table->timestamp('expires_at')->nullable();
            $table->string('notes', 255)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'party_id']);
            $table->index(['party_id', 'expires_at']);
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->foreignId('exchange_id')->nullable()->after('parent_invoice_id')->constrained('exchanges')->nullOnDelete();
        });

        Schema::table('online_orders', function (Blueprint $table) {
            $table->boolean('is_exchange')->default(false)->after('invoice_id');
            $table->foreignId('exchange_id')->nullable()->after('is_exchange')->constrained('exchanges')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('online_orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('exchange_id');
            $table->dropColumn('is_exchange');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropConstrainedForeignId('exchange_id');
        });

        Schema::dropIfExists('store_credit_transactions');
        Schema::dropIfExists('exchange_items');
        Schema::dropIfExists('exchanges');

        Schema::table('parties', function (Blueprint $table) {
            $table->dropColumn('store_credit_balance');
        });
    }
};
