<?php

namespace App\Notifications;

use App\Models\Product;
use App\Models\ProductWarning;
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
        return ['database'];
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
