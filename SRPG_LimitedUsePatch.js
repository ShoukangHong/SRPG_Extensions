//-----------------------------------------------------------------------------
// copyright 2019 Doktor_Q all rights reserved.
// Released under the MIT license.
// http://opensource.org/licenses/mit-license.php
//=============================================================================

/*:
 * @plugindesc SRPG Fix limited use-related errors
 * @author Dr. Q
 *
 * @help
 * Fixes issues with limited uses not updating correctly in SRPG mode
 * Not required if you use SRPG_MapBattle
 */

(function(){
	// don't update limited uses after battle in SRPG mode
	var _recoverLimitedSkillUsesBattle = Game_BattlerBase.prototype.recoverLimitedSkillUsesBattle;
	Game_BattlerBase.prototype.recoverLimitedSkillUsesBattle = function(result) {
		if (!$gameSystem.isSRPGMode()) {
			_recoverLimitedSkillUsesBattle.call(this, result);
		}
	};

})();