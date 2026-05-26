<?php

namespace Tests\Feature;

use App\Models\Article;
use App\Models\Customer;
use App\Models\EmailCampaign;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ReturnRow;
use App\Models\Workflow;
use Database\Seeders\BuiltinWorkflowSeeder;
use Database\Seeders\EcommerceDemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_ecommerce_seeder_loads_exact_preset_row_counts(): void
    {
        $this->seed(EcommerceDemoSeeder::class);

        // articles preset: 10 articles
        $this->assertSame(10, Article::query()->count());

        // fraud preset: 10 orders; returns preset: 14 supporting orders
        $this->assertSame(24, Order::query()->count());

        // returns preset: 14 returns
        $this->assertSame(14, ReturnRow::query()->count());

        // email preset: 8 campaigns
        $this->assertSame(8, EmailCampaign::query()->count());

        // fraud (10) + returns (14) distinct customers
        $this->assertSame(24, Customer::query()->count());

        // one order item per return
        $this->assertSame(14, OrderItem::query()->count());
    }

    public function test_ecommerce_seeder_preserves_exact_codes(): void
    {
        $this->seed(EcommerceDemoSeeder::class);

        $this->assertDatabaseHas('returns_rows', ['code' => 'RET-1042']);
        $this->assertDatabaseHas('orders', ['code' => 'ORD-94521']);
        $this->assertDatabaseHas('articles', ['sku' => 'ART-7821']);
        $this->assertDatabaseHas('email_campaigns', ['code' => 'C-417']);
    }

    public function test_ecommerce_seeder_is_idempotent(): void
    {
        $this->seed(EcommerceDemoSeeder::class);
        $this->seed(EcommerceDemoSeeder::class);

        $this->assertSame(10, Article::query()->count());
        $this->assertSame(14, ReturnRow::query()->count());
    }

    public function test_builtin_workflow_seeder_creates_five_system_workflows(): void
    {
        $this->seed(BuiltinWorkflowSeeder::class);

        $this->assertSame(5, Workflow::query()->count());
        $this->assertSame(5, Workflow::query()->where('is_system', true)->count());

        $returns = Workflow::query()->where('preset_key', 'returns')->first();
        $this->assertNotNull($returns);
        $this->assertSame('returns_rows', $returns->row_source);
        $this->assertIsArray($returns->columns_config);
        $this->assertCount(8, $returns->columns_config);
    }

    public function test_builtin_workflow_seeder_is_idempotent(): void
    {
        $this->seed(BuiltinWorkflowSeeder::class);
        $this->seed(BuiltinWorkflowSeeder::class);

        $this->assertSame(5, Workflow::query()->count());
    }
}
