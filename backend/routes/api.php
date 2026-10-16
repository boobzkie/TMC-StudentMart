<?php

use App\Http\Controllers\AdminCategoryController;
use App\Http\Controllers\AdminCommissionController;
use App\Http\Controllers\AdminComplaintController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AdminProductController;
use App\Http\Controllers\AdminSellerController;
use App\Http\Controllers\AdminStaffController;
use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ComplaintController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\OrderOptionsController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\StaffDashboardController;
use App\Http\Controllers\StaffComplaintController;
use App\Http\Controllers\StaffInsightsController;
use App\Http\Controllers\StaffPresenceController;
use App\Http\Controllers\StaffRegistrationController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/

Route::get('/test', function () {
    return response()->json([
        'success' => true,
        'message' => 'TMC StudentMart API is working.',
    ]);
});

Route::post('/register', [AuthController::class, 'register'])
    ->middleware('throttle:10,1');

Route::post('/login', [AuthController::class, 'login'])
    ->middleware('throttle:10,1');

Route::post('/forgot-password', [
    PasswordResetController::class,
    'sendResetLink',
])->middleware('throttle:3,1');

Route::post('/reset-password', [
    PasswordResetController::class,
    'reset',
])->middleware('throttle:5,1');

Route::post('/staff/register', [
    StaffRegistrationController::class,
    'store',
])->middleware('throttle:5,1');

Route::post('/staff/application-status', [
    StaffRegistrationController::class,
    'status',
])->middleware('throttle:10,1');

