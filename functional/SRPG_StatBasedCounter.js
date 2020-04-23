//-----------------------------------------------------------------------------
// copyright 2019 Doktor_Q all rights reserved.
// Released under the MIT license.
// http://opensource.org/licenses/mit-license.php
//=============================================================================

/*:
 * @plugindesc SRPG stat-based counters and custom skills
 * @author Dr. Q
 *
 * @param SideAttack_Mod:CNT
 * @desc Counter rate modifier for side attacks
 * Requires SRPG_DirectionMod
 * @default 1.0
 *
 * @param BackAttack_Mod:CNT
 * @desc Counter rate modifier for back attacks
 * Requires SRPG_DirectionMod
 * @default 0.0
 *
 * @help
 * In SRPG battles, the defender's chance of making a counter attack will be
 * based on their "Counter Attack" extra parameter (cnt), and the normal
 * counter attack effect of dodging and countering for each hit is disabled.
 * 
 * Other requirements still apply, such as ranges, weapon tags, and conditions
 * from other plugins such as uncounterable attacks.
 *
 * If you have SRPG_DirectionMod, you can use the plugin parameters to adjust
 * the counter rate based on the direction the attack is from
 *
 * New state, weapon, armor, class, actor, and enemy notetag:
 * <srpgCounterSkill:X>   counter attacks use skill X instead of your attack
 *
 * Note: Counter skills will always target the other character. If you want
 * a counter skill that applies to yourself (such as an auto-heal), try making
 * a skill that does nothing to its target, and uses scripts, formulas, or common
 * events to apply an effect to the user instead.
 */

(function(){
	var parameters = PluginManager.parameters('SRPG_StatBasedCounter');
	var side_cnt = Number(parameters['SideAttack_Mod:CNT']);
	var back_cnt = Number(parameters['BackAttack_Mod:CNT']);

//====================================================================
// use counter rate for the SRPG Counter mechanic
//====================================================================

	// if getAttackDirection was defined, apply direction paramters to counter rate
	Game_BattlerBase.prototype.dirCnt = function() {
		if ($gameTemp.getAttackDirection) {
			if ($gameTemp.getAttackDirection() === 'side') {
				return this.cnt * side_cnt;
			}
			if ($gameTemp.getAttackDirection() === 'back') {
				return this.cnt * back_cnt;
			}
		}
		return this.cnt;
	};
	
	// in SRPG mode, check counter rate before enabling counter attacks
	var _canUse = Game_BattlerBase.prototype.canUse;
	Game_BattlerBase.prototype.canUse = function(item) {
		if ($gameSystem.isSRPGMode() == true && this._srpgActionTiming == 1 && this.dirCnt() <= Math.random()) {
			return false;
		}
		return _canUse.call(this, item);
	};

	// disable the usual counter effect in SRPG mode
	var _itemCnt = Game_Action.prototype.itemCnt;
	Game_Action.prototype.itemCnt = function(target) {
		if ($gameSystem.isSRPGMode()) {
			return 0;
		}
		return _itemCnt.call(this, target);
	};

//====================================================================
// allow custom counter skills
//====================================================================

	// replace attack skill when countering
	var _Actor_attackSkillId = Game_Actor.prototype.attackSkillId;
	Game_Actor.prototype.attackSkillId = function() {
		if ($gameSystem.isSRPGMode() && this._srpgActionTiming == 1) {
			var counterSkill = this.counterSkillId();
			if (counterSkill > 0) return counterSkill;
		}
		return _Actor_attackSkillId.call(this);
	};
	var _Enemy_attackSkillId = Game_Enemy.prototype.attackSkillId;
	Game_Enemy.prototype.attackSkillId = function() {
		if ($gameSystem.isSRPGMode() && this._srpgActionTiming == 1) {
			var counterSkill = this.counterSkillId();
			if (counterSkill > 0) return counterSkill;
		}
		return _Enemy_attackSkillId.call(this);
	};

	// check state
	Game_BattlerBase.prototype.counterSkillId = function() {
		var skill = 0;
		this.states().some(function(state) {
			if (state.meta.srpgCounterSkill) {
				skill = Number(state.meta.srpgCounterSkill);
				return true;
			}
			return false;
		});
		return skill;
	};
	// check state > equipment > class > actor
	Game_Actor.prototype.counterSkillId = function() {
		var skill = Game_BattlerBase.prototype.counterSkillId.call(this);
		if (skill > 0) return skill;

		this.equips().some(function(item) {
			if (item && item.meta.srpgCounterSkill) {
				skill = Number(item.meta.srpgCounterSkill);
				return true;
			}
			return false;
		});

		if (this.currentClass().meta.srpgCounterSkill) {
			return Number(this.currentClass().meta.srpgCounterSkill);
		}

		if (this.actor().meta.srpgCounterSkill) {
			return Number(this.actor().meta.srpgCounterSkill);
		}

		return skill;
	};
	// check state > weapon > enemy
	Game_Enemy.prototype.counterSkillId = function() {
		var skill = Game_BattlerBase.prototype.counterSkillId.call(this);
		if (skill > 0) return skill;

		if (!this.hasNoWeapons()) {
			var weapon = $dataWeapons[this.enemy().meta.srpgWeapon];
			if (weapon && weapon.meta.srpgCounterSkill) return Number(weapon.meta.srpgCounterSkill);
		}

		if (this.enemy().meta.srpgCounterSkill) {
			return Number(this.enemy().meta.srpgCounterSkill);
		}

		return 0;
	};

})();