//-----------------------------------------------------------------------------
// copyright 2020 Doktor_Q all rights reserved.
// Released under the MIT license.
// http://opensource.org/licenses/mit-license.php
//=============================================================================

/*:
 * @plugindesc SRPG show skills on the map (v1.0)
 * @author Dr. Q
 *
 * @param Use Map Battle
 * @desc Default Map Battle usage
 * @type select
 * @option Always
 * @value 2
 * @option When Switch is On
 * @value 1
 * @option Never 
 * @value 0
 * @default 2
 *
 * @param Map Battle Switch
 * @parent Use Map Battle
 * @desc Switch that activates map battle
 * @type switch
 * @default 0
 *
 *
 * @param Animation Delay
 * @desc Frames between animation start and skill effect
 * Set to -1 to wait for all animations to finish
 * @type number
 * @min -1
 * @default 25
 *
 * @help
 * Runs SRPG combat on the map. May be incompatible with other battle system 
 * plugins.
 *
 * In lunatic mode tags, script calls, or damage formulas, .event()
 * gets the event associated with that unit on the map, if you want
 * to manipulate it (movement, change appearance, etc).
 *
 * /!\ IMPORTANT /!\
 * Some plugins and mechanics can work differently between the Map Battle and
 * normal battles, especially if you use action sequences. Anything that can be
 * used in both, such as counter attacks, should be thoroughly tested to ensure
 * its works the same.
 * In lunatic mode tags or formulas, $gameSystem.useMapBattle() returns true if
 * the skill is being run on the map, instead of in the battle scene.
 * 
 *
 *
 * New skill / item tags:
 * <mapBattle:true>     always uses this skill on the map
 * <mapBattle:false>    never uses this skill on the map
 * <targetAnimation:X>  shows animation X on the target cell
 * <animationDelay:X>   waits X frames between the animation and effect
 *                      overrides the default settings
 * <animationDelay:-1>  waits for animations to finish before the effect
 *
 * <directionalAnimation:X> shows an animation on the target cell based on
 * the direction the user is facing, following the usual direction order.
 * For example, <directionalAnimation:20> will show the following:
 * Animation 20 when facing down
 * Animation 21 when facing left
 * Animation 22 when facing right
 * Animation 23 when facing up
 *
 * Known incompatible plugins with map battle:
 * - SRPG_AgiAttackPlus
 * - SRPG_UncounterableAttack (see below)
 *
 * MapBattle mode is incompatible with SRPG_UncounterableAttack, so the
 * <srpgUncounterable> tag has been directly integrated. Skills and items
 * with this tag will not trigger a counter attack during map battles.
 */

