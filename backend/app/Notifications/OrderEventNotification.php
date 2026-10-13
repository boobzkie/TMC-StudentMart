<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Notifications\Notification;

class OrderEventNotification extends Notification
{
    public function __construct(
        private readonly Order $order,
        private readonly string $event,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        [$title, $message] = match ($this->event) {
            'order_placed' => [
                'New order request',
                'Order '.$this->order->order_number.' was placed and is waiting for your review.',
            ],
            'order_accepted' => [
                'Order accepted',
                'The seller accepted order '.$this->order->order_number.'.',
            ],
            'order_declined' => [
                'Order declined',
                'The seller declined order '.$this->order->order_number.'.',
            ],
            'order_ready_for_pickup' => [
                'Ready for pickup',
                'Order '.$this->order->order_number.' is ready for pickup.',
            ],
            'order_completed' => [
                'Order completed',
                'The seller marked order '.$this->order->order_number.' as completed.',
            ],
            'order_cancelled' => [
                'Order cancelled',
                'The buyer cancelled order '.$this->order->order_number.'.',
            ],
            default => [
                'Order updated',
                'Order '.$this->order->order_number.' has been updated.',
            ],
        };

        return [
            'event' => $this->event,
            'title' => $title,
            'message' => $message,
            'order_id' => (int) $this->order->id,
            'order_number' => (string) $this->order->order_number,
            'status' => (string) $this->order->status,
        ];
    }
}