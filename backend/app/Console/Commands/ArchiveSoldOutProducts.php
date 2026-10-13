<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ArchiveSoldOutProducts extends Command
{
    protected $signature = 'products:archive-sold-out';

    protected $description = 'Archive listings that have been sold out for at least one hour.';

    public function handle(): int
    {
        $cutoff = now()->subHour();
        $archived = 0;

        Product::query()
            ->where('status', 'sold_out')
            ->whereNotNull('sold_out_at')
            ->where('sold_out_at', '<=', $cutoff)
            ->orderBy('id')
            ->chunkById(100, function ($products) use (&$archived): void {
                foreach ($products as $candidate) {
                    $didArchive = DB::transaction(function () use ($candidate): bool {
                        $product = Product::query()
                            ->whereKey($candidate->id)
                            ->lockForUpdate()
                            ->first();

                        if (! $product || $product->status !== 'sold_out'
                            || ! $product->sold_out_at
                            || $product->sold_out_at->gt(now()->subHour())) {
                            return false;
                        }

                        $product->status = 'archived';
                        $product->archived_at = now();
                        $product->save();
                        $product->historyEvents()->create([
                            'event' => 'auto_archived',
                            'stock_before' => $product->stock_quantity,
                            'stock_after' => $product->stock_quantity,
                            'note' => 'Automatically archived one hour after selling out.',
                        ]);

                        return true;
                    });

                    if ($didArchive) {
                        $archived++;
                    }
                }
            });

        $this->info("Archived {$archived} sold-out listing(s).");

        return self::SUCCESS;
    }
}
