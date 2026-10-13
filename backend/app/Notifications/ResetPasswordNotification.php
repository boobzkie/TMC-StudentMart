<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly string $token)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $frontendUrl = rtrim((string) config('app.frontend_url', 'http://localhost:5173'), '/');
        $resetUrl = $frontendUrl.'/password/reset?'.http_build_query([
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ]);
        $expiresIn = (int) config('auth.passwords.users.expire', 60);

        return (new MailMessage())
            ->subject('Reset your TMC StudentMart password')
            ->greeting('Hello '.$notifiable->name.',')
            ->line('We received a request to reset the password for your TMC StudentMart account.')
            ->action('Reset password', $resetUrl)
            ->line("This link expires in {$expiresIn} minutes and can only be used once.")
            ->line('If you did not request a password reset, you can ignore this email.');
    }
}
