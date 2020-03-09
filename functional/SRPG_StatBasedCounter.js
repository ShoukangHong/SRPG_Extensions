//-----------------------------------------------------------------------------
// copyright 2019 Doktor_Q all rights reserved.
// Released under the MIT license.
// http://opensource.org/licenses/mit-license.php
//=============================================================================

/*:
 * @plugindesc SRPG stat-based counter rate
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
 * In SRPG battles, the defender's chance of making a counter attack
 * will be based on their "Counter Attack" extra parameter (cnt).
 * 
 * Other requirements still apply, such as ranges, weapon tags, and
 * conditions from other plugins such as uncounterable attacks.
 *
 * If you have SRPG_DirectionMod, you can use the plugin parameters to
 * adjust the counter rate based on the direction the attack is from
 */

(function(){
	var parameters = PluginManager.parameters('SRPG_StatBasedCounter');
	var side_cnt = Number(parameters['SideAttack_Mod:CNT']);
	var back_cnt = Number(parameters['BackAttack_Mod:CNT']);
	
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
	var _SRPG_StatCounter_BattlerBase_canUse = Game_BattlerBase.prototype.canUse;
	Game_BattlerBase.prototype.canUse = function(item) {
		if ($gameSystem.isSRPGMode() == true && this._srpgActionTiming == 1 && this.dirCnt() <= Math.random()) {
			return false;
		}
		return _SRPG_StatCounter_BattlerBase_canUse.call(this, item);
	};

	// disable the usual counter effect in SRPG mode
	var _SRPG_itemCnt = Game_Action.prototype.itemCnt;
	Game_Action.prototype.itemCnt = function(target) {
		if ($gameSystem.isSRPGMode()) {
			return 0;
		}
		return _SRPG_itemCnt.call(this, target);
	};
})();