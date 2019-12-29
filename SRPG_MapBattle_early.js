//-----------------------------------------------------------------------------
// copyright 2019 Doktor_Q all rights reserved.
// Released under the MIT license.
// http://opensource.org/licenses/mit-license.php
//=============================================================================

/*:
 * @plugindesc SRPG show skills on the map (v0.9)
 * @author Dr. Q
 *
 *
 * @help
 * WIP extension that runs SRPG combat on the map.
 * May not be compatible with all battle plugins.
 *
 * In lunatic mode tags, script calls, or damage formulas .event()
 * gets the event associated with that unit on the map, if you want
 * to manipulate it (movement, change appearance, etc).
 *
 * Features under development:
 * - "Counter Attack" trait (SRPG counters are supported)
 * - Battle reward window
 *
 * Known incompatibile plugins:
 * - SRPG_AgiAttackPlus
 * - SRPG_UncounterableAttack (see below)
 *
 * The plugin is incompatible with SRPG_UncounterableAttack, so the
 * <srpgUncounterable> has been directly integrated. Skills and items
 * with this tag will never provoke a counter attack from the enemy.
 */

(function(){
	var coreParameters = PluginManager.parameters('SRPG_core');
	var _srpgTroopID = Number(coreParameters['srpgTroopID'] || 1);

//====================================================================
// utility functions for finding unit events
//====================================================================

	// get the event for a general battler
	Game_BattlerBase.prototype.event = function() {
		var currentBattler = this;
		var eventId = 0;
		$gameSystem._EventToUnit.forEach(function (battleAry, index) {
			if (battleAry[1] === currentBattler) eventId = index;
		});
		return $gameMap.event(eventId);
	};

	// get the event for an actor specifically
	Game_Actor.prototype.event = function() {
		var eventId = $gameSystem.ActorToEvent(this.actorId())
		return $gameMap.event(eventId);
	};

//====================================================================
// process attacks directly on the map scene
//====================================================================

	// set up the map attacks
	Scene_Map.prototype.srpgBattleStart = function(userArray, targetArray) {
		$gameSystem.clearSrpgStatusWindowNeedRefresh();
		$gameSystem.clearSrpgBattleWindowNeedRefresh();

		this.preBattleSetDirection();
		this.eventBeforeBattle();

		// get the data
		var user = userArray[1];
		var target = targetArray[1];
		var action = user.action(0);
		var reaction = null;

		// set up the troop and the battle party
		$gameTroop.clearSrpgBattleEnemys();
		$gameTroop.clear();
		$gameParty.clearSrpgBattleActors();
		if (userArray[0] === 'enemy') $gameTroop.pushSrpgBattleEnemys(user);
		else $gameParty.pushSrpgBattleActors(user);
		if (targetArray[0] === 'enemy') $gameTroop.pushSrpgBattleEnemys(target);
		else $gameParty.pushSrpgBattleActors(target);
		BattleManager.setup(_srpgTroopID, false, true);
		action.setSubject(user);

		// queue up attack
		user.setActionTiming(0);
		this.srpgAddMapSkill(action, user, target);

		// queue up counterattack
		if (userArray[0] !== targetArray[0] && target.canMove() && !action.item().meta.srpgUncounterable) {
			target.setActionTiming(1);
			target.srpgMakeNewActions();
			reaction = target.action(0);
			reaction.setSubject(target);
			reaction.setAttack();
			var actFirst = (reaction.speed() > action.speed());
			this.srpgAddMapSkill(reaction, target, user, actFirst);
		}
	};

	// work through the queue of attacks
	var _SRPG_SceneMap_update = Scene_Map.prototype.update;
	Scene_Map.prototype.update = function() {
		_SRPG_SceneMap_update.call(this);
		// process attacks as long as nothing else is going on
		var active = $gameTemp.activeEvent();
		var target = $gameTemp.targetEvent();
		if ($gameSystem.isSubBattlePhase() === 'invoke_action' &&
		!$gameTemp.isCommonEventReserved() &&
		!active.isAnimationPlaying() && active.isStopping() &&
		!target.isAnimationPlaying() && target.isStopping() /*&&
		!this._srpgBattleResultWindow.isChangeExp()*/) {
			// process skill effects
			if (this.srpgHasMapSkills()) {
				this.srpgUpdateMapSkill();
			}
			/*// show battle results after it evaluates
			else if (!this._srpgBattleResultWindow.isOpen() && !this._srpgBattleResultWindow.isOpening()) {
				var showResults = this.processSrpgVictory();
				if (!showResults) $gameSystem.setSubBattlePhase('after_battle');
			}
			// press any key to close the result window
			else if (this._srpgBattleResultWindow.isOpen() &&
			(Input.isPressed('ok') || Input.isPressed('cancel') || TouchInput.isPressed() || TouchInput.isCancelled())) {
				this._srpgBattleResultWindow.close();
				$gameSystem.setSubBattlePhase('after_battle');
			}*/
			else {
				this.processSrpgVictory();
				$gameSystem.setSubBattlePhase('after_battle');
			}
		}
	}

//====================================================================
// queue of skills being executed on the map
//====================================================================

	// queue up a skill for the on-map battle
	Scene_Map.prototype.srpgAddMapSkill = function(action, user, target, addToFront) {
		this._srpgSkillList = this._srpgSkillList || [];
		var data = {
			action: action,
			user: user,
			target: target,
			count: 0,
		};
		if (addToFront) this._srpgSkillList.unshift(data);
		else this._srpgSkillList.push(data);
	};

	// check how many skills are left on the queue
	Scene_Map.prototype.srpgHasMapSkills = function() {
		this._srpgSkillList = this._srpgSkillList || [];
		return this._srpgSkillList.length;
	};

	// clear all enqueued skills
	Scene_Map.prototype.srpgClearMapSkills = function() {
		this._srpgSkillList = this._srpgSkillList || [];
		this._srpgSkillList.clear();
	};

	// get the next skill off the queue and invoke it
	Scene_Map.prototype.srpgUpdateMapSkill = function() {
		this._srpgSkillList = this._srpgSkillList || [];
		var data = this._srpgSkillList.shift();
		if (!data) return false;
		return this.srpgInvokeMapSkill(data);
	};

	// invoke skill effects
	Scene_Map.prototype.srpgInvokeMapSkill = function(data) {
		var action = data.action;
		var user = data.user;
		var target = data.target;

		// pre-skill (costs and casting animations)
		if (data.count == 0) {
			if (!user.canMove() || !user.canUse(action.item())) {
				user.setLastTarget(target);
				user.removeCurrentAction();
				user.onAllActionsEnd();
				return false;
			}
			user.useItem(action.item());
			// has a cast animation, is not attack or guard, is a skill, and isn't a repeat as part of an AoE
			// I apologize for how convoluted this check is
			if (action.item().castAnimation && !action.isAttack() && !action.isGuard() && action.isSkill() &&
			(!$gameTemp.isFirstAction || $gameTemp.isFirstAction() || user.srpgSkillAreaRange(action.item()) <= 0)) {
				user.event().requestAnimation(action.item().castAnimation);
			}
			data.count = 1;
			this._srpgSkillList.unshift(data);
		}
		// repeating skill effects
		else if (data.count <= action.numRepeats()) {
			// check for reflection on the first repeat
			if (data.count === 1 && user != target && Math.random() < action.itemMrf(target)) {
				target.performReflection();
				if (target.reflectAnimationId) {
					target.event().requestAnimation(target.reflectAnimationId());
				}
				target = user;
				data.target = user;
			}
			var animation = action.item().animationId;
			if (animation < 0) animation = (user.isActor() ? user.attackAnimationId1() : user.attackAnimationId());
			target.event().requestAnimation(animation);
			action.apply(target);
			data.count += 1;
			this._srpgSkillList.unshift(data);
		}
		// post skill (run common event and clean up)
		else {
			action.applyGlobal();
			user.setLastTarget(target);
			user.removeCurrentAction();
			user.onAllActionsEnd();
		}

		// Show the results
		user.srpgShowResults();
		target.srpgShowResults();
		return true;
	};

	// show the results of the action
	Game_BattlerBase.prototype.srpgShowResults = function() {
		var result = this.result();
		// ways to hit
		if (result.isHit()) {
			if (result.hpDamage > 0 && !result.drain) this.performDamage();
			if (result.hpDamage < 0 || result.mpDamage < 0 || result.tpDamage < 0) this.performRecovery();
			var target = this;
			result.addedStateObjects().forEach(function(state) {
				if (state.id === target.deathStateId()) target.performCollapse();
			});
		}
		// ways to miss
		else {
			if (result.missed) this.performMiss();
			if (result.evaded && result.physical) this.performEvasion();
			if (result.evaded && !result.physical) this.performMagicEvasion();
		}
		// show pop-ups
		this.startDamagePopup();
	};

//====================================================================
// Handle battle rewards
//====================================================================

	// add "rewards" object to the map scene
	var _scene_map_initialize = Scene_Map.prototype.initialize;
	Scene_Map.prototype.initialize = function() {
		_scene_map_initialize.call(this);
		this._rewards = {};
	};

	/*// put a results window in the scene
	var _scene_map_createAllWindows = Scene_Map.prototype.createAllWindows;
	Scene_Map.prototype.createAllWindows = function() {
		_scene_map_createAllWindows.call(this);
		this.createSrpgBattleResultWindow();
	};
	Scene_Map.prototype.createSrpgBattleResultWindow = function() {
		this._srpgBattleResultWindow = new Window_SrpgBattleResult($gameParty.battleMembers()[0]);
		this._srpgBattleResultWindow.openness = 0;
		this.addWindow(this._srpgBattleResultWindow);
	};*/

	// use all the existing code for rewards, so it can inherit plugin modifications
	Scene_Map.prototype.makeRewards = BattleManager.makeRewards;
	Scene_Map.prototype.gainRewards = BattleManager.gainRewards;
	Scene_Map.prototype.gainExp = BattleManager.gainExp;
	Scene_Map.prototype.gainGold = BattleManager.gainGold;
	Scene_Map.prototype.gainDropItems = BattleManager.gainDropItems;

	// process victory
	Scene_Map.prototype.processSrpgVictory = function() {
		if ($gameParty.battleMembers()[0] && $gameParty.battleMembers()[0].isAlive()) {
			this.makeRewards();
			if (this._rewards.exp > 0 || this._rewards.gold > 0 || this._rewards.items.length > 0) {
				//this._srpgBattleResultWindow.setRewards(this._rewards);
				var se = {};
				se.name = 'Item3';
				se.pan = 0;
				se.pitch = 100;
				se.volume = 90;
				AudioManager.playSe(se);
				//this._srpgBattleResultWindow.open();
				this.gainRewards();
				return true;
			}
			return false;
		}
	};

//====================================================================
// show popups for map and status damage
//====================================================================

	// show pop-up for regeneration
	var _battler_regenerateAll = Game_Battler.prototype.regenerateAll;
	Game_Battler.prototype.regenerateAll = function() {
		_battler_regenerateAll.call(this);
		if ($gameSystem.isSRPGMode()) {
			this._result.used = true;
			this.srpgShowResults();
		}
	};

	// show pop-up for floor damage
	var _srpgExecuteFloorDamage = Game_Battler.prototype.srpgExecuteFloorDamage;
	Game_Battler.prototype.srpgExecuteFloorDamage = function() {
		_srpgExecuteFloorDamage.call(this);
		if (this._result.hpDamage != 0) {
			this._result.used = true;
			this.srpgShowResults();
		}
	};

	// suppress the screen flash from damage in SRPG mode
	var _startFlashForDamage = Game_Screen.prototype.startFlashForDamage;
	Game_Screen.prototype.startFlashForDamage = function() {
		if (!$gameSystem.isSRPGMode()) _startFlashForDamage.call(this);
	};

//====================================================================
// on-map damage pop-ups
//====================================================================

	// initialize the damage popups
	var _sprite_character_initMembers = Sprite_Character.prototype.initMembers;
	Sprite_Character.prototype.initMembers = function() {
		_sprite_character_initMembers.call(this);
		this._damages = [];
	};

	// update the damage popups
	var _sprite_character_update = Sprite_Character.prototype.update;
	Sprite_Character.prototype.update = function (){
		_sprite_character_update.call(this);
		if (this._character.isEvent()) {
			this.updateDamagePopup();
		}
	};

	// update the damage pop-ups each frame
	Sprite_Character.prototype.updateDamagePopup = function() {
		this.setupDamagePopup();
		if (this._damages.length > 0) {
			for (var i = 0; i < this._damages.length; i++) {
				this._damages[i].update();
			}
			if (!this._damages[0].isPlaying()) {
				this.parent.removeChild(this._damages[0]);
				this._damages.shift();
			}
		}
	};

	// create the damage pop-up
	Sprite_Character.prototype.setupDamagePopup = function() {
		var array = $gameSystem.EventToUnit(this._character.eventId());
		if ($gameSystem.isSRPGMode() && array && array[1]) {
			var battler = array[1];
			if (battler.isDamagePopupRequested()) {
				var sprite = new Sprite_Damage();
				sprite.x = this.x;
				sprite.y = this.y;
				sprite.z = 9;
				sprite.setup(battler);
				this._damages.push(sprite);
				this.parent.addChild(sprite);
			}
			battler.clearDamagePopup();
			battler.clearResult();
		}
	};

//====================================================================
// compatability overrides
//====================================================================

	// restore repeats when using Battle Engine Core
	if (DataManager.addActionEffects) {
		var _addActionEffects = DataManager.addActionEffects;
		DataManager.addActionEffects = function(obj, array) {
			var repeats = obj.repeats;
			_addActionEffects.call(this, obj, array);
			obj.repeats = repeats; // restore the repeat count
		};
	}

})();