//-----------------------------------------------------------------------------
// copyright 2019 Doktor_Q all rights reserved.
// Released under the MIT license.
// http://opensource.org/licenses/mit-license.php
//=============================================================================

/*:
 * @plugindesc SRPG animate units on the map
 * @author Dr. Q
 *
 * @param Default Motions
 *
 * @param Selected
 * @parent Default Motions
 * @type text
 * @desc Motion played by the active unit
 *
 * @param Attack
 * @parent Default Motions
 * @type text
 * @desc Default motion when using Attack
 *
 * @param Guard
 * @parent Default Motions
 * @type text
 * @desc Default motion when using Guard
 *
 * @param Physical Skill
 * @parent Default Motions
 * @type text
 * @desc Default motion when using a physical skill
 *
 * @param Magical Skill
 * @parent Default Motions
 * @parent Default Motions
 * @type text
 * @desc Default motion when using a magical skill
 *
 * @param Certain Hit Skill
 * @parent Default Motions
 * @type text
 * @desc Default motion when using a certain hit skill
 *
 * @param Use Item
 * @parent Default Motions
 * @type text
 * @desc Default motion when using an item
 *
 * @param Damage
 * @parent Default Motions
 * @type text
 * @desc Motion when taking damage
 *
 * @param Evade
 * @parent Default Motions
 * @type text
 * @desc Motion when evading
 *
 *
 * @param Screen Shake
 * @desc Shake screen when dealing damage
 * @type boolean
 * @on ON
 * @off OFF
 * @default true
 *
 * @param Power
 * @parent Screen Shake
 * @type string
 * @default 1+damage/50
 *
 * @param Speed
 * @parent Screen Shake
 * @type string
 * @default critical ? 6 : 4
 *
 * @param Duration
 * @parent Screen Shake
 * @type string
 * @default 10
 *
 *
 * @help
 * Integration between SRPG_MapAttack and DRQ_EventMotions, adds default
 * motions to specific actions in SRPG combat, such as using skills or taking
 * damage.
 *
 * It also lets you configure a screen shake on dealing damage, for more impact.
 * All three parameters are formulas, and you can use the following variables;
 * "damage" is the raw damage dealt to the subject
 * "critical" is true if the effect was a critical hit
 * "damageRate" is damage / subject's max health, for scaling impact
 * 
 * Actor notetags:
 * <srpgBattleSuffix:X>  add a suffix to the actor's sprite name in battle
 * <srpgBattleIndex:X>   change the actor's sprite index in battle
 * 
 * Actor, Class, Enemy, Weapon, Armor, and State notetag:
 * <noMotions>  this character will not play new motions
 * 
 * Weapon notetag:
 * <srpgAttackMotion:X>  use motion 'X' for the wielder's Attack
 * 
 * Skill / Item notetag:
 * <srpgMotion:X>         use motion 'X' for the skill / item
 * <useSrpgAttackMotion>  use the character's default attack motion for the skill
 * <srpgCastMotion:X>     use motion 'X' before skill / item executes
 */

