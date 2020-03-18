//-----------------------------------------------------------------------------
// copyright 2020 Doktor_Q all rights reserved.
// Released under the MIT license.
// http://opensource.org/licenses/mit-license.php
//=============================================================================

/*:
 * @plugindesc Skip straight to the skill menu
 * @author Dr. Q
 *
 * @param Skill Type
 * @desc Which skill type to display
 * Ignored if YEP_EquipBattleSkills is installed
 * @type number
 * @min 0
 * @default 1
 *
 * @param Max Rows
 * @desc Max number of rows to show before scrolling
 * @type number
 * @min 1
 * @default 6
 *
 * @param Show Attack
 * @desc Add the Attack command to the the skill list
 * @type select
 * @option Hide
 * @value 0
 * @option Top
 * @value 1
 * @option Bottom
 * @value 2
 * @default 1
 *
 * @param Show Guard
 * @desc Add the Guard command to the skill list
 * @type select
 * @option Hide
 * @value 0
 * @option Top
 * @value 1
 * @option Bottom
 * @value 2
 * @default 2
 *
 * @help
 * After moving an actor, go directly to the skill menu instead of the actor menu.
 * If you have YEP_EquipBattleSkills, it will show the equipped skills instead.
 *
 * There isn't a "wait" command directly, but you can repurpose the Guard skill
 * as a way to end a unit's turn without attacking.
 *
 * This plugin does *not* allow you to use items or change equipment, unless you
 * can make a skill that allows it, so it's not suitable for all games.
 */

(function(){
	// parameters
	var parameters = PluginManager.parameters('SRPG_DirectSkill');
	var _skillId = Number(parameters['Skill ID']) || 1;
	if (Imported && Imported.YEP_EquipBattleSkills) _skillId = 'battleSkills';
	var _maxRows = Number(parameters['Max Rows']) || 6;
	var _showAttack = Number(parameters['Show Attack']);
	var _showGuard = Number(parameters['Show Guard']);

	// I can't extract this API from the original code, so I'm dummying it out...
	Game_System.prototype.srpgActorCommandWindowNeedRefresh = function() {
		return [false];
	};
	// ...and replacing it with this one, for my new code to check
	Game_System.prototype.srpgActorSkillWindowNeedRefresh = function() {
		return this._SrpgActorCommandWindowRefreshFlag;
	};

	// override the specific part where it goes to the actor command window, and go to the skill window instead
	var _directSkill_SceneMap_update = Scene_Map.prototype.update;
	Scene_Map.prototype.update = function() {
		_directSkill_SceneMap_update.call(this);
		var flag = $gameSystem.srpgActorSkillWindowNeedRefresh();
		if (flag[0]) {
			if (!this._skillWindow.isOpen() && !this._skillWindow.isOpening()) {
				this._skillWindow.setActor(flag[1][1]);
				this._skillWindow.setStypeId(_skillId);
				this._skillWindow.refresh();
				this._skillWindow.show();
				this._skillWindow.activate();
				this._skillWindow.open();
			}
		} else {
			if (this._skillWindow.isOpen() && !this._skillWindow.isClosing()) {
				this._skillWindow.close();
				this._skillWindow.deactivate();
			}
		}
	}

	// skill cancel to actor movement
	Scene_Map.prototype.onSkillCancel = function() {
		this._skillWindow.hide();
		this.selectPreviousActorCommand();
	};

	// add Attack and Guard to the list of battle skills
	Window_BattleSkill.prototype.makeItemList = function() {
		Window_SkillList.prototype.makeItemList.call(this)
		if (this._actor) {
			if (_showGuard == 1) this._data.unshift($dataSkills[this._actor.guardSkillId()]);
			if (_showAttack == 1) this._data.unshift($dataSkills[this._actor.attackSkillId()]);
			if (_showAttack == 2) this._data.push($dataSkills[this._actor.attackSkillId()]);
			if (_showGuard == 2) this._data.push($dataSkills[this._actor.guardSkillId()]);
			this.updateFittingHeight();
		}
	};

	// update the height based on the number of skills the user knows
	Window_BattleSkill.prototype.updateFittingHeight = function() {
		var rows = Math.min(this._data.length, _maxRows);
		this.height = this.fittingHeight(rows);
		this.y = (Graphics.boxHeight - this.height) / 2;
	};

	// update window position
	var _createSkillWindow = Scene_Map.prototype.createSkillWindow;
	Scene_Map.prototype.createSkillWindow = function() {
		_createSkillWindow.call(this);
		var win = this._skillWindow;
		win.width = Graphics.boxWidth / 3;
		win.height = win.fittingHeight(_maxRows);
		win.y = (Graphics.boxHeight - win.height) / 2;
	};

	// skill window only occupies a single column
	Window_BattleSkill.prototype.maxCols = function() {
		return 1;
	};

	// handle the skill list having null entries
	Window_BattleSkill.prototype.selectLast = function() {
		Window_SkillList.prototype.selectLast.call(this);
		if ($gameSystem.isSRPGMode()) {
			skill = this._actor.lastBattleSkill();
			if (!skill) this.select(0);
		}
	};

})();
