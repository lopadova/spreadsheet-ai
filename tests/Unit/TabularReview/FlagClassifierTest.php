<?php

declare(strict_types=1);

namespace Tests\Unit\TabularReview;

use App\Services\TabularReview\FlagClassifier;
use App\Support\TabularReview\CellFlag;
use PHPUnit\Framework\TestCase;

class FlagClassifierTest extends TestCase
{
    public function test_maps_each_flag_to_its_pseudo_confidence(): void
    {
        $c = new FlagClassifier();

        $this->assertSame(0.92, $c->confidenceFor(CellFlag::GREEN));
        $this->assertSame(0.65, $c->confidenceFor(CellFlag::YELLOW));
        $this->assertSame(0.40, $c->confidenceFor(CellFlag::GREY));
        $this->assertSame(0.20, $c->confidenceFor(CellFlag::RED));
    }

    public function test_confidence_is_descending_by_certainty(): void
    {
        $c = new FlagClassifier();

        $this->assertGreaterThan($c->confidenceFor(CellFlag::YELLOW), $c->confidenceFor(CellFlag::GREEN));
        $this->assertGreaterThan($c->confidenceFor(CellFlag::GREY), $c->confidenceFor(CellFlag::YELLOW));
        $this->assertGreaterThan($c->confidenceFor(CellFlag::RED), $c->confidenceFor(CellFlag::GREY));
    }
}