(function(){

	var parameters = PluginManager.parameters('SRPG_MapAttack_Motions');
	var _default = {};
	_default.selected = parameters['Selected'];
	_default.attack = parameters['Attack'];
	_default.physical = parameters['Physical Skill'];
	_default.magical = parameters['Magical Skill'];
	_default.certain = parameters['Certain Hit Skill'];
	_default.item = parameters['Use Item'];
	_default.damage = parameters['Damage'];
	_default.evade = parameters['Evade'];

	var _shake = !!eval(parameters['Screen Shake']);
	var _shakePower = parameters['Power'];
	var _shakeSpeed = parameters['Speed'];
	var _shakeFrames = parameters['Duration'];

//====================================================================
// Custom in-battle sprites for actors
//====================================================================

	// actors can have different sprites for in-combat
	var _refreshImage = Game_Event.prototype.refreshImage;
	Game_Event.prototype.refreshImage = function() {
		if ($gameSystem.isSRPGMode() && !this.isErased()) {
			var battlerArray = $gameSystem.EventToUnit(this.eventId());
			if (battlerArray && battlerArray[0] == 'actor') {
				var actor = battlerArray[1];
				var suffix = actor.actor().meta.srpgBattleSuffix || '';
				var index = actor.actor().meta.srpgBattleIndex || actor.characterIndex();
				this.setImage(actor.characterName()+suffix, index);
				return;
			}
		}
		_refreshImage.call(this);
	};

//====================================================================
// Handle motions on the whole party at once
//====================================================================

	// check if anyone in the party is playing a motion
	Game_Party.prototype.hasMotion = function() {
		return this.members().some(function(actor) {
			var event = actor.event();
			return event ? event.hasMotion() : false;
		});
	};

	// check if anyone in the party is playing a looping motion
	Game_Party.prototype.hasLoopingMotion = function() {
		return this.members().some(function(actor) {
			var event = actor.event();
			return event ? event.hasLoopingMotion() : false;
		});
	};

	// check if anyone in the party is playing a non-looping motion
	Game_Party.prototype.hasSingleMotion = function() {
		return this.members().some(function(actor) {
			var event = actor.event();
			return event ? event.hasSingleMotion() : false;
		});
	};

	// run a preset motion on the entire party
	Game_Party.prototype.playMotion = function(motion, wait) {
		if (!motion) return;
		this.playCustomMotion(Sprite_Character.MOTIONS[motion.toUpperCase()], wait);
	};

	// run a motion defined on the fly on the entire party
	Game_Party.prototype.playCustomMotion = function(motionData, wait) {
		if (!$gameSystem.isSRPGMode()) return;
		this.members().forEach(function (actor) {
			var event = actor.event();
			if (!event || actor.noMotions()) return;
			event.playCustomMotion(motionData, wait);
		});
	};

	// clear the motions for the whole party
	Game_Party.prototype.ClearMotion = function() {
		this.members().forEach(function (actor) {
			var event = actor.event();
			if (event) event.clearMotion();
		});
	};

//====================================================================
// Integrate motions with combat
//====================================================================

	// get the motion for a basic attack
	Game_BattlerBase.prototype.attackMotion = function() {
		return _default.attack;
	};
	Game_Actor.prototype.attackMotion = function() {
		var motion = _default.attack
		this.weapons().forEach(function(weapon) {
			if (weapon && weapon.meta.srpgAttackMotion) motion = weapon.meta.srpgAttackMotion;
		});
		return motion;
	};
	Game_Enemy.prototype.attackMotion = function() {
		if (!this.hasNoWeapons()) {
			var weapon = $dataWeapons[this.enemy().meta.srpgWeapon];
			if (weapon && weapon.meta.srpgAttackMotion) return weapon.meta.srpgAttackMotion;
		}
		return _default.attack;
	};

	// play the motions for an action
	var _srpgInvokeMapSkill = Scene_Map.prototype.srpgInvokeMapSkill;
	Scene_Map.prototype.srpgInvokeMapSkill = function(data) {
		var action = data.action;
		var user = data.user;
		var event = user.event();
		if (event && !user.noMotions()) {
			if (data.count > 0 && data.count <= action.numRepeats()) {
				var motion = action.item().meta.srpgMotion;
				if (motion) event.playMotion(motion);
				else if (action.isAttack() || action.item().meta.useSrpgAttackMotion) event.playMotion(user.attackMotion());
				else if (action.isItem()) event.playMotion(_default.item);
				else if (action.isPhysical()) event.playMotion(_default.physical);
				else if (action.isMagical()) event.playMotion(_default.magical);
				else if (action.isCertainHit()) event.playMotion(_default.certain);
			} else if (data.count == 0) {
				var motion = action.item().meta.srpgCastMotion;
				if (motion) event.playMotion(motion);
			}
		}
		_srpgInvokeMapSkill.call(this, data);
	};

	// special damage effects
	var _srpgShowResults = Game_BattlerBase.prototype.srpgShowResults;
	Game_BattlerBase.prototype.srpgShowResults = function() {
		_srpgShowResults.call(this);
		var result = this.result();

		var event = this.event();
		if (event && !this.noMotions()) {
			if (result.isHit() && result.hpDamage > 0) event.playMotion(_default.damage);
			else if (result.missed || result.evaded) event.playMotion(_default.evade);
		}

		if (_shake && result.hpDamage > 0) {
			var damage = result.hpDamage;
			var damageRate = (damage / this.mhp);
			var critical = result.isCritical;

			var power = Math.floor(Number(eval(_shakePower)));
			var speed = Math.floor(Number(eval(_shakeSpeed)));
			var frames = Math.floor(Number(eval(_shakeFrames)));

			$gameScreen.startShake(power, speed, frames);
		}
	};

	// active event shows a running animation
	var _setActiveEvent = Game_Temp.prototype.setActiveEvent;
	Game_Temp.prototype.setActiveEvent = function(event) {
		var oldEvent = $gameTemp.activeEvent();
		_setActiveEvent.call(this, event);
		if (oldEvent) oldEvent.clearMotion();
		if ($gameSystem.EventToUnit(event.eventId())[1].noMotions()) return;
		event.playMotion(_default.selected);
	};
	var _clearActiveEvent = Game_Temp.prototype.clearActiveEvent;
	Game_Temp.prototype.clearActiveEvent = function() {
		var oldEvent = $gameTemp.activeEvent();
		_clearActiveEvent.call(this);
		if (oldEvent) oldEvent.clearMotion();
	};

	// clear motions when they finish their turn
	var _onAllActionsEnd = Game_Battler.prototype.onAllActionsEnd;
	Game_Battler.prototype.onAllActionsEnd = function() {
		_onAllActionsEnd.call(this);
		if ($gameSystem.isSRPGMode()) this.event().clearMotion();
	};

//====================================================================
// Ignore Motions
//====================================================================

	// check if a battler is immune to movement from states
	Game_BattlerBase.prototype.noMotions = function() {
		var Immovable = false;
		this.states().forEach(function(state) {
			if (state.meta.noMotions) {
				Immovable = true;
			}
		});
		return Immovable;
	};

	// check if an actor is immune to movement from class or equipment
	Game_Actor.prototype.noMotions = function() {
		if (this.actor().meta.noMotions) return true;
		if (this.currentClass().meta.noMotions) return true;

		var Immovable = false;
		this.equips().forEach(function(item) {
			if (item && item.meta.noMotions) {
				Immovable = true;
			}
		});

		return Immovable || Game_BattlerBase.prototype.noMotions.call(this);
	};

	// check if an enemy is immune to movement innately or from weapon
	Game_Enemy.prototype.noMotions = function() {
		if (this.enemy().meta.noMotions) return true;

		if (!this.hasNoWeapons()) {
			var weapon = $dataWeapons[this.enemy().meta.srpgWeapon];
			if (weapon && weapon.meta.noMotions) return true;
		}

		return Game_BattlerBase.prototype.noMotions.call(this);
	};

})();