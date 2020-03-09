//-----------------------------------------------------------------------------
// copyright 2020 Doktor_Q all rights reserved.
// Released under the MIT license.
// http://opensource.org/licenses/mit-license.php
//=============================================================================

/*:
 * @plugindesc SRPG range enhancements
 * @author Dr. Q
 *
 * @param Line of Sight
 *
 * @param Through Objects
 * @desc If true, objects don't block LoS
 * @parent Line of Sight
 * @type boolean
 * @on YES
 * @off NO
 * @default false
 *
 * @param Through Opponents
 * @desc If true, the users's enemies don't block LoS
 * @parent Line of Sight
 * @type boolean
 * @on YES
 * @off NO
 * @default false
 *
 * @param Through Friends
 * @desc If true, the users's allies don't block LoS
 * @parent Line of Sight
 * @type boolean
 * @on YES
 * @off NO
 * @default true
 *
 * @param Through Events
 * @desc If true, playerEvents don't block LoS
 * @parent Line of Sight
 * @type boolean
 * @on YES
 * @off NO
 * @default false
 *
 * @param Through Terrain
 * @desc Terrain IDs above this number block line of sight
 * @parent Line of Sight
 * @type number
 * @min -1
 * @max 7
 * @default 0
 *
 * @param Zone of Control
 *
 * @param Base ZoC
 * @desc Initial ZoC value for all units
 * Modified by srpgZoC tags
 * @parent Zone of Control
 * @type number
 * @min 0
 * @default 0
 *
 * @param Base Through ZoC
 * @desc Initial Through ZoC value for all units
 * Modified by srpgThroughZoC tags
 * @parent Zone of Control
 * @type number
 * @min 0
 * @default 0
 *
 * @help
 * Adds line of sight, modifiable ranges, and zone of control for SRPG combat
 *
 * If an enemy unit's ZoC is higher than your Through ZoC, you are forced to stop
 * when you try to move past them. ZoC and Through ZoC cannot go below 0.
 *
 * Use plugin parameters to set the default line-of-sight rules.
 *
 * New actor, class, enemy, weapon, armor, state, and skill note tags:
 * <srpgZoC:X>                   # increases the unit's ZoC effect by X
 * <srpgThroughZoC:X>            # increases the unit's "through ZoC" by X
 * <srpgRangePlus:X>             # increases or decreases variable ranges by X
 * <srpgMovePlus:X>              # now works on actor, class, enemy, and skill notes
 *
 * New skill / item notetags:
 * <srpgVariableRange>           # range will be affected by srpgRangePlus tags
 * <srpgLoS>                     # targets must be in line of sight from the user
 * <throughObject:true/false>    # if true, object events do not block line of sight
 * <throughFriend:true/false>    # if true, the user's allies do not block line of sight
 * <throughOpponent:true/false>  # if true, the user's enemies do not block line of sight
 * <throughEvent:true/false>     # if true, playerEvents do not block line of sight
 * <throughTerrain:X>            # terrain IDs above X block line of sight
 *                               -1 checks the user's srpgThroughTag instead
 */

