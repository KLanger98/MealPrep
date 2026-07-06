<?php

namespace App\Support;

class QuantityParser
{
    /**
     * Coerce a frontmatter quantity value to a float.
     *
     * Accepts ints, floats, numeric strings, simple fractions ("1/2") and
     * mixed numbers ("1 1/2"). Returns null for anything else — a null
     * quantity means the ingredient can't be scaled or summed.
     */
    public static function parse(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_int($value) || is_float($value)) {
            return (float) $value;
        }

        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);

        if (is_numeric($value)) {
            return (float) $value;
        }

        // Mixed number: "1 1/2"
        if (preg_match('/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/', $value, $m)) {
            return $m[3] === '0' ? null : (int) $m[1] + (int) $m[2] / (int) $m[3];
        }

        // Simple fraction: "1/2"
        if (preg_match('/^(\d+)\s*\/\s*(\d+)$/', $value, $m)) {
            return $m[2] === '0' ? null : (int) $m[1] / (int) $m[2];
        }

        return null;
    }
}
