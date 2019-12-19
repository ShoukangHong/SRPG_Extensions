//-----------------------------------------------------------------------------
// copyright 2019 Doktor_Q all rights reserved.
// Released under the MIT license.
// http://opensource.org/licenses/mit-license.php
//=============================================================================

/*:
 * @plugindesc SRPG line of sight for skills and items
 * @author Dr. Q
 *
 * @param Through Objects
 * @desc If true, objects don't block LoS
 * @type boolean
 * @on YES
 * @off NO
 * @default false
 *
 * @param Through Opponents
 * @desc If true, the users's enemies don't block LoS
 * @type boolean
 * @on YES
 * @off NO
 * @default false
 *
 * @param Through Friends
 * @desc If true, the users's allies don't block LoS
 * @type boolean
 * @on YES
 * @off NO
 * @default true
 *
 * @param Through Events
 * @desc If true, playerEvents don't block LoS
 * @type boolean
 * @on YES
 * @off NO
 * @default false
 *
 * @param Through Terrain
 * @desc Terrain IDs above this number block line of sight
 * @type number
 * @min -1
 * @max 7
 * @default 0
 *
 * @help
 * Adds a line of sight system for SRPG skills
 * Use notetags and settings to override the plugin settings for individual skills or items
 *
 * Skill / item notetags:
 * <srpgLoS>                       # targets must be in line of sight from the user
 * <throughObject:true/false>      # if true, object events do not block line of sight
 * <throughFriend:true/false>      # if true, user's allies do not block line of sight
 * <throughOpponent:true/false>    # if true, the user's enemies do not block line of sight
 * <throughEvent:true/false>       # if true, playerEvents do not block line of sight
 * <throughTerrain:X>              # terrain IDs above X block line of sight
 *                                 -1 checks the user's srpgThroughTag instead
 */

(function(){
	var parameters = PluginManager.parameters('SRPG_LoS');
	var _defaultTag = Number(parameters['Through Terrain']);
	var _throughObject = !!eval(parameters['Through Objects']);
	var _throughOpponent = !!eval(parameters['Through Opponents']);
	var _throughFriend = !!eval(parameters['Through Friends']);
	var _throughEvent = !!eval(parameters['Through Events']);

//====================================================================
// utility functions and checks
//====================================================================

	// make the LoS table at the start of an LoS check
	var _makeRangeTable = Game_CharacterBase.prototype.makeRangeTable;
	Game_CharacterBase.prototype.makeRangeTable = function(x, y, range, route, oriX, oriY, skill) {
		if (route.length === 1 && skill && skill.meta.srpgLoS) {
			$gameMap.makeSrpgLoSTable(this);
		}
		_makeRangeTable.apply(this, arguments);
	}

	// map out the events that might block LoS
	Game_Map.prototype.makeSrpgLoSTable = function(source) {
		var eventTable = {};
		this.events().forEach(function(event) {
			if (event !== source && !event.isErased() && event.isType() && event.isType() != 'unitEvent') {
				eventTable[event.posX()+','+event.posY()] = event.isType();
			}
		});
		this._eventTable = eventTable;
	};

	// check line-of-sight as part of the special range
	var _srpgRangeExtention = Game_CharacterBase.prototype.srpgRangeExtention;
	Game_CharacterBase.prototype.srpgRangeExtention = function(x, y, oriX, oriY, skill) {
		if (!_srpgRangeExtention.apply(this, arguments)) return false;
		if (skill && skill.meta.srpgLoS) {
			return $gameMap.srpgHasLoS(oriX, oriY, x, y, this.LoSTerrain(skill), this.LoSEvents(skill));
		}
		return true;
	}

	// terrain tag this skill can pass over (-1 to get the user's movement)
	Game_CharacterBase.prototype.LoSTerrain = function(skill) {
		if (skill.meta.throughTerrain === undefined) return _defaultTag;
		var terrain = Number(skill.meta.throughTerrain);
		if (terrain < 0) {
			return $gameSystem.EventToUnit(this.eventId())[1].srpgThroughTag();
		}
		return terrain;
	};

	// list of event types that block LoS for this skill
	Game_CharacterBase.prototype.LoSEvents = function(skill) {
		var blockingTypes = [];
		if ((!_throughObject && skill.meta.throughObject != "true") || skill.meta.throughObject == "false") {
			blockingTypes.push("object");
		}
		if ((!_throughFriend && skill.meta.throughFriend != "true") || skill.meta.throughFriend == "false") {
			blockingTypes.push((this.isType() != "enemy") ? "actor" : "enemy");
		}
		if ((!_throughOpponent && skill.meta.throughOpponent != "true") || skill.meta.throughOpponent == "false") {
			blockingTypes.push((this.isType() != "enemy") ? "enemy" : "actor");
		}
		if ((!_throughEvent && skill.meta.throughEvent != "true") || skill.meta.throughEvent == "false") {
			blockingTypes.push("playerEvent");
		}
		return blockingTypes;
	};

	// trace the line from x,y to x2,y2 and return false if the path is blocked
	Game_Map.prototype.srpgHasLoS = function(x1, y1, x2, y2, tag, types) {
		tag = Math.max(tag, 0);
		var dx = Math.abs(x2 - x1);
		var dy = Math.abs(y2 - y1);
		var sx = (x1 < x2) ? 1 : -1;
		var sy = (y1 < y2) ? 1 : -1;

		var path = {};
		var x = x1;
		var y = y1;
		var err = dx - dy;
		while (x != x2 || y != y2) {
			var err2 = err << 1;
			// move horizontally
			if (err2 > -dy) {
				err -= dy;
				x += sx;
			}
			// move vertically
			if (err2 < dx) {
				err += dx;
				y += sy;
			}
			// check if sight is blocked
			if (this.terrainTag(x, y) > tag) return false;
			if (x != x2 || y != y2 || this._eventTable[x+','+y] == 'object') {
				if (types.contains(this._eventTable[x+','+y])) return false;
			}
		}
		return true;
	};

})();