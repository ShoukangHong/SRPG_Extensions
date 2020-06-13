/*:
 * @plugindesc Additional SRPG AoE shapes
 * @author [your name here]
 *
 * @help
 *
 * Place beneath SRPG_AoE.js in the plugin order
 * 
 * [Describe your new AoEs here]
 *
 * [Remember to change the plugin name!]
 */

(function(){

	// space to add new AoE shapes
	var _extraAreas = Game_Map.prototype.extraAreas;
	Game_Map.prototype.extraAreas = function(shape, x, y, rx, ry, size, minSize) {
		// x and y are the position. 0, 0 is the AoE's origin.
		// rx and ry are the position relative to the facing direction.
			// ry is the distance in front of the origin.
			// rx is the distance to the left of the origin.
			// ry and rx can be negative, for behind and to the right, respectively.

		// size is the maximum range. size 0 only covers the origin.
		// minSize is the minimum range. minSize 1 or greater will exclude the origin.
			// Cells outside of a square range centered on the origin will be ignored.
			// So, a size of 1 has a 3x3 square maximum, size 2 has a 5x5, and so on.

		switch (shape) {
			case 'circle': // EXAMPLE: a shape using circular distance
				if (Math.abs(x) + Math.abs(y) > size || Math.abs(x) + Math.abs(y) < minSize) return false;
				return true;

			case 'square': // EXAMPLE: a shape using square distance
				if (Math.abs(x) > size || Math.abs(y) > size) return false;
				if (Math.abs(x) < minSize && Math.abs(y) < minSize) return false
				return true;

			case 'line': // EXAMPLE: a shape that checks ry to look forward
				if (rx != 0) return false;
				if (ry > size || ry < minSize) return false;
				return true;

			case 'side': // EXAMPLE: a shape that checks rx to look side to side
				if (ry != 0) return false;
				if (Math.abs(rx) > size || Math.abs(rx) < minSize) return false;
				return true;

			case 'cone': // EXAMPLE: a shape that uses both ry and rx 
				if (ry > size || ry < minSize) return false;
				if (Math.abs(rx) > Math.abs(ry)) return false;
				return true;

			case '[your shape]': // add your own shapes here!
				return true;

			default: // LEAVE THIS HERE! It allows you to use multiple extra AoE plugins at once
				return _extraAreas.call(this, shape, x, y, rx, ry size, minSize);
		}
	};

})();