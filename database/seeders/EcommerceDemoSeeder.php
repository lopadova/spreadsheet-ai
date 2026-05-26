<?php

namespace Database\Seeders;

use App\Models\Article;
use App\Models\Customer;
use App\Models\EmailCampaign;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ReturnRow;
use App\Support\TabularReview\PresetData;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Loads the exact demo entity rows from the 5 presets (PresetData), so Mock
 * mode is pixel-faithful. Gated to local/testing environments only.
 *
 * Codes (RET-/ORD-/ART-/C-) are preserved EXACTLY as in the prototype data.
 */
class EcommerceDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            return;
        }

        $presets = PresetData::presets();

        $this->seedArticles($presets['articles']['rows']);
        $this->seedFraudOrders($presets['fraud']['rows']);
        $this->seedReturns($presets['returns']['rows']);
        $this->seedEmailCampaigns($presets['email']['rows']);
    }

    /**
     * Parse a prototype euro string (e.g. "€2.149,00", "189,00 EUR", "24.8")
     * into integer cents. Dots are thousands separators, comma is decimal.
     */
    private function toCents(string $amount): int
    {
        // Strip currency symbols / codes / spaces, keep digits, dot, comma.
        $clean = preg_replace('/[^0-9.,]/', '', $amount) ?? '';

        if ($clean === '') {
            return 0;
        }

        // If it contains a comma, treat it as the decimal separator (IT format)
        // and dots as thousands separators.
        if (str_contains($clean, ',')) {
            $clean = str_replace('.', '', $clean);
            $clean = str_replace(',', '.', $clean);
        }

        return (int) round(((float) $clean) * 100);
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function seedArticles(array $rows): void
    {
        foreach ($rows as $i => $row) {
            $price = $this->toCents((string) $row['price']);

            Article::query()->updateOrCreate(
                ['sku' => $row['sku']],
                [
                    'name' => $row['name'],
                    'brand' => $row['brand'] ?? null,
                    'price_cents' => $price,
                    'cost_cents' => (int) round($price * 0.4),
                    'description_it' => null,
                    'description_en' => null,
                    'has_alt_text' => $i % 5 !== 1, // a couple miss alt text
                    'season' => 'SS26',
                ]
            );
        }
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function seedFraudOrders(array $rows): void
    {
        foreach ($rows as $i => $row) {
            $customer = Customer::query()->updateOrCreate(
                ['email' => 'order-cust-'.Str::slug((string) $row['id']).'@demo.test'],
                [
                    'name' => (string) $row['customer'],
                    'total_orders' => 1 + $i,
                    'returns_12mo' => 0,
                    'loyalty_tier' => $i === 0 ? 'VIP-Gold' : null,
                    'ltv_cents' => $this->toCents((string) $row['amount']),
                ]
            );

            Order::query()->updateOrCreate(
                ['code' => $row['id']],
                [
                    'customer_id' => $customer->id,
                    'placed_at' => Carbon::parse('2026-05-15'),
                    'amount_cents' => $this->toCents((string) $row['amount']),
                    'ship_country' => $row['country'] ?? null,
                    'ip' => '1.2.3.'.($i + 1),
                    'device_fingerprint' => 'fp-'.($i + 1),
                    'payment_method' => $i % 2 === 0 ? 'card' : 'paypal',
                    'status' => 'pending',
                ]
            );
        }
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function seedReturns(array $rows): void
    {
        foreach ($rows as $i => $row) {
            $amountCents = $this->toCents((string) $row['amount']);

            $customer = Customer::query()->updateOrCreate(
                ['email' => 'return-cust-'.Str::slug((string) $row['id']).'@demo.test'],
                [
                    'name' => (string) $row['customer'],
                    'total_orders' => 3 + $i,
                    'returns_12mo' => $i === 7 ? 11 : ($i === 2 ? 5 : 1),
                    'loyalty_tier' => null,
                    'ltv_cents' => $amountCents * 3,
                ]
            );

            $order = Order::query()->updateOrCreate(
                ['code' => 'ORD-R'.(1042 + $i)],
                [
                    'customer_id' => $customer->id,
                    'placed_at' => Carbon::parse('2026-05-'.str_pad((string) (10 + ($i % 5)), 2, '0', STR_PAD_LEFT)),
                    'amount_cents' => $amountCents,
                    'ship_country' => 'IT',
                    'ip' => '10.0.0.'.($i + 1),
                    'device_fingerprint' => 'rfp-'.($i + 1),
                    'payment_method' => 'card',
                    'status' => 'done',
                ]
            );

            OrderItem::query()->updateOrCreate(
                ['order_id' => $order->id, 'article_id' => null],
                [
                    'qty' => 1,
                    'unit_price_cents' => $amountCents,
                    'unit_cost_cents' => (int) round($amountCents * 0.55),
                ]
            );

            ReturnRow::query()->updateOrCreate(
                ['code' => $row['id']],
                [
                    'order_id' => $order->id,
                    'customer_id' => $customer->id,
                    'returned_at' => Carbon::parse('2026-05-'.str_pad((string) (10 + ($i % 5)), 2, '0', STR_PAD_LEFT)),
                    'amount_cents' => $amountCents,
                    'declared_reason' => $row['reason'] ?? null,
                    'status' => 'pending',
                ]
            );
        }
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function seedEmailCampaigns(array $rows): void
    {
        foreach ($rows as $row) {
            EmailCampaign::query()->updateOrCreate(
                ['code' => $row['id']],
                [
                    'name' => $row['name'],
                    'sent_at' => Carbon::parse('2026-'.$this->parseDayMonth((string) $row['sent'])),
                    'open_rate' => (float) str_replace(',', '.', (string) $row['opens']),
                    'ctr_vs_baseline' => null,
                    'segment' => null,
                    'subject' => $row['name'],
                ]
            );
        }
    }

    /**
     * Convert a prototype "02 May" date fragment into "05-02".
     */
    private function parseDayMonth(string $sent): string
    {
        $parts = explode(' ', trim($sent));
        $day = str_pad($parts[0] ?? '01', 2, '0', STR_PAD_LEFT);
        $months = [
            'Jan' => '01', 'Feb' => '02', 'Mar' => '03', 'Apr' => '04',
            'May' => '05', 'Jun' => '06', 'Jul' => '07', 'Aug' => '08',
            'Sep' => '09', 'Oct' => '10', 'Nov' => '11', 'Dec' => '12',
        ];
        $month = $months[$parts[1] ?? 'May'] ?? '05';

        return $month.'-'.$day;
    }
}