(function(){
	var parameters = PluginManager.parameters('SRPG_MapBattle');
	var _useMapBattle = Number(parameters['Use Map Battle'] || 2);
	var _mapBattleSwitch = Number(parameters['Map Battle Switch'] || 0);
	var _animDelay = Number(parameters['Animation Delay'] || -1);

	var coreParameters = PluginManager.parameters('SRPG_core');
	var _srpgTroopID = Number(coreParameters['srpgTroopID'] || 1);
	var _rewardSe = coreParameters['rewardSound'] || 'Item3';

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
// process attacks directly on the map scene
//====================================================================


	// force a specific style of battle for one exchange
	Game_System.prototype.forceSRPGBattleMode = function(type) {
		this._battleMode = type;
	};
	Game_System.prototype.clearSRPGBattleMode = function() {
		this._battleMode = null;
	};

	// control whether to use map battle or not
	Game_System.prototype.useMapBattle = function() {
		// forced mode
		if (this._battleMode === 'map') return true;
		else if (this._battleMode === 'normal') return false;
		// system defaults
		else if (_useMapBattle == 2) return true;
		else if (_useMapBattle == 0) return false;
		else return (_mapBattleSwitch > 0 && $gameSwitches.value(_mapBattleSwitch));
	};

	// set up the map attacks
	var _srpgBattleStart = Scene_Map.prototype.srpgBattleStart;
	Scene_Map.prototype.srpgBattleStart = function(userArray, targetArray) {
		// get the data
		var user = userArray[1];
		var target = targetArray[1];
		var action = user.action(0);
		var reaction = null;

		// prepare action timing
		user.setActionTiming(0);
		if (user != target) target.setActionTiming(1);

		// check if we're using map battle on this skill
		if (action && action.item()) {
			var mapBattleTag = action.item().meta.mapBattle;
			if (mapBattleTag == 'true') $gameSystem.forceSRPGBattleMode('map');
			else if (mapBattleTag == 'false') $gameSystem.forceSRPGBattleMode('normal');
		}
		if (!$gameSystem.useMapBattle()) {
			_srpgBattleStart.call(this, userArray, targetArray);
			return;
		}

		// pre-skill setup
		$gameSystem.clearSrpgStatusWindowNeedRefresh();
		$gameSystem.clearSrpgBattleWindowNeedRefresh();

		this.preBattleSetDirection();
		this.eventBeforeBattle();

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

		// queue the action
		this.srpgAddMapSkill(action, user, target);

		// queue up counterattack
		if (userArray[0] !== targetArray[0] && target.canMove() && !action.item().meta.srpgUncounterable) {
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

		// there are definitely no map skills in play
		if (!$gameSystem.isSRPGMode() || $gameSystem.isSubBattlePhase() !== 'invoke_action' ||
		!$gameSystem.useMapBattle()) {
			return;
		}

		// update map skills
		if (!this.waitingForSkill() && !this._srpgBattleResultWindow.isChangeExp()) {
			// process skills
			if (this.srpgHasMapSkills()) {
				do {
					this.srpgUpdateMapSkill();
				} while (this.srpgHasMapSkills() && !this.waitingForSkill())
			}
			// show battle results after it finishes
			else if (!this._srpgBattleResultWindow.isOpen() && !this._srpgBattleResultWindow.isOpening()) {
				var showResults = this.processSrpgVictory();
				if (!showResults) $gameSystem.setSubBattlePhase('after_battle');
			}
			// press any key to close the result window
			else if (this._srpgBattleResultWindow.isOpen() &&
			(Input.isPressed('ok') || Input.isPressed('cancel') || TouchInput.isPressed() || TouchInput.isCancelled())) {
				this._srpgBattleResultWindow.close();
				$gameSystem.setSubBattlePhase('after_battle');
			}
		} else {
			// handles time-based waiting
			this.updateSkillWait();
		}
	};

	// reset battle mode between skills
	var _srpgAfterAction = Scene_Map.prototype.srpgAfterAction;
	Scene_Map.prototype.srpgAfterAction = function() {
		$gameSystem.clearSRPGBattleMode();
		_srpgAfterAction.call(this);
	};

	// time-based skill wait!
	Scene_Map.prototype.setSkillWait = function(time) {
		this._skillWait = time;
	};
	Scene_Map.prototype.updateSkillWait = function() {
		if (this._skillWait > 0) this._skillWait--;
	};
	Scene_Map.prototype.resetSkillWait = function() {
		this._skillWait = undefined;
	};
	Scene_Map.prototype.skillWait = function() {
		return this._skillWait || 0;
	};
	Scene_Map.prototype.skillAnimWait = function() {
		return (this._skillWait == undefined);
	};

	// check if we're still waiting for a skill to finish
	Scene_Map.prototype.waitingForSkill = function() {
		if ($gameTemp.isCommonEventReserved()) return true;

		if ($gamePlayer.isAnimationPlaying() || !$gamePlayer.isStopping()) return true;

		if (this.skillAnimWait()) {
			var active = $gameTemp.activeEvent();
			if (active.isAnimationPlaying() || !active.isStopping()) return true;

			var target = $gameTemp.targetEvent();
			if (!target) return false;
			if (target.isAnimationPlaying() || !target.isStopping()) return true;
		} else if (this.skillWait() > 0) return true;

		return false;
	};

	// no moving during a skill!
	var _Game_Player_canMove = Game_Player.prototype.canMove;
	Game_Player.prototype.canMove = function() {
		if ($gameSystem.isSRPGMode() && $gameSystem.isSubBattlePhase() === 'invoke_action') {
			return false;
		}
		return _Game_Player_canMove.call(this);
	};

	// no pausing, either!
	var _updateCallMenu = Scene_Map.prototype.updateCallMenu;
	Scene_Map.prototype.updateCallMenu = function() {
		if ($gameSystem.isSRPGMode() && $gameSystem.isSubBattlePhase() === 'invoke_action') {
			this.menuCalling = false;
			return;
		}
		_updateCallMenu.call(this);
	};

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
			phase: 'start',
			count: action.numRepeats() + action.item()._srpgRepeats,
		};
		if (addToFront) this._srpgSkillList.unshift(data);
		else this._srpgSkillList.push(data);
	};

	// build the counter attack
	Scene_Map.prototype.srpgAddCounterAttack = function(user, target) {
		target.srpgMakeNewActions();
		target.action(0).setSubject(target);
		target.action(0).setAttack();
		this.srpgAddMapSkill(target.action(0), target, user, true);
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

		switch (data.phase) {
			// skill cost and casting animations
			case 'start':
				if (!user.canMove() || !user.canUse(action.item())) {
					data.phase = 'cancel';
					this._srpgSkillList.unshift(data);
					break;
				}
				user.useItem(action.item());
				if (!$gameTemp.isFirstAction || $gameTemp.isFirstAction()) {
					var castAnim = false;
					// cast animation, is a skill, isn't an attack or guard
					if (action.item().castAnimation && action.isSkill() && !action.isAttack() && !action.isGuard()) {
						user.event().requestAnimation(action.item().castAnimation);
						castAnim = true;
					}
					// target animation
					if (action.item().meta.targetAnimation) {
						$gamePlayer.requestAnimation(Number(action.item().meta.targetAnimation));
						castAnim = true;
					}
					// directional target animation
					if (action.item().meta.directionalAnimation) {
						var dir = user.event().direction()/2 - 1;
						$gamePlayer.requestAnimation(dir + Number(action.item().meta.directionalAnimation));
						castAnim = true;
					}
				}
				// check for reflection
				if (user != target && Math.random() < action.itemMrf(target)) {
					data.phase = 'reflect';
				} else {
					data.phase = 'animation';
				}
				this._srpgSkillList.unshift(data);
				break;

			// reflected magic
			case 'reflect':
				target.performReflection();
				if (target.reflectAnimationId) {
					target.event().requestAnimation(target.reflectAnimationId());
				}
				data.target = user;
				data.phase = 'animation';
				this._srpgSkillList.unshift(data);
				break;

			// show skill animation
			case 'animation':
				var animation = action.item().animationId;
				if (animation < 0) animation = (user.isActor() ? user.attackAnimationId1() : user.attackAnimationId());
				target.event().requestAnimation(animation);
				data.phase = 'effect';
				this._srpgSkillList.unshift(data);
				// time-based delay
				var delay = _animDelay;
				if (action.item().meta.animationDelay) delay = Number(action.item().meta.animationDelay);
				if (delay >= 0) this.setSkillWait(delay);
				break;

			// apply skill effects
			case 'effect':
				// skill effect repeats
				data.count--;
				if (data.count > 0) {
					data.phase = 'animation';
				} else {
					data.phase = 'global';
				}
				this._srpgSkillList.unshift(data);
				this.resetSkillWait();

				// apply damage, or start counters
				if (user != target && Math.random() < action.itemCnt(target)) {
					target.performCounter();
					this.srpgAddCounterAttack(user, target);
				} else {
					action.apply(target);
				}
				break;

			// run the common events and such
			case 'global':
				action.applyGlobal();
				data.phase = 'end';
				this._srpgSkillList.unshift(data);
				break;

			// clean up at the end
			case 'cancel':
			case 'end':
				user.setLastTarget(target);
				user.removeCurrentAction();
				user.onAllActionsEnd();
				break;
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

	// properly initialize, even without a battler
	Window_SrpgBattleResult.prototype.initialize = function(battler) {
		var width = this.windowWidth();
		var height = this.windowHeight();
		var x = (Graphics.boxWidth - width) / 2;
		var y = Graphics.boxHeight / 2 - height;
		this.setBattler(battler);
		this._rewards = null;
		this._changeExp = 0;
		Window_Base.prototype.initialize.call(this, x, y, width, height);
	};

	// update the battler between showings of the window
	Window_SrpgBattleResult.prototype.setBattler = function(battler) {
		this._battler = battler;
		if (battler) {
			this._reserveExp = this._battler.currentExp();
			this._level = this._battler.level;
		} else {
			this._reserveExp = 0;
			this._level = 0;
		}
	};

	// put a results window in the scene
	var _scene_map_createAllWindows = Scene_Map.prototype.createAllWindows;
	Scene_Map.prototype.createAllWindows = function() {
		_scene_map_createAllWindows.call(this);
		this.createSrpgBattleResultWindow();
	};
	Scene_Map.prototype.createSrpgBattleResultWindow = function() {
		this._srpgBattleResultWindow = new Window_SrpgBattleResult($gameParty.battleMembers()[0]);
		this._srpgBattleResultWindow.openness = 0;
		this.addWindow(this._srpgBattleResultWindow);
	};

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
				this._srpgBattleResultWindow.setBattler($gameParty.battleMembers()[0]);
				this._srpgBattleResultWindow.setRewards(this._rewards);
				var se = {};
				se.name = _rewardSe;
				se.pan = 0;
				se.pitch = 100;
				se.volume = 90;
				AudioManager.playSe(se);
				this._srpgBattleResultWindow.open();
				this.gainRewards();
				return true;
			}
			return false;
		}
	};

//====================================================================
// show popups for tile and status damage
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

	// track intended repeats from before BattleEngineCore
	if (DataManager.addActionEffects) {
		var _addActionEffects = DataManager.addActionEffects;
		DataManager.addActionEffects = function(obj, array) {
			var initialRepeats = obj.repeats;
			_addActionEffects.call(this, obj, array);
			obj._srpgRepeats = initialRepeats - obj.repeats;
		};
	}

})();