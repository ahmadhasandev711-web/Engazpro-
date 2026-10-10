<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Create branches table
        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->string('code');
            $table->string('type')->default('STORE'); // STORE, WAREHOUSE, VAN
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            $table->boolean('is_main')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'code']);
            $table->index(['user_id', 'is_main']);
        });

        // 2. Create branch_stocks table
        Schema::create('branch_stocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->cascadeOnDelete();
            $table->decimal('quantity', 12, 2)->default(0);
            $table->decimal('min_quantity', 12, 2)->nullable();
            $table->timestamps();

            $table->unique(['branch_id', 'product_id', 'product_variant_id'], 'branch_product_variant_unique');
            $table->index(['branch_id', 'quantity']);
        });

        // 3. Create stock_transfers table
        Schema::create('stock_transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('transfer_number');
            $table->foreignId('from_branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('to_branch_id')->constrained('branches')->cascadeOnDelete();
            $table->string('status')->default('PENDING'); // PENDING, IN_TRANSIT, RECEIVED, CANCELLED
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('transferred_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'transfer_number']);
            $table->index(['from_branch_id', 'status']);
            $table->index(['to_branch_id', 'status']);
        });

        // 4. Create stock_transfer_items table
        Schema::create('stock_transfer_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_transfer_id')->constrained('stock_transfers')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->decimal('quantity_sent', 12, 2);
            $table->decimal('quantity_received', 12, 2)->nullable();
            $table->string('unit_name')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // 5. Add branch_id to existing tables
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('branch_id')->nullable()->after('role')->constrained('branches')->nullOnDelete();
        });

        Schema::table('treasuries', function (Blueprint $table) {
            $table->foreignId('branch_id')->nullable()->after('user_id')->constrained('branches')->nullOnDelete();
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->foreignId('branch_id')->nullable()->after('user_id')->constrained('branches')->nullOnDelete();
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->foreignId('branch_id')->nullable()->after('user_id')->constrained('branches')->nullOnDelete();
        });

        // 6. Migrate existing data: Create default Main Branch for existing owners
        $owners = DB::table('users')->whereNull('owner_id')->get();
        foreach ($owners as $owner) {
            $branchId = DB::table('branches')->insertGetId([
                'user_id' => $owner->id,
                'name' => 'الفرع الرئيسي',
                'code' => 'BR-01',
                'type' => 'STORE',
                'is_main' => true,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Link owner and its employees
            DB::table('users')->where('id', $owner->id)->orWhere('owner_id', $owner->id)->update(['branch_id' => $branchId]);

            // Link existing treasuries, invoices, stock movements
            DB::table('treasuries')->where('user_id', $owner->id)->update(['branch_id' => $branchId]);
            DB::table('invoices')->where('user_id', $owner->id)->update(['branch_id' => $branchId]);
            DB::table('stock_movements')->where('user_id', $owner->id)->update(['branch_id' => $branchId]);

            // Populate branch_stocks for existing products
            $products = DB::table('products')->where('user_id', $owner->id)->whereNull('deleted_at')->get();
            foreach ($products as $prod) {
                // If product has variants
                $variants = DB::table('product_variants')->where('product_id', $prod->id)->whereNull('deleted_at')->get();
                if ($variants->count() > 0) {
                    foreach ($variants as $variant) {
                        DB::table('branch_stocks')->insert([
                            'branch_id' => $branchId,
                            'product_id' => $prod->id,
                            'product_variant_id' => $variant->id,
                            'quantity' => $variant->quantity ?? 0,
                            'min_quantity' => $variant->min_quantity,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                } else {
                    DB::table('branch_stocks')->insert([
                        'branch_id' => $branchId,
                        'product_id' => $prod->id,
                        'product_variant_id' => null,
                        'quantity' => $prod->quantity ?? 0,
                        'min_quantity' => $prod->min_quantity,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('branch_id');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropConstrainedForeignId('branch_id');
        });

        Schema::table('treasuries', function (Blueprint $table) {
            $table->dropConstrainedForeignId('branch_id');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('branch_id');
        });

        Schema::dropIfExists('stock_transfer_items');
        Schema::dropIfExists('stock_transfers');
        Schema::dropIfExists('branch_stocks');
        Schema::dropIfExists('branches');
    }
};
