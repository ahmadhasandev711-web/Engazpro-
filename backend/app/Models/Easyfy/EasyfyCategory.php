<?php

namespace App\Models\Easyfy;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EasyfyCategory extends Model
{
    protected $table = 'easyfy_categories';

    protected $fillable = [
        'name', 'slug', 'description', 'image_path', 'sort_order', 'is_active',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function products(): HasMany
    {
        return $this->hasMany(EasyfyProduct::class, 'category_id');
    }
}
