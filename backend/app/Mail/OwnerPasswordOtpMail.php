<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OwnerPasswordOtpMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $merchant,
        public string $otpCode,
        public int $ttlMinutes = 10
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'رمز استعادة كلمة المرور — نظام EBMS',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.owner-password-otp',
            with: [
                'userName' => $this->merchant->name,
                'otpCode' => $this->otpCode,
                'ttlMinutes' => $this->ttlMinutes,
            ],
        );
    }
}