(function(){
	var parameters = PluginManager.parameters('SRPG_RangeControl');
	var _defaultTag = Number(parameters['Through Terrain']);
	var _throughObject = !!eval(parameters['Through Objects']);
	var _throughOpponent = !!eval(parameters['Through Opponents']);
	var _throughFriend = !!eval(parameters['Through Friends']);
	var _throughEvent = !!eval(parameters['Through Events']);
	var _baseZoc = Number(parameters['Base ZoC']);
	var _baseThroughZoc = Number(parameters['Base Through ZoC']);

	var coreParameters = PluginManager.parameters('SRPG_core');
	var _defaultMove = Number(coreParameters['defaultMove'] || 4);

//====================================================================
// utility functions
//====================================================================

	// (utility) distance between two points on the map, accounts for looping
	Game_Map.prototype.distTo = function(x1, y1, x2, y2) {
		var dx = Math.abs(x1 - x2);
		var dy = Math.abs(y1 - y2);

		if (this.isLoopHorizontal()) dx = Math.min(dx, this.width() - dx);
		if (this.isLoopVertical()) dy = Math.min(dy, this.height() - dy);

		return  dx + dy;
	};

	// check the value of a tag
	Game_BattlerBase.prototype.tagValue = function(type) {
		var n = 0;
		this.states().forEach(function(state) {
			if (state && state.meta[type]) {
				n += Number(state.meta[type]);
			}
		});
		return n;
	};
	Game_Actor.prototype.tagValue = function(type) {
		var n = Game_BattlerBase.prototype.tagValue.call(this, type);
		if (this.actor().meta[type]) n += Number(this.actor().meta[type]);
		if (this.currentClass().meta[type]) n += Number(this.currentClass().meta[type]);
		this.equips().forEach(function(item) {
			if (item && item.meta[type]) {
				n += Number(item.meta[type]);
			}
		});
		this.skills().forEach(function(skill) {
			if (skill && skill.meta[type]) {
				n += Number(skill.meta[type]);
			}
		});
		return n;
	};
	Game_Enemy.prototype.tagValue = function(type) {
		var n = Game_BattlerBase.prototype.tagValue.call(this, type);
		if (this.enemy().meta[type]) n += Number(this.enemy().meta[type]);
		if (!this.hasNoWeapons()) {
			var weapon = $dataWeapons[this.enemy().meta.srpgWeapon];
			if (weapon && weapon.meta[type]) n += Number(weapon.meta[type]);
		}
		return n;
	};

//====================================================================
// improved range calculations
//====================================================================

	// breadth-first search for movement
	Game_CharacterBase.prototype.makeMoveTable = function(x, y, move, unused, tag) {
		var edges = [];
		if (move > 0) edges = [[x, y, move, [0]]];
		$gameTemp.setMoveTable(x, y, move, [0]);
		$gameTemp.pushMoveList([x, y, false]);
		$gameMap.makeSrpgZoCTable(this.isType() == 'actor' ? 'enemy' : 'actor', this.throughZoC());

		for (var i = 0; i < edges.length; i++) {
			var cell = edges[i];
			var dmove = cell[2] - 1;
			for (var d = 2; d < 10; d += 2) {
				if (!this.srpgMoveCanPass(cell[0], cell[1], d, tag)) continue;

				var dx = $gameMap.roundXWithDirection(cell[0], d);
				var dy = $gameMap.roundYWithDirection(cell[1], d);
				if ($gameTemp.MoveTable(dx, dy)[0] >= 0) continue;

				var route = cell[3].concat(d);
				$gameTemp.setMoveTable(dx, dy, dmove, route);
				$gameTemp.pushMoveList([dx, dy, false]);
				if (dmove > 0 && !$gameMap._zocTable[dx+','+dy]) edges.push([dx, dy, dmove, route]);
			}
		}
	}

	// breadth-first search for range
	Game_CharacterBase.prototype.makeRangeTable = function(x, y, range, unused, oriX, oriY, skill) {
		var user = $gameSystem.EventToUnit(this.eventId())[1];
		if (!skill || !user) return;
		var minRange = user.srpgSkillMinRange(skill);

		var edges = [];
		if (range > 0) edges = [[x, y, range, [0], []]];
		if (minRange <= 0 && $gameTemp.RangeTable(x, y)[0] < 0) {
			if ($gameTemp.MoveTable(x, y)[0] < 0) $gameTemp.pushRangeList([x, y, true]);
			$gameTemp.setRangeTable(x, y, range, [0]);
		}
		$gameMap.makeSrpgLoSTable(this);

		for (var i = 0; i < edges.length; i++) {
			var cell = edges[i];
			var drange = cell[2] - 1;
			for (var d = 2; d < 10; d += 2) {
				if (cell[4][d] == 1) continue;
				if (!this.srpgRangeCanPass(cell[0], cell[1], d)) continue;

				var dx = $gameMap.roundXWithDirection(cell[0], d);
				var dy = $gameMap.roundYWithDirection(cell[1], d);
				var route = cell[3].concat(d);
				var forward = cell[4].slice(0);
				forward[10-d] = 1;
				if (drange > 0) edges.push([dx, dy, drange, route, forward]);

				if ($gameMap.distTo(x, y, dx, dy) >= minRange &&
				$gameTemp.RangeTable(dx, dy)[0] < 0 &&
				this.srpgRangeExtention(dx, dy, x, y, skill, range)) {
					if ($gameTemp.MoveTable(dx, dy)[0] < 0) $gameTemp.pushRangeList([dx, dy, true]);
					$gameTemp.setRangeTable(dx, dy, drange, route);
				}
			}
		}
	};

	// check line-of-sight as part of the special range
	var _srpgRangeExtention = Game_CharacterBase.prototype.srpgRangeExtention;
	Game_CharacterBase.prototype.srpgRangeExtention = function(x, y, oriX, oriY, skill, range) {
		if (!_srpgRangeExtention.apply(this, arguments)) return false;
		if (skill && skill.meta.srpgLoS) {
			return $gameMap.srpgHasLoS(oriX, oriY, x, y, this.LoSTerrain(skill), this.LoSEvents(skill));
		}
		return true;
	}

	// these functions aren't necessary anymore
	Game_Temp.prototype.initialMoveTable = function(oriX, oriY, oriMove) {
		return;
	}
	Game_Temp.prototype.initialRangeTable = function(oriX, oriY, oriMove) {
		return;
	}
	Game_Temp.prototype.minRangeAdapt = function(oriX, oriY, minRange) {
		return;
	};

//====================================================================
// line of sight checks
//====================================================================

	// map out the events that might block LoS
	Game_Map.prototype.makeSrpgLoSTable = function(source) {
		var losTable = {};
		this.events().forEach(function(event) {
			if (event !== source && !event.isErased() && event.isType() && event.isType() != 'unitEvent') {
				losTable[event.posX()+','+event.posY()] = event.isType();
			}
		});
		this._losTable = losTable;
	};

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

		// go around the other way for looping maps
		if (this.isLoopHorizontal() && dx > this.width() / 2) {
			dx = this.width() - dx;
			sx *= -1;
		}
		if (this.isLoopVertical() && dy > this.height() / 2) {
			dy = this.height() - dy;
			sy *= -1;
		}

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
				if (x < 0) x += this.width();
				if (x >= this.width()) x -= this.width();
			}
			// move vertically
			if (err2 < dx) {
				err += dx;
				y += sy;
				if (y < 0) y += this.height();
				if (y >= this.height()) y -= this.height();
			}
			// check if sight is blocked
			if (this.terrainTag(x, y) > tag) return false;
			if (x != x2 || y != y2 || this._losTable[x+','+y] == 'object') {
				if (types.contains(this._losTable[x+','+y])) return false;
			}
		}
		return true;
	};

