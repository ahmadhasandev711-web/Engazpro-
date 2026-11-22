<?php

namespace App\Models\Easyfy;

use Illuminate\Database\Eloquent\Model;

class EasyfyStoreSetting extends Model
{
    protected $table = 'easyfy_store_settings';

    protected $fillable = ['key', 'value'];
}
