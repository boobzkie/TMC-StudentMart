<?php

namespace App\Notifications;

use App\Models\Product;
use App\Models\ProductWarning;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ProductModerationNotification extends Notification
{
    public function __construct(
        private readonly Product $product,
        private readonly string $event,
        private readonly string $reason,
        private readonly ?ProductWarning $warning = null,
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
        $notification = $this->toDatabase($notifiable);

        return (new MailMessage)
            ->subject($notification['title'])
            ->greeting('Hello '.$notifiable->name.',')
            ->line($notification['message'])
            ->line('Sign in to TMC StudentMart to view more details.');
    }

    public function toDatabase(object $notifiable): array
    {
        $isWarning = $this->event === 'product_warning';

        return [
            'event' => $this->event,
            'title' => $isWarning ? 'Product listing warning' : 'Product listing suspended',
            'message' => $isWarning
                ? 'Your listing “'.$this->product->name.'” received a warning: '.$this->reason
                : 'Your listing “'.$this->product->name.'” was suspended: '.$this->reason,
            'product_id' => (int) $this->product->id,
            'warning_id' => $this->warning?->id,
            'status' => (string) $this->product->status,
        ];
    }
}
