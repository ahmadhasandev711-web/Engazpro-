<?php

namespace App\Enums;

enum ImportRowStatus: string
{
    case VALID = 'VALID';
    case INVALID = 'INVALID';
    case DUPLICATE_IN_FILE = 'DUPLICATE_IN_FILE';
    case DUPLICATE = 'DUPLICATE';
}