/*
|--------------------------------------------------------------------------
| Authenticated Routes
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {

    /*
    |--------------------------------------------------------------------------
    | Shared Account Routes
    |--------------------------------------------------------------------------
    */

    Route::get('/user', [AuthController::class, 'user']);

    // Existing Admin/Staff account settings. Preserve these endpoints.
    Route::post('/user/profile', [
        AuthController::class,
        'updatePortalProfile',
    ])->middleware('throttle:10,1');

    Route::put('/user/password', [
        AuthController::class,
        'updatePortalPassword',
    ])->middleware('throttle:6,1');

    Route::post('/logout', [AuthController::class, 'logout']);

    /*
    |--------------------------------------------------------------------------
    | Student Routes
    |--------------------------------------------------------------------------
    |
    | The student middleware verifies authentication, active account status,
    | and the student role before allowing access.
    |
    */

    Route::middleware('student')->group(function () {

        /*
        |--------------------------------------------------------------------------
        | Student Profile and Password
        |--------------------------------------------------------------------------
        */

        Route::put('/user/student-profile', [
            AuthController::class,
            'updateStudentProfile',
        ])->middleware('throttle:10,1');

        Route::put('/user/student-password', [
            AuthController::class,
            'updateStudentPassword',
        ])->middleware('throttle:6,1');

        /*
        |--------------------------------------------------------------------------
        | Marketplace
        |--------------------------------------------------------------------------
        */

        Route::get('/order-options', [
            OrderOptionsController::class,
            'available',
        ]);

        Route::get('/categories', [
            CategoryController::class,
            'index',
        ]);

        Route::get('/products', [
            ProductController::class,
            'index',
        ]);

        Route::get('/products/{product}', [
            ProductController::class,
            'show',
        ]);

        Route::post('/products', [
            ProductController::class,
            'store',
        ]);

        Route::put('/products/{product}', [
            ProductController::class,
            'update',
        ]);

        Route::delete('/products/{product}', [
            ProductController::class,
            'destroy',
        ]);

        Route::get('/my-products', [
            ProductController::class,
            'myProducts',
        ]);

        Route::get('/my-products/{product}/history', [
            ProductController::class,
            'history',
        ]);

        Route::put('/my-products/{product}/stock', [
            ProductController::class,
            'updateStock',
        ]);

        /*
        |--------------------------------------------------------------------------
        | Complaints
        |--------------------------------------------------------------------------
        */

        Route::get('/complaints', [
            ComplaintController::class,
            'index',
        ]);

        Route::post('/complaints', [
            ComplaintController::class,
            'store',
        ]);

        Route::get('/complaints/{complaint}', [
            ComplaintController::class,
            'show',
        ]);

        /*
        |--------------------------------------------------------------------------
        | Orders
        |--------------------------------------------------------------------------
        */

        Route::get('/orders', [
            OrderController::class,
            'buyerIndex',
        ]);

        Route::post('/orders', [
            OrderController::class,
            'store',
        ])->middleware('throttle:10,1');

        Route::put('/orders/{order}/cancel', [
            OrderController::class,
            'cancelByBuyer',
        ]);

        Route::get('/seller/orders', [
            OrderController::class,
            'sellerIndex',
        ]);

        Route::put('/seller/orders/{order}', [
            OrderController::class,
            'updateBySeller',
        ]);

        /*
        |--------------------------------------------------------------------------
        | Notifications
        |--------------------------------------------------------------------------
        */

        Route::get('/notifications', [
            NotificationController::class,
            'index',
        ]);

        Route::put('/notifications/{notificationId}/read', [
            NotificationController::class,
            'markRead',
        ]);
    });

    /*
    |--------------------------------------------------------------------------
    | Staff Routes
    |--------------------------------------------------------------------------
    */

    Route::post('/staff/presence', [
        StaffPresenceController::class,
        'heartbeat',
    ])->middleware([
        'staff',
        'throttle:30,1',
    ]);

    Route::middleware('staff:manage_students')
        ->prefix('staff')
        ->group(function () {
            Route::get('/stats', [
                StaffDashboardController::class,
                'stats',
            ]);
        });

    Route::middleware('staff:moderate_products')
        ->prefix('staff/products')
        ->group(function () {
            Route::get('/', [
                AdminProductController::class,
                'index',
            ]);

            Route::get('/{product}', [
                AdminProductController::class,
                'show',
            ]);

            Route::put('/{product}/approve', [
                AdminProductController::class,
                'approve',
            ]);

            Route::put('/{product}/reject', [
                AdminProductController::class,
                'reject',
            ]);

            Route::post('/{product}/warn', [
                AdminProductController::class,
                'warn',
            ]);
        });

    Route::middleware('staff:manage_complaints')
        ->prefix('staff/complaints')
        ->group(function () {
            Route::get('/stats', [
                StaffComplaintController::class,
                'stats',
            ]);

            Route::get('/', [
                StaffComplaintController::class,
                'index',
            ]);

            Route::get('/{complaint}', [
                StaffComplaintController::class,
                'show',
            ]);

            Route::put('/{complaint}', [
                StaffComplaintController::class,
                'update',
            ]);
        });

    Route::middleware('staff:view_reports')->get(
        '/staff/reports',
        [StaffInsightsController::class, 'reports']
    );

    Route::middleware('staff:view_analytics')->get(
        '/staff/analytics',
        [StaffInsightsController::class, 'analytics']
    );

    /*
    |--------------------------------------------------------------------------
    | Admin and Authorized Staff: Student Management
    |--------------------------------------------------------------------------
    */

    Route::middleware('admin.or.staff:manage_students')
        ->prefix('admin')
        ->group(function () {
            Route::get('/users', [
                AdminUserController::class,
                'index',
            ]);

            Route::get('/users/{user}', [
                AdminUserController::class,
                'show',
            ]);

            Route::put('/users/{user}/activate', [
                AdminUserController::class,
                'activate',
            ]);

            Route::put('/users/{user}/deactivate', [
                AdminUserController::class,
                'deactivate',
            ]);
        });

    /*
    |--------------------------------------------------------------------------
    | Admin-Only Routes
    |--------------------------------------------------------------------------
    */

    Route::middleware('admin')
        ->prefix('admin')
        ->group(function () {

            /*
            |--------------------------------------------------------------------------
            | Dashboard and Orders
            |--------------------------------------------------------------------------
            */

            Route::get('/stats', [
                AdminController::class,
                'stats',
            ]);

            Route::get('/orders', [
                OrderController::class,
                'adminIndex',
            ]);

            Route::put('/orders/{order}/mark-paid', [
                OrderController::class,
                'markPaid',
            ]);

            /*
            |--------------------------------------------------------------------------
            | Commission
            |--------------------------------------------------------------------------
            */

            Route::get('/commission', [
                AdminCommissionController::class,
                'index',
            ]);

            Route::post('/commission/rates', [
                AdminCommissionController::class,
                'storeRate',
            ]);

            Route::put(
                '/order-commissions/{orderCommission}/collect',
                [AdminCommissionController::class, 'collect']
            );

            /*
            |--------------------------------------------------------------------------
            | Order Options and Payment Methods
            |--------------------------------------------------------------------------
            */

            Route::get('/order-options', [
                OrderOptionsController::class,
                'adminIndex',
            ]);

            Route::post('/payment-methods', [
                OrderOptionsController::class,
                'storePaymentMethod',
            ]);

            Route::put('/payment-methods/{paymentMethod}', [
                OrderOptionsController::class,
                'updatePaymentMethod',
            ]);

            Route::delete('/payment-methods/{paymentMethod}', [
                OrderOptionsController::class,
                'destroyPaymentMethod',
            ]);

            Route::post('/pickup-locations', [
                OrderOptionsController::class,
                'storePickupLocation',
            ]);

            Route::put('/pickup-locations/{pickupLocation}', [
                OrderOptionsController::class,
                'updatePickupLocation',
            ]);

            Route::delete('/pickup-locations/{pickupLocation}', [
                OrderOptionsController::class,
                'destroyPickupLocation',
            ]);

            /*
            |--------------------------------------------------------------------------
            | Student Account Management
            |--------------------------------------------------------------------------
            */

            Route::put('/users/{user}', [
                AdminUserController::class,
                'update',
            ]);

            Route::delete('/users/{user}', [
                AdminUserController::class,
                'destroy',
            ]);

            /*
            |--------------------------------------------------------------------------
            | Staff Management
            |--------------------------------------------------------------------------
            */

            Route::get('/staff', [
                AdminStaffController::class,
                'index',
            ]);

            Route::post('/staff', [
                AdminStaffController::class,
                'store',
            ]);

            Route::get('/staff/{user}/document', [
                AdminStaffController::class,
                'document',
            ]);

            Route::get('/staff/{user}', [
                AdminStaffController::class,
                'show',
            ]);

            Route::put('/staff/{user}', [
                AdminStaffController::class,
                'update',
            ]);

            Route::put('/staff/{user}/approve', [
                AdminStaffController::class,
                'approve',
            ]);

            Route::put('/staff/{user}/reject', [
                AdminStaffController::class,
                'reject',
            ]);

            Route::put('/staff/{user}/reopen', [
                AdminStaffController::class,
                'reopen',
            ]);

            Route::put('/staff/{user}/suspend', [
                AdminStaffController::class,
                'suspend',
            ]);

            Route::put('/staff/{user}/activate', [
                AdminStaffController::class,
                'activate',
            ]);

            Route::put('/staff/{user}/deactivate', [
                AdminStaffController::class,
                'deactivate',
            ]);

            Route::put('/staff/{user}/archive', [
                AdminStaffController::class,
                'archive',
            ]);

            Route::delete('/staff/{user}', [
                AdminStaffController::class,
                'destroy',
            ]);

            /*
            |--------------------------------------------------------------------------
            | Product Management
            |--------------------------------------------------------------------------
            */

            Route::get('/products', [
                AdminProductController::class,
                'index',
            ]);

            Route::get('/products/{product}', [
                AdminProductController::class,
                'show',
            ]);

            Route::put('/products/{product}/approve', [
                AdminProductController::class,
                'approve',
            ]);

            Route::put('/products/{product}/reject', [
                AdminProductController::class,
                'reject',
            ]);

            Route::post('/products/{product}/warn', [
                AdminProductController::class,
                'warn',
            ]);

            Route::put('/products/{product}/suspend', [
                AdminProductController::class,
                'suspend',
            ]);

            Route::delete('/products/{product}', [
                AdminProductController::class,
                'destroy',
            ]);

            Route::put('/products/{product}/restore', [
                AdminProductController::class,
                'restore',
            ]);

            /*
            |--------------------------------------------------------------------------
            | Category Management
            |--------------------------------------------------------------------------
            */

            Route::get('/categories', [
                AdminCategoryController::class,
                'index',
            ]);

            Route::post('/categories', [
                AdminCategoryController::class,
                'store',
            ]);

            Route::get('/categories/{category}', [
                AdminCategoryController::class,
                'show',
            ]);

            Route::put('/categories/{category}', [
                AdminCategoryController::class,
                'update',
            ]);

            Route::put('/categories/{category}/toggle-status', [
                AdminCategoryController::class,
                'toggleStatus',
            ]);

            Route::delete('/categories/{category}', [
                AdminCategoryController::class,
                'destroy',
            ]);

            /*
            |--------------------------------------------------------------------------
            | Seller Management
            |--------------------------------------------------------------------------
            */

            Route::get('/sellers', [
                AdminSellerController::class,
                'index',
            ]);

            Route::get('/sellers/{user}', [
                AdminSellerController::class,
                'show',
            ]);

            /*
            |--------------------------------------------------------------------------
            | Complaint Management
            |--------------------------------------------------------------------------
            */

            Route::get('/complaints', [
                AdminComplaintController::class,
                'index',
            ]);

            Route::get('/complaints/stats', [
                AdminComplaintController::class,
                'stats',
            ]);

            Route::get('/complaints/{complaint}', [
                AdminComplaintController::class,
                'show',
            ]);

            Route::put('/complaints/{complaint}', [
                AdminComplaintController::class,
                'update',
            ]);

            Route::delete('/complaints/{complaint}', [
                AdminComplaintController::class,
                'destroy',
            ]);
        });
});