<?php

declare(strict_types=1);

use App\Http\Controllers\Api\TabularReview\ColumnController;
use App\Http\Controllers\Api\TabularReview\ReviewController;
use App\Http\Controllers\Api\TabularReview\StreamController;
use Illuminate\Support\Facades\Route;

// Tabular Review demo API. Tenant is fixed to 'demo' (no auth — demo only).

Route::get('/reviews/{preset}', [ReviewController::class, 'show']);
Route::get('/suggest/{preset}', [ReviewController::class, 'suggest']);

Route::post('/reviews/{id}/columns', [ColumnController::class, 'store'])->whereNumber('id');
Route::patch('/reviews/{id}/columns/{index}', [ColumnController::class, 'update'])->whereNumber(['id', 'index']);
Route::delete('/reviews/{id}/columns/{index}', [ColumnController::class, 'destroy'])->whereNumber(['id', 'index']);

Route::get('/reviews/{id}/stream', [StreamController::class, 'stream'])->whereNumber('id');