//====================================================================
// zone of control checks
//====================================================================

	// map out the zones of control
	Game_Map.prototype.makeSrpgZoCTable = function(type, through) {
		var zocTable = {};
		this.events().forEach(function(event) {
			if (!event.isErased() && event.isType() === type && event.ZoC() > through) {
				zocTable[(event.posX()+1)+','+event.posY()] = true;
				zocTable[event.posX()+','+(event.posY()+1)] = true;
				zocTable[(event.posX()-1)+','+event.posY()] = true;
				zocTable[event.posX()+','+(event.posY()-1)] = true;
			}
		});
		this._zocTable = zocTable;
	};

	// calculate the ZoC level around an event
	Game_CharacterBase.prototype.ZoC = function() {
		var unitAry = $gameSystem.EventToUnit(this.eventId());
		if (!unitAry) return 0;
		return Math.max(unitAry[1].ZoC(), 0);
	};

	// check if an event can move through ZoC
	Game_CharacterBase.prototype.throughZoC = function() {
		var unitAry = $gameSystem.EventToUnit(this.eventId());
		if (!unitAry) return 0;
		return Math.max(unitAry[1].throughZoC(), 0);
	};

	// check ZoC
	Game_BattlerBase.prototype.ZoC = function() {
		return this.tagValue("srpgZoC") + _baseZoc;
	};
	// check through ZoC
	Game_BattlerBase.prototype.throughZoC = function() {
		return this.tagValue("srpgThroughZoC") + _baseThroughZoc;
	};

//====================================================================
// modifiable ranges
//====================================================================

	// check range bonuses
	Game_BattlerBase.prototype.srpgRangePlus = function() {
		return this.tagValue("srpgRangePlus");
	};

	// re-define minimum range to work with adjustable maximum range
	Game_Actor.prototype.srpgSkillMinRange = function(skill) {
		if (!skill) return 0;

		if (skill.meta.srpgRange == -1) {
			if (!this.hasNoWeapons()) {
				var weapon = this.weapons()[0];
				return Number(weapon.meta.weaponMinRange);
			}
		} else if (skill.meta.srpgMinRange) {
			return Number(skill.meta.srpgMinRange);
		}
		return 0;
	};
	Game_Enemy.prototype.srpgSkillMinRange = function(skill) {
		if (!skill) return 0;

		if (skill.meta.srpgRange == -1) {
			if (!this.hasNoWeapons()) {
				var weapon = $dataWeapons[this.enemy().meta.srpgWeapon];
				return Number(weapon.meta.weaponMinRange);
			} else {
				return Number(this.enemy().meta.weaponMinRange);
			}
		} else if (skill.meta.srpgMinRange) {
			return Number(skill.meta.srpgMinRange);
		}
		return 0;
	};

	// apply the bonuses to the maximum range
	var _actor_skillRange = Game_Actor.prototype.srpgSkillRange;
	Game_Actor.prototype.srpgSkillRange = function(skill) {
		var range = _actor_skillRange.call(this, skill);
		var minRange = this.srpgSkillMinRange(skill);
		var rangeMod = this.srpgRangePlus();
		if (skill.meta.srpgVariableRange) {
			range += rangeMod;
		}
		return Math.max(range, minRange);
	};
	var _enemy_skillRange = Game_Enemy.prototype.srpgSkillRange;
	Game_Enemy.prototype.srpgSkillRange = function(skill) {
		var range = _enemy_skillRange.call(this, skill);
		var minRange = this.srpgSkillMinRange(skill);
		var rangeMod = this.srpgRangePlus();
		if (skill.meta.srpgVariableRange) {
			range += rangeMod;
		}
		return Math.max(range, minRange);
	};

//====================================================================
// update where move ranges can come from
//====================================================================

	// update the move range calculation to 
	Game_Actor.prototype.srpgMove = function() {
		var n = _defaultMove;
		if (this.currentClass().meta.srpgMove) {
			n = Number(this.currentClass().meta.srpgMove);
		} else if (this.actor().meta.srpgMove) {
			n = Number(this.actor().meta.srpgMove);
		}
		n += this.tagValue("srpgMovePlus");
		return Math.max(n, 0);
	};
	Game_Enemy.prototype.srpgMove = function() {
		var n = _defaultMove;
		if (this.enemy().meta.srpgMove) {
			n = Number(this.currentClass().meta.srpgMove);
		}
		n += this.tagValue("srpgMovePlus");
		return Math.max(n, 0);
	};

})();