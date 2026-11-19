<?php

namespace App\Enums;

enum CrmRiskLevel: string
{
    case NONE = 'NONE';
    case LOW = 'LOW';
    case MEDIUM = 'MEDIUM';
    case HIGH = 'HIGH';
}
