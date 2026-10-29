<?php

namespace App\Models;

use App\Notifications\ResetPasswordNotification;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }

    protected $attributes = [
        'email_notifications_enabled' => false,
        'in_app_notifications_enabled' => true,
    ];

    protected $fillable = [
        'name',
        'student_id',
        'email',
        'contact_number',
        'password',
        'role',
        'status',
        'profile_picture',
        'course',
        'facebook_url',
        'instagram_url',
        'tiktok_url',
        'share_contact_info',
        'username',
        'bio',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'share_contact_info' => 'boolean',
            'email_notifications_enabled' => 'boolean',
            'in_app_notifications_enabled' => 'boolean',
            'suspended_until' => 'datetime',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isStaff(): bool
    {
        return $this->role === 'staff';
    }

    public function isStudent(): bool
    {
        return $this->role === 'student';
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isSuspended(): bool
    {
        return $this->status === 'suspended';
    }

    public function staffProfile(): HasOne
    {
        return $this->hasOne(StaffProfile::class);
    }

    public function enforcementEvents(): HasMany
    {
        return $this->hasMany(AccountEnforcementEvent::class)->latest();
    }

    public function hasStaffPermission(string $permission): bool
    {
        return $this->isStaff()
            && $this->staffProfile?->hasPermission($permission) === true;
    }

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function followers(): BelongsToMany
    {
        return $this->belongsToMany(
            self::class,
            'student_follows',
            'following_id',
            'follower_id'
        )->withTimestamps();
    }

    public function following(): BelongsToMany
    {
        return $this->belongsToMany(
            self::class,
            'student_follows',
            'follower_id',
            'following_id'
        )->withTimestamps();
    }

    public function productReviews(): HasMany
    {
        return $this->hasMany(ProductReview::class, 'reviewer_id');
    }

    public function complaints()
    {
        return $this->hasMany(Complaint::class);
    }
}
