<?php

namespace Tests\Unit;

use App\Support\UnitNormalizer;
use PHPUnit\Framework\TestCase;

class UnitNormalizerTest extends TestCase
{
    public function test_normalizes_aliases(): void
    {
        $this->assertSame('g', UnitNormalizer::normalize('grams'));
        $this->assertSame('g', UnitNormalizer::normalize(' G '));
        $this->assertSame('tbsp', UnitNormalizer::normalize('tablespoons'));
        $this->assertSame('whole', UnitNormalizer::normalize('each'));
        $this->assertSame('can', UnitNormalizer::normalize('tins'));
    }

    public function test_unknown_units_pass_through(): void
    {
        $this->assertSame('rasher', UnitNormalizer::normalize('Rasher'));
        $this->assertNull(UnitNormalizer::normalize(null));
        $this->assertNull(UnitNormalizer::normalize('  '));
    }

    public function test_canonicalizes_metric_pairs(): void
    {
        $this->assertSame([1500.0, 'g'], UnitNormalizer::canonicalize(1.5, 'kg'));
        $this->assertSame([2000.0, 'ml'], UnitNormalizer::canonicalize(2, 'litres'));
        $this->assertSame([500.0, 'g'], UnitNormalizer::canonicalize(500, 'g'));
        $this->assertSame([3.0, 'tbsp'], UnitNormalizer::canonicalize(3, 'tbsp'));
    }

    public function test_humanizes_large_canonical_quantities(): void
    {
        $this->assertSame([1.8, 'kg'], UnitNormalizer::humanize(1800, 'g'));
        $this->assertSame([900.0, 'g'], UnitNormalizer::humanize(900, 'g'));
        $this->assertSame([1.25, 'l'], UnitNormalizer::humanize(1250, 'ml'));
    }
}
