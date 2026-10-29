<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AccountEnforcementNotification extends Notification
{
    public function __construct(
        private readonly string $action,
        private readonly string $reason,
        private readonly ?int $durationDays = null,
        private readonly ?string $suspendedUntil = null,
    ) {}

    public function via(object $notifiable): array
    {
        $channels = [];

        if ($notifiable->in_app_notifications_enabled ?? true) {
            $channels[] = 'database';
        }

        if ($notifiable->email_notifications_enabled ?? false) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $data = $this->toDatabase($notifiable);

        return (new MailMessage)
            ->subject($data['title'])
            ->greeting('Hello '.$notifiable->name.',')
            ->line($data['message'])
            ->line('Sign in to TMC StudentMart to review your account status.');
    }

    public function toDatabase(object $notifiable): array
    {
        $isSuspension = $this->action === 'suspension';
        $message = $isSuspension
            ? 'Your account has been suspended for '.$this->durationDays.' day(s) until '.$this->suspendedUntil.'. Reason: '.$this->reason
            : 'You have received an account warning. Reason: '.$this->reason;

        return [
            'event' => $isSuspension ? 'account_suspended' : 'account_warning',
            'title' => $isSuspension ? 'Account suspension' : 'Account warning',
            'message' => $message,
            'status' => $isSuspension ? 'suspended' : 'active',
            'duration_days' => $this->durationDays,
            'suspended_until' => $this->suspendedUntil,
        ];
    }
}
