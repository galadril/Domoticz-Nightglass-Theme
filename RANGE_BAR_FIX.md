# Range Bar Fix: Zero-Centered Drawing

## Problem
Previously, range bars always drew from left to right (0% to 100%), regardless of whether the value ranges included negative values. This caused an incorrect visual representation when ranges spanned negative to positive values.

## Example
For a range configuration like:
- `-100 to 0` ? green
- `0 to 100` ? red

**Before the fix:**
- Value at `0`: Bar would draw green from left edge to center (incorrect)
- Value at `-50`: Bar would draw green from left edge to 25% position (incorrect)
- Value at `50`: Bar would draw green fully, then red from center to 75% (incorrect)

**After the fix:**
- Value at `0`: Bar starts at center, all colors faded (correct - starting point)
- Value at `-50`: Bar draws green from center (50%) leftward to 25% position (correct)
- Value at `50`: Bar draws red from center (50%) rightward to 75% position (correct)

## Implementation
The fix detects when `globalMin < 0 && globalMax > 0` and:
1. Calculates the zero point percentage (`zeroPct`) in the gradient
2. For negative ranges: Draws active color from the value position toward zero
3. For positive ranges: Draws active color from zero toward the value position
4. For ranges that cross zero: Splits the range at zero, activating the appropriate side

## Files Modified
- `src/js/card-features.js`: Updated `resolveBarRangeGradient()` function to handle zero-centered drawing
