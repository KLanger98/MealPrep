<?php

namespace App\Support;

class UnitNormalizer
{
    /**
     * Alias map from common spellings to a canonical unit token.
     */
    private const ALIASES = [
        'g' => 'g', 'gram' => 'g', 'grams' => 'g', 'gr' => 'g',
        'kg' => 'kg', 'kilogram' => 'kg', 'kilograms' => 'kg', 'kilo' => 'kg', 'kilos' => 'kg',
        'ml' => 'ml', 'milliliter' => 'ml', 'milliliters' => 'ml', 'millilitre' => 'ml', 'millilitres' => 'ml',
        'l' => 'l', 'liter' => 'l', 'liters' => 'l', 'litre' => 'l', 'litres' => 'l',
        'tsp' => 'tsp', 'teaspoon' => 'tsp', 'teaspoons' => 'tsp',
        'tbsp' => 'tbsp', 'tablespoon' => 'tbsp', 'tablespoons' => 'tbsp', 'tbs' => 'tbsp',
        'cup' => 'cup', 'cups' => 'cup',
        'oz' => 'oz', 'ounce' => 'oz', 'ounces' => 'oz',
        'lb' => 'lb', 'lbs' => 'lb', 'pound' => 'lb', 'pounds' => 'lb',
        'whole' => 'whole', 'each' => 'whole', 'x' => 'whole', 'piece' => 'whole', 'pieces' => 'whole',
        'bunch' => 'bunch', 'bunches' => 'bunch',
        'clove' => 'clove', 'cloves' => 'clove',
        'can' => 'can', 'cans' => 'can', 'tin' => 'can', 'tins' => 'can',
        'slice' => 'slice', 'slices' => 'slice',
        'head' => 'head', 'heads' => 'head',
        'stalk' => 'stalk', 'stalks' => 'stalk',
        'sprig' => 'sprig', 'sprigs' => 'sprig',
        'pinch' => 'pinch', 'pinches' => 'pinch',
        'packet' => 'packet', 'packets' => 'packet', 'pack' => 'packet', 'packs' => 'packet',
    ];

    /**
     * Units convertible to a smaller base unit for merging: unit => [base, factor].
     */
    private const CONVERSIONS = [
        'kg' => ['g', 1000],
        'l' => ['ml', 1000],
    ];

    /**
     * Normalize a raw unit string to its canonical token.
     * Unknown units pass through lowercased/trimmed rather than being rejected.
     */
    public static function normalize(?string $unit): ?string
    {
        if ($unit === null) {
            return null;
        }

        $key = mb_strtolower(trim($unit));

        if ($key === '') {
            return null;
        }

        return self::ALIASES[$key] ?? $key;
    }

    /**
     * Convert a quantity to its canonical base unit so g/kg and ml/l merge.
     * Returns [quantity, unit].
     */
    public static function canonicalize(float $quantity, ?string $unit): array
    {
        $unit = self::normalize($unit);

        if ($unit !== null && isset(self::CONVERSIONS[$unit])) {
            [$base, $factor] = self::CONVERSIONS[$unit];

            return [$quantity * $factor, $base];
        }

        return [$quantity, $unit];
    }

    /**
     * Present a canonical quantity in a friendly unit (1500 g -> 1.5 kg).
     * Returns [quantity, unit].
     */
    public static function humanize(float $quantity, ?string $unit): array
    {
        foreach (self::CONVERSIONS as $big => [$base, $factor]) {
            if ($unit === $base && $quantity >= $factor) {
                return [$quantity / $factor, $big];
            }
        }

        return [$quantity, $unit];
    }
}
