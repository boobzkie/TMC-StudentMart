<?php

use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpKernel\Exception\HttpException;

test('api server failures return a safe json response without exposing exception details', function () {
    Log::spy();

    Route::middleware('api')->get('/api/test-only/server-error', function () {
        throw new RuntimeException('SQLSTATE[HY000]: secret database detail');
    });
    Route::middleware('api')->get('/api/test-only/server-response-error', function () {
        throw new HttpResponseException(response()->json([
            'message' => 'SQLSTATE[HY000]: secret response detail',
        ], 500));
    });

    $this->get('/api/test-only/server-error')
        ->assertStatus(500)
        ->assertHeader('content-type', 'application/json')
        ->assertExactJson([
            'message' => 'The server could not complete this request. Please try again later.',
        ])
        ->assertDontSee('SQLSTATE')
        ->assertDontSee('secret database detail');

    $this->get('/api/test-only/server-response-error')
        ->assertStatus(500)
        ->assertExactJson([
            'message' => 'The server could not complete this request. Please try again later.',
        ])
        ->assertDontSee('secret response detail');

    Log::shouldHaveReceived('warning')->twice();
});

test('api failures preserve safe client errors and validation responses', function () {
    Route::middleware('api')->get('/api/test-only/unavailable', function () {
        throw new HttpException(503, 'private upstream detail');
    });
    Route::middleware('api')->post('/api/test-only/validation', function (Request $request) {
        $request->validate(['name' => ['required', 'string']]);

        return response()->json(['success' => true]);
    });

    $this->get('/api/test-only/unavailable')
        ->assertStatus(503)
        ->assertExactJson([
            'message' => 'The server could not complete this request. Please try again later.',
        ])
        ->assertDontSee('private upstream detail');

    $this->post('/api/test-only/validation', [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('name');
});
