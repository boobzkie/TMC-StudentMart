<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\User;
use App\Notifications\OrderEventNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

class CheckSellerResponseDeadlines extends Command
{
    protected $signature = 'orders:check-seller-response-deadlines';

    protected $description = 'Flag pending orders whose seller has missed the 48-hour response deadline and notify relevant users.';

    public function handle(): int
    {
        $flagged = 0;

        Order::query()
            ->where('status', 'pending')
            ->where('needs_attention', false)
            ->whereNotNull('seller_response_deadline_at')
            ->where('seller_response_deadline_at', '<=', now())
            ->orderBy('id')
            ->chunkById(100, function ($orders) use (&$flagged): void {
                foreach ($orders as $candidate) {
                    $didFlag = DB::transaction(function () use ($candidate): ?Order {
                        $order = Order::query()
                            ->whereKey($candidate->id)
                            ->lockForUpdate()
                            ->first();

                        if (! $order
                            || $order->status !== 'pending'
                            || $order->needs_attention
                            || ! $order->seller_response_deadline_at
                            || $order->seller_response_deadline_at->isFuture()) {
                            return null;
                        }

                        $order->needs_attention = true;
                        $order->save();

                        return $order;
                    });

                    if ($didFlag instanceof Order) {
                        if ($didFlag->buyer instanceof \App\Models\User) {
                            $didFlag->buyer->notify(new OrderEventNotification($didFlag, 'seller_response_overdue'));
                        }

                        $recipients = User::query()
                            ->where(function ($query): void {
                                $query->where('role', 'admin')
                                    ->orWhere('role', 'staff');
                            })
                            ->where('status', 'active')
                            ->get();

                        Notification::send($recipients, new OrderEventNotification($didFlag, 'seller_response_overdue'));

                        $flagged++;
                    }
                }
            });

        $this->info("Flagged {$flagged} overdue seller response order(s).");

        return self::SUCCESS;
    }
}