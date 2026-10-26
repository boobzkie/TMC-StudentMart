<?php

namespace App\Notifications;

use App\Models\Complaint;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ComplaintStatusNotification extends Notification
{
    public function __construct(private readonly Complaint $complaint) {}

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
        $label = match ($this->complaint->status) {
            'in_review' => 'Under review',
            'resolved' => 'Resolved',
            'rejected' => 'Rejected',
            default => 'Updated',
        };

        return [
            'event' => 'complaint_status_changed',
            'title' => 'Complaint '.$label,
            'message' => 'Your complaint “'.$this->complaint->subject.'” is '.$label.'.',
            'complaint_id' => (int) $this->complaint->id,
            'status' => (string) $this->complaint->status,
        ];
    }
}
