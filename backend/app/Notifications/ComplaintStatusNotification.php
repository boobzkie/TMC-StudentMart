<?php

namespace App\Notifications;

use App\Models\Complaint;
use Illuminate\Notifications\Notification;

class ComplaintStatusNotification extends Notification
{
    public function __construct(private readonly Complaint $complaint) {}

    public function via(object $notifiable): array
    {
        return ['database'];
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
