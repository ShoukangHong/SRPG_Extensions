//-----------------------------------------------------------------------------
// copyright 2019 Doktor_Q all rights reserved.
// Released under the MIT license.
// http://opensource.org/licenses/mit-license.php
//=============================================================================

/*:
 * @plugindesc SRPG Fix cooldown-related errors
 * @author Dr. Q
 *
 * @help
 * Fixes issues with cooldowns not updating correctly in SRPG mode
 */

(function(){

	// update cooldowns at the end of each turn
	var _onTurnEnd = Game_Battler.prototype.onTurnEnd;
	Game_Battler.prototype.onTurnEnd = function() {
		_onTurnEnd.call(this);
		if ($gameSystem.isSRPGMode()) {
			this.updateCooldowns();
		}
	};

	// don't update cooldown steps during SRPG battles
	var _updateCooldownSteps = Game_BattlerBase.prototype.updateCooldownSteps;
	Game_BattlerBase.prototype.updateCooldownSteps = function() {
		if (!$gameSystem.isSRPGMode()) {
			_updateCooldownSteps.call(this);
		}
	};

	// disabled, so it won't result in more cooldown ticks
	var _increaseTurn = Game_Troop.prototype.increaseTurn;
	Game_Troop.prototype.increaseTurn = function() {
		if ($gameSystem.isSRPGMode()) {
			Yanfly.SCD.Game_Troop_increaseTurn.call(this);
		} else {
			_increaseTurn.call(this);
		}
	};

})();