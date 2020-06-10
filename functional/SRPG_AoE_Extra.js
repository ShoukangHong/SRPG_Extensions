/*:
 * @plugindesc Additional SRPG AoE shapes
 * @author [your name here]
 *
 * @help
 *
 * Place under SRPG_AoE.js
 * 
 * [Describe your new AoEs here]
 *
 * [Remember to change the plugin name!]
 */

(function(){

	// space to add new AoE shapes
	var _extraAreas = Game_Map.prototype.extraAreas;
	Game_Map.prototype.extraAreas = function(dx, dy, size, minSize, shape, fx, fy) {
		// dx and dy are the position. 0, 0 is the AoE's origin.

		// size is the maximum range. size 0 only covers the origin.
		// minSize is the minimum range. minSize 1 or greater will exclude the origin.
			// The area display will only draw a square twice the size + 1.
			// If your AoE extends outside that square, some of it will be hidden.

		// fx and fy are the direction. 0, 1 is down, -1, 0 is left, etc.
			// fx * dx and fy * dy tell you distance in the "forward" direction.
			// fx * dy and fy * dx tell you distance perpendicular to the "forward" direction.

		switch (shape) {
			case '[your shape]': // add your own shapes here!
				return true;

			case 'circle': // EXAMPLE: a shape using circular distance
				if (Math.abs(dx) + Math.abs(dy) > size || Math.abs(dx) + Math.abs(dy) < minSize) return false;
				return true;

			case 'square': // EXAMPLE: a shape using square distance
				if (Math.abs(dx) > size || Math.abs(dy) > size) return false;
				if (Math.abs(dx) < minSize || Math.abs(dy) < minSize) return false
				return true;

			case 'line': // EXAMPLE: a shape that checks direction forward
				if (dx * fy != 0 || dy * fx != 0) return false;
				if (dx * fx < minSize || dy * fy < minSize || dx * fx > size || dy * fy > size) return false;
				return true;

			case 'side': // EXAMPLE: a shape that checks direction to the sides
				if (dx * fx != 0 || dy * fy != 0) return false;
				if (Math.abs(dx * fy) > size || Math.abs(dy * fx) > size) return false;
				if (Math.abs(dx * fy) < minSize || Math.abs(dy * fx) < minSize) return false;
				return true;

			default: // LEAVE THIS HERE! It allows you to have multiple sets of extra AoEs
				return _extraAreas.call(this, dx, dy, size, minSize, shape, fx, fy);
		}
	};

})();