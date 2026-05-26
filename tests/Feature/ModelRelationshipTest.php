<?php

namespace Tests\Feature;

use App\Models\Article;
use App\Models\Customer;
use App\Models\EmailCampaign;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ReturnRow;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ModelRelationshipTest extends TestCase
{
    use RefreshDatabase;

    public function test_each_ecommerce_factory_persists_a_row(): void
    {
        $this->assertModelExists(Customer::factory()->create());
        $this->assertModelExists(Article::factory()->create());
        $this->assertModelExists(Order::factory()->create());
        $this->assertModelExists(OrderItem::factory()->create());
        $this->assertModelExists(ReturnRow::factory()->create());
        $this->assertModelExists(EmailCampaign::factory()->create());
    }

    public function test_order_belongs_to_customer_and_has_items(): void
    {
        $customer = Customer::factory()->create();
        $order = Order::factory()->for($customer)->create();
        $item = OrderItem::factory()->for($order)->create();

        $this->assertTrue($order->customer->is($customer));
        $this->assertTrue($order->items->contains($item));
        $this->assertTrue($customer->orders->contains($order));
    }

    public function test_return_row_belongs_to_order_and_customer(): void
    {
        $customer = Customer::factory()->create();
        $order = Order::factory()->for($customer)->create();
        $return = ReturnRow::factory()->for($order)->for($customer)->create();

        $this->assertTrue($return->order->is($order));
        $this->assertTrue($return->customer->is($customer));
        $this->assertSame('returns_rows', $return->getTable());
    }

    public function test_order_item_belongs_to_article(): void
    {
        $article = Article::factory()->create();
        $item = OrderItem::factory()->for($article)->create();

        $this->assertTrue($item->article->is($article));
    }
}
