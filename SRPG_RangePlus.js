//-----------------------------------------------------------------------------
// copyright 2020 Doktor_Q all rights reserved.
// Released under the MIT license.
// http://opensource.org/licenses/mit-license.php
//=============================================================================

/*:
* @plugindesc SRPG modifiable range
* @author Doktor_Q
* 
* @help
* This plugin allows you to modify a unit's range in the same way you can
* modify their movement. These modifiers only affect the skills and items
* you you want them to, but you don't get separate modifiers for each skill.
*
* As a side effect, if a skill has a minimum range, the maximum range won't
* drop below that minimum, ensuring there's always at least one range you can
* target.
*
* Since this is separate from weapon range, you can use it to make things like
* a staff that boosts the range of your spells, or a "blind" ailment that stops
* an archer from hitting anything that isn't right next to them
*
* Actor, class, enemy, weapon, armor, state, and skill note tag:
* <srpgRangePlus:n>    increases or decreases variable ranges by n
* 
* Skill and item notetag:
* <srpgVariableRange>   the maximum range is affected by srpgRangePlus
*/
(function(){
	// anyone can get modifiers from a state
	Game_BattlerBase.prototype.srpgRangePlus = function() {
		var n = 0;
		this.states().forEach(function(state) {
			if (state && state.meta.srpgRangePlus) {
				n += Number(state.meta.srpgRangePlus);
			}
		});
		return n;
	};

	// actors can get modifiers from the actor, class, equipment, or skill
	Game_Actor.prototype.srpgRangePlus = function() {
		var n = Game_BattlerBase.prototype.srpgRangePlus.call(this);
		// actor and class
		if (this.actor().meta.srpgRangePlus) n += Number(this.actor().meta.srpgRangePlus);
		if (this.currentClass().meta.srpgRangePlus) n += Number(this.currentClass().meta.srpgRangePlus);
		// weapon and armor
		this.equips().forEach(function(item) {
			if (item && item.meta.srpgRangePlus) {
				n += Number(item.meta.srpgRangePlus);
			}
		});
		// skills
		this.skills().forEach(function(skill) {
			if (skill && skill.meta.srpgRangePlus) {
				n += Number(skill.meta.srpgRangePlus);
			}
		});
		return n;
	};

	// enemies can get modifiers from the enemy or weapon
	Game_Enemy.prototype.srpgRangePlus = function() {
		var n = Game_BattlerBase.prototype.srpgRangePlus.call(this);
		// enemy
		if (this.enemy().meta.srpgRangePlus) n += Number(this.enemy().meta.srpgRangePlus);
		// weapon
		if (!this.hasNoWeapons()) {
			var weapon = $dataWeapons[this.enemy().meta.srpgWeapon];
			if (weapon && weapon.meta.srpgRangePlus) n += Number(weapon.meta.srpgRangePlus);
		}
		return n;
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
	var _enemy_skillRange = Game_Actor.prototype.srpgSkillRange;
	Game_Enemy.prototype.srpgSkillRange = function(skill) {
		var range = _enemy_skillRange.call(this, skill);
		var minRange = this.srpgSkillMinRange(skill);
		var rangeMod = this.srpgRangePlus();
		if (skill.meta.srpgVariableRange) {
			range += rangeMod;
		}
		return Math.max(range, minRange);
	};
})();