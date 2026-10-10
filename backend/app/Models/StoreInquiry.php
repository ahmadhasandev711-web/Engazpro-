<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StoreInquiry extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'phone',
        'business_type',
        'city',
        'notes',
        'status',
        'admin_notes',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
