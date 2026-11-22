<?php

namespace App\Mail;

use App\Models\Easyfy\EasyfyOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class EasyfyNewOrderAdminMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public EasyfyOrder $order,
        public bool $isProofReupload = false
    ) {}

    public function envelope(): Envelope
    {
        $prefix = $this->isProofReupload ? 'إعادة رفع إثبات تحويل' : 'طلب جديد في متجر Easyfy';

        return new Envelope(
            subject: "{$prefix} — {$this->order->order_number}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.easyfy-new-order-admin',
            with: [
                'order' => $this->order,
                'isProofReupload' => $this->isProofReupload,
            ],
        );
    }
}
