<?php

namespace Tests\Unit;

use App\Support\QuantityParser;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class QuantityParserTest extends TestCase
{
    public static function quantities(): array
    {
        return [
            'integer' => [800, 800.0],
            'float' => [1.5, 1.5],
            'numeric string' => ['2.5', 2.5],
            'simple fraction' => ['1/2', 0.5],
            'mixed number' => ['1 1/2', 1.5],
            'fraction with spaces' => ['3 / 4', 0.75],
            'null' => [null, null],
            'empty string' => ['', null],
            'prose' => ['to taste', null],
            'zero denominator' => ['1/0', null],
        ];
    }

    #[DataProvider('quantities')]
    public function test_parses_quantity_values(mixed $input, ?float $expected): void
    {
        $this->assertSame($expected, QuantityParser::parse($input));
    }
}
