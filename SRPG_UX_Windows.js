//-----------------------------------------------------------------------------
// copyright 2019 Doktor_Q all rights reserved.
// Released under the MIT license.
// http://opensource.org/licenses/mit-license.php
//=============================================================================

/*:
 * @plugindesc SRPG window improvements
 * @author Dr. Q
 *
 * @param Hide no EXP
 * @desc Don't show the exp bar if you didn't get any
 * @type boolean
 * @on YES
 * @off NO
 * @default true
 *
 * @param Hide Self Target
 * @desc Hide the target window when self-targeting
 * @type boolean
 * @on YES
 * @off NO
 * @default false
 *
 * @help
 * Minor improvements to the behavior of windows
 * 
 * Options:
 * - Hide no EXP: Don't show the experience bar after
 *   battles that didn't grant experience, and hides
 *   the pop-up entirely if there were no rewards.
 *
 * - Hide Self Target: Only shows one status window for
 *   skills that target the user.
 *
 * Automatic changes:
 * - Status windows can also be closed with cancel/menu
 * - Skills are correctly disabled in the menu when not usable
 *
 */

(function(){
	// parameters
	var parameters = PluginManager.parameters('SRPG_UX_Selection');

	var hideReward = !!eval(parameters['Hide no EXP']);
	var hideSelfTarget = !!eval(parameters['Hide Self Target']);


//====================================================================
// don't show exp rewards if you didn't get any
//====================================================================

	// rewritten victory processing, optionally skips reward window if there's no rewards
	BattleManager.processSrpgVictory = function() {
		if ($gameTroop.members()[0] && $gameTroop.isAllDead()) {
			$gameParty.performVictory();
		}
		this.makeRewards();
		// only show the rewards if there's something to show
		if (!hideReward || this._rewards.exp > 0 || this._rewards.gold > 0 || this._rewards.items.length > 0) {
			this._srpgBattleResultWindow.setRewards(this._rewards);
			var se = {};
			se.name = 'Item3';
			se.pan = 0;
			se.pitch = 100;
			se.volume = 90;
			AudioManager.playSe(se);
			this._srpgBattleResultWindow.open();
			this.gainRewards();
		}
		// otherwise, skip right to the end
		else {
			this.endBattle(3);
		}
	};

	// don't show the xp bar if no xp was gained
	/*Window_SrpgBattleResult.prototype.drawContents = function() {
		var lineHeight = this.lineHeight();
		var pos = 0;

		// check for exp
		if (this._rewards.exp > 0) {
			this.drawGainExp(6, lineHeight * pos);
			pos += 2;
		} else {
			this._changeExp = 0;
		}

		// check for gold
		if (this._rewards.gold > 0) {
			this.drawGainGold(6, lineHeight * pos);
			pos += 1;
		}

		// items are last, so they just happen
		this.drawGainItem(0, lineHeight * pos);
	};*/

//====================================================================
// only show one window when self-targeting
//====================================================================

	// hide the second status window for self-target actions
	var _SRPG_SceneMap_update = Scene_Map.prototype.update;
	Scene_Map.prototype.update = function() {
		_SRPG_SceneMap_update.call(this);
		if (!hideSelfTarget) return;
		var flag = $gameSystem.srpgBattleWindowNeedRefresh();
		if (flag[0] && flag[1][1] == flag[2][1]) {
			if (this._mapSrpgTargetWindow.isOpen() || this._mapSrpgTargetWindow.isOpening()) {
				this._mapSrpgTargetWindow.close();
			}
		}
	}

	// cancel movement or target, plus quick targeting
	var _updateCallMenu = Scene_Map.prototype.updateCallMenu;
	Scene_Map.prototype.updateCallMenu = function() {
		if ($gameSystem.isSRPGMode() && !$gameSystem.srpgWaitMoving()) {
			// close status windows with cancel
			if ($gameSystem.isSubBattlePhase() === 'status_window' && this.isMenuCalled()) {
				$gameSystem.clearSrpgStatusWindowNeedRefresh();
				SoundManager.playCancel();
				$gameTemp.clearActiveEvent();
				$gameSystem.setSubBattlePhase('normal');
				$gameTemp.clearMoveTable();
				return;
			}
		}
		_updateCallMenu.call(this);
	};

//====================================================================
// correctly handle enabled / disabled options in the menu
//====================================================================

	// don't allow non-usable skills to be used during battle
	Window_BattleSkill.prototype.isEnabled = function(item) {
		return this._actor && this._actor.canUse(item);
	};

})();