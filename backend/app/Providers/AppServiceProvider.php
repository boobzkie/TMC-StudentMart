<?php

namespace App\Providers;

use App\Models\AccountEnforcementEvent;
use App\Models\Complaint;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductHistoryEvent;
use App\Models\ProductModerationEvent;
use App\Models\StaffApplicationEvent;
use App\Models\User;
use App\Observers\ActivityLogObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        User::observe(ActivityLogObserver::class);
        Product::observe(ActivityLogObserver::class);
        Order::observe(ActivityLogObserver::class);
        Complaint::observe(ActivityLogObserver::class);
        ProductModerationEvent::observe(ActivityLogObserver::class);
        ProductHistoryEvent::observe(ActivityLogObserver::class);
        AccountEnforcementEvent::observe(ActivityLogObserver::class);
        StaffApplicationEvent::observe(ActivityLogObserver::class);
    }
}
