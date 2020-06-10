//-----------------------------------------------------------------------------
// copyright 2020 Doktor_Q all rights reserved.
// Released under the MIT license.
// http://opensource.org/licenses/mit-license.php
//=============================================================================

/*:
 * @plugindesc SRPG control floor damage
 * @author Dr. Q
 *
 *
 * @param Floor Damage Formula
 * @desc Formula used to determine floor damage
 * @type text
 * @default target.mhp * 0.1
 *
 * @param Floor Damage Element
 * @desc Floor damage element, used for resistances
 * Set to 0 for no element
 * @type number
 * @default 0
 *
 * @param Floor Damage Animation
 * @desc Animation played when taking floor damage
 * Set to 0 for no animation
 * @type animation
 * @default 0
 *
 *
 * @help
 * This plugin gives you control over floor damage during SRPG battles.
 * It does not affect the way floor damage is handled otherwise.
 *
 * The damage formula works the same as for a skill or item.
 * The following variables are available for use:
 * s[#]         the value of switch #, use for conditionals
 * v[#]         the value of variable #
 * target       the actor or enemy on the damage tile
 * b            same as target, but shorter
 * region       region ID of the current tile
 * tag          terrain tag of the current tile
 *
 * Note: If "knockout by floor damage" is not enabled in the System tab, units
 * will always survive floor damage with at least 1 HP
 *
 * new map / tileset notetags:
 * <floorDmg: formula>     change the floor damage formula
 * <floorElement:X>        change the floor damage element
 * <floorAnimation:X>      change the floor damage animation
 *
 * Notetags on the map have priority over notetags on the tileset
 * Example: <floorDmg: b.hp * 0.5> sets floor damage to half the unit's HP
 *
 * new event notetag:
 * <damageFloor>           the event's space is treated as a damage tile
 * Uses the same settings as normal damage tiles for that map
 * Best used with events that are not already actors, enemies, or objects
 *
 * New script call:
 * a.srpgBattlerDead()
 * b.srpgBattlerDead()     if the battler is dead, erases their event and updates
 *                         the number of living units on each team.
 *
 * Use this to check for KOs after dealing damage via events or script calls, outside
 * of normally using attacks or items.
 * Floor damage and end-of-round poison are already handled.
 */

(function(){
	var parameters = PluginManager.parameters('SRPG_FloorDamage');
	var _formula = parameters['Floor Damage Formula'] || "target.mhp * 0.1";
	var _element = Number(parameters['Floor Damage Element']) || 0;
	var _animation = Number(parameters['Floor Damage Animation']) || 0;

	var coreParameters = PluginManager.parameters('SRPG_core');
	var _existActorVarID = Number(coreParameters['existActorVarID'] || 1);
	var _existEnemyVarID = Number(coreParameters['existEnemyVarID'] || 2);

//====================================================================
// utility functions for finding unit events
//====================================================================

	// get the event for a general battler
	Game_BattlerBase.prototype.event = function() {
		var currentBattler = this;
		var eventId = 0;
		$gameSystem._EventToUnit.forEach(function (battleArray, index) {
			if (battleArray && battleArray[1] === currentBattler) eventId = index;
		});
		return $gameMap.event(eventId);
	};

	// get the event for an actor specifically
	Game_Actor.prototype.event = function() {
		var currentActor = this.actorId();
		var eventId = 0;
		$gameSystem._EventToUnit.forEach(function (battleArray, index) {
			if (battleArray && battleArray[1] === currentActor) eventId = index;
		});
		return $gameMap.event(eventId);
	};

//====================================================================
// handle death from non-battle effects
//====================================================================

	// check if the unit has died
	Game_Battler.prototype.srpgBattlerDead = function () {
		if (this.isDead() && this.event() && !this.event().isErased()) {
			this.event().erase();
			if (this.isActor()) {
				var oldValue = $gameVariables.value(_existActorVarID);
				$gameVariables.setValue(_existActorVarID, oldValue - 1);
			} else {
				var oldValue = $gameVariables.value(_existEnemyVarID);
				$gameVariables.setValue(_existEnemyVarID, oldValue - 1);
			}
		}
	};

	// battlers can die from poison or states expiring
	var _onTurnEnd = Game_Battler.prototype.onTurnEnd;
	Game_Battler.prototype.onTurnEnd = function() {
		_onTurnEnd.call(this);
		if ($gameSystem.isSRPGMode()) {
			this.srpgBattlerDead();
		}
	};

//====================================================================
// custom floor damage
//====================================================================

	// events can trigger floor damage
	_isDamageFloor = Game_Map.prototype.isDamageFloor;
	Game_Map.prototype.isDamageFloor = function(x, y) {
		var damageFloor = _isDamageFloor.call(this, x, y);
		if (!damageFloor && $gameSystem.isSRPGMode()) {
			damageFloor = $gameMap.events().some(function(event){
				if (event.isErased()) return false;
				if (!event.pos(x, y)) return false;
				if (!event.characterName() === '') return false;
				if (!event.event().meta.damageFloor) return false;
				return true;
			});
		}
		return damageFloor;
	};

	// custom floor damage!
	Game_Battler.prototype.srpgExecuteFloorDamage = function() {
		// checkable variables
		var s = $gameSwitches._data;
		var v = $gameVariables._data;
		var a = this;
		var b = this;
		var user = this;
		var target = this;
		var x = this.event() ? this.event().posX() : 0;
		var y = this.event() ? this.event().posY() : 0;
		var region = $gameMap.regionId(x, y) || 0;
		var terrain = $gameMap.terrainTag(x, y) || 0;
		var tag = terrain;

		// damage formula
		var dmgFormula = _formula;
		if ($dataMap.meta.floorDmg) {
			dmgFormula = $dataMap.meta.floorDmg;
		} else if ($gameMap.tileset().meta.floorDmg) {
			dmgFormula = $gameMap.tileset().meta.floorDmg;
		}

		// damage element
		var dmgElement = _element;
		if ($dataMap.meta.floorElement) {
			dmgElement = Number($dataMap.meta.floorElement);
		} else if ($gameMap.tileset().meta.floorElement) {
			dmgElement = Number($gameMap.tileset().meta.floorElement);
		}

		// damage animation
		var dmgAnimation = _animation;
		if ($dataMap.meta.floorAnimation) {
			dmgAnimation = Number($dataMap.meta.floorAnimation);
		} else if ($gameMap.tileset().meta.floorAnimation) {
			dmgAnimation = Number($gameMap.tileset().meta.floorAnimation);
		}

		// calculate the damage
		var damage = 0;
		try {
			damage = eval(dmgFormula);
		} catch (e) {
			console.log("Error in damage formula:");
			console.log(dmgFormula);
			console.error(e);
		}
		if (dmgElement > 0) damage *= this.elementRate(dmgElement);
		damage = Math.floor(damage * this.fdr);
		if (!$dataSystem.optFloorDeath && damage >= this.hp) damage = Math.max(this.hp-1, 0);

		// apply the damage and show the effect
		this.gainHp(-damage);
		if (damage != 0 && dmgAnimation > 0 && this.event()) {
			this.event().requestAnimation(dmgAnimation);
		}

		// check if the effect killed
		this.srpgBattlerDead();
	};

})();