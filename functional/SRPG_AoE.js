//-----------------------------------------------------------------------------
// copyright 2020 Doktor_Q all rights reserved.
// Released under the MIT license.
// http://opensource.org/licenses/mit-license.php
//=============================================================================

/*:
 * @plugindesc SRPG Area-of-effect skills
 * @author Dr. Q + アンチョビ
 * 
 * @param AoE Color
 * @desc CSS Color for AoE squares
 * https://www.w3schools.com/cssref/css_colors.asp
 * @type string
 * @default DarkOrange
 * 
 * @param Show One Square AoE
 * @desc Show AoE indicator for single target effects?
 * @type boolean
 * @on Show
 * @off Hide
 * @default false
 * 
 * @param Refocus Camera
 * @desc Move the camera to each target as it's hit
 * @type boolean
 * @on Move
 * @off Don't move
 * @default false
 * 
 * @help
 * Allows you to define an area of effect for attacks
 * Based on SRPG_AreaAttack.js by アンチョビ
 * 
 * When using an AoE skill, you can target an empty cell as long as there is at
 * least one valid target within the area
 * AI units won't make use of this, and will always try to target a unit
 * directly, catching other targets by coincidence
 * 
 * Skill / item notetags:
 * <srpgAreaRange:x> creates an AoE of size x
 * <srpgAreaType:y> changes the shape of the AoE
 * type defaults to 'circle' if not specified
 *
 * The following shapes are available, shown at a size of 2.
 *
 * circle: hits a circle around the target cell
 *      2
 *    2 1 2
 *  2 1 0 1 2
 *    2 1 2
 *      2
 *
 * square - hits a square around the target cell
 *  2 2 2 2 2
 *  2 1 1 1 2
 *  2 1 0 1 2
 *  2 1 1 1 2
 *  2 2 2 2 2
 *
 * line - hits a straight line behind of the target cell
 *
 *      0
 *      1
 *      2
 * (facing down)
 *
 * cone - hits a 90 degree cone behind the target cell
 *
 *
 *      0
 *    1 1 1
 *  2 2 2 2 2
 * (facing down)
 *
 * split - hits a v shape behind the target cell
 *
 *
 *      0
 *    1   1
 *  2       2
 * (facing down)
 *
 * arc - hits a v shape coming back from the target cell
 *  2       2
 *    1   1
 *      0
 *
 *
 * (facing down)
 *
 * side - hits a line to either side of the target cell
 *
 *
 *  2 1 0 1 2
 *
 *
 * (facing down)
 *
 * tee - hits behind and to the sides of the target
 *
 *
 *  2 1 0 1 2
 *      1
 *      2
 * (facing down)
 *
 * plus - hits a + shape around the target cell
 *      2
 *      1
 *  2 1 0 1 2
 *      1
 *      2
 *
 * cross - hits an x shape around the target cell
 *  2       2
 *    1   1
 *      0
 *    1   1
 *  2       2
 */

(function(){

	var parameters = PluginManager.parameters('SRPG_AoE');
	var _oneSquare = !!eval(parameters['Show One Square AoE']);
	var _areaColor = parameters['AoE Color'];
	var _refocus = parameters['Refocus Camera'];

	var coreParameters = PluginManager.parameters('SRPG_core');
	var _srpgPredictionWindowMode = Number(coreParameters['srpgPredictionWindowMode'] || 1);

//====================================================================
// Function names from SRPG_AreaAttack.js, for compativility
//====================================================================

	Game_Temp.prototype.isFirstAction = function() {
		return this.shouldPayCost();
	};
	Game_BattlerBase.prototype.srpgSkillAreaRange = function(item) {
		return Number(item.meta.srpgAreaRange);
	};

//====================================================================
// Get AoE data for the skill
//====================================================================

	// get AoE properties
	Game_Action.prototype.area = function() {
		if (this.item()) return Number(this.item().meta.srpgAreaRange) || 0;
		return 0;
	};
	Game_Action.prototype.areaType = function() {
		var type = '';
		if (this.item()) type = this.item().meta.srpgAreaType || '';
		type = type.toLowerCase();
		return type;
	};

	// (utility) find the direction to a fixed point, discounting obstacles
	Game_Character.prototype.dirTo = function(x, y) {
		var dir = 5;
		var dx = this.posX() - x;
		var dy = this.posY() - y;

		// account for looping maps
		if ($gameMap.isLoopHorizontal()) {
			if (dx > $gameMap.width() / 2) dx -= $gameMap.width();
			if (dx < -$gameMap.width() / 2) dx += $gameMap.width();
		}
		if ($gameMap.isLoopVertical()) {
			if (dy > $gameMap.height() / 2) dy -= $gameMap.height();
			if (dy < -$gameMap.height() / 2) dy += $gameMap.height();
		}

		if (Math.abs(dx) > Math.abs(dy)) {
			dir = dx > 0 ? 4 : 6;
		} else if (dy !== 0) {
			dir = dy > 0 ? 8 : 2;
		}
		return dir;
	};

	// (utility) find the distance to a fixed point, discounting obstacles
	Game_Character.prototype.distTo = function(x, y) {
		var dx = Math.abs(this.posX() - x);
		var dy = Math.abs(this.posY() - y);

		if ($gameMap.isLoopHorizontal()) dx = Math.min(dx, $gameMap.width() - dx);
		if ($gameMap.isLoopVertical()) dy = Math.min(dy, $gameMap.height() - dy);
		
		return  dx + dy;
	};

	// (utility) checks if a position is within the current skill's range
	Game_System.prototype.positionInRange = function(x, y) {
		var range = $gameTemp.moveList();
		for (var i = 0; i < range.length; i++) {
			if (range[i][0] == x && range[i][1] == y) return true;
		}
		return false;
	};

//====================================================================
// Game_Temp (store lists of multiple targets)
//====================================================================

	var _Game_Temp_initialize = Game_Temp.prototype.initialize;
	Game_Temp.prototype.initialize = function() {
		_Game_Temp_initialize.call(this);
		this._activeAoE = null;
		this._areaTargets = [];
		this._shouldPaySkillCost = true;
	};

	// easy access to the origin of the AoE
	Game_Temp.prototype.areaX = function() {
		return this._activeAoE ? this._activeAoE.x : -1;
	};
	Game_Temp.prototype.areaY = function() {
		return this._activeAoE ? this._activeAoE.y : -1;
	};

	// check if an event is in the area of the current skill
	Game_Temp.prototype.inArea = function(event) {
		if (!this._activeAoE || this._activeAoE.size <= 0) return false;

		var dx = event.posX() - this._activeAoE.x;
		var dy = event.posY() - this._activeAoE.y;

		if ($gameMap.isLoopHorizontal()) {
			if (dx > $gameMap.width() / 2) dx -= $gameMap.width();
			if (dx < -$gameMap.width() / 2) dx += $gameMap.width();
		}
		if ($gameMap.isLoopVertical()) {
			if (dy > $gameMap.height() / 2) dy -= $gameMap.height();
			if (dy < -$gameMap.height() / 2) dy += $gameMap.height();
		}

		return $gameMap.inArea(dx, dy, this._activeAoE.size, this._activeAoE.shape, this._activeAoE.dir);
	};

	// to attack multiple targets, you queue up a target list
	Game_Temp.prototype.clearAreaTargets = function() {
		this._areaTargets = [];
	};
	Game_Temp.prototype.addAreaTarget = function(action) {
		this._areaTargets.push(action);
	};
	Game_Temp.prototype.areaTargets = function() {
		return this._areaTargets;
	};

	// when repeating actions, the cost is only paid once
	Game_Temp.prototype.setShouldPayCost = function(flag) {
		this._shouldPaySkillCost = flag;
	};
	Game_Temp.prototype.shouldPayCost = function() {
		return this._shouldPaySkillCost;
	};
	var _paySkillCost = Game_BattlerBase.prototype.paySkillCost;
	Game_BattlerBase.prototype.paySkillCost = function(skill) {
		if (!$gameSystem.isSRPGMode() || $gameTemp.shouldPayCost()) {
			_paySkillCost.call(this, skill);
		}
	};

//====================================================================
// Game_Character
//====================================================================

	// check if a character is within a specified AoE
	Game_Character.prototype.inArea = function(x, y, size, shape, dir) {
		if (size <= 0) return false; // one-square AoEs don't count as AoEs
		var dx = this.posX() - x;
		var dy = this.posY() - y;

		// account for looping maps
		if ($gameMap.isLoopHorizontal()) {
			if (dx > $gameMap.width() / 2) dx -= $gameMap.width();
			if (dx < -$gameMap.width() / 2) dx += $gameMap.width();
		}
		if ($gameMap.isLoopVertical()) {
			if (dy > $gameMap.height() / 2) dy -= $gameMap.height();
			if (dy < -$gameMap.height() / 2) dy += $gameMap.height();
		}
		return $gameMap.inArea(dx, dy, size, shape, dir);
	};

	// check if a given position is within an area
	Game_Map.prototype.inArea = function(dx, dy, size, shape, dir) {
		var fx = [0, -1, 0, 1, -1, 0, 1, -1, 0, 1][dir];
		var fy = [0, 1, 1, 1, 0, 0, 0, -1, -1, -1][dir];

		switch (shape) {
			case 'line':
				if (dx * fy != 0 || dy * fx != 0) return false;
				if (dx * fx < 0 || dy * fy < 0 || dx * fx > size || dy * fy > size) return false;
				return true;

			case 'cone':
				if (dx * fx < 0 || dy * fy < 0 || dx * fx > size || dy * fy > size) return false;
				if (Math.abs(dx*fy) > Math.abs(dy*fy) || Math.abs(dy*fx) > Math.abs(dx*fx)) return false;
				return true;

			case 'split':
				if (dx * fx < 0 || dy * fy < 0 || dx * fx > size || dy * fy > size) return false;
				if (Math.abs(dx) != Math.abs(dy)) return false;
				return true;

			case 'arc':
				if (dx * fx > 0 || dy * fy > 0 || dx * fx < -size || dy * fy < -size) return false;
				if (Math.abs(dx) != Math.abs(dy)) return false;
				return true;

			case 'side':
				if (dx * fx != 0 || dy * fy != 0) return false;
				if (Math.abs(dx * fy) > size || Math.abs(dy * fx) > size) return false;
				return true;

			case 'tee':
				if (dx != 0 && dy != 0) return false;
				if (dx * fx < 0 || dy * fy < 0 || Math.abs(dx) > size || Math.abs(dy) > size) return false;
				return true;

			case 'plus':
				if (dx != 0 && dy != 0) return false;
				if (Math.abs(dx) > size || Math.abs(dy) > size) return false;
				return true;

			case 'cross':
				if (Math.abs(dx) != Math.abs(dy) || Math.abs(dx) > size) return false;
				return true;

			case 'square':
				if (Math.abs(dx) > size || Math.abs(dy) > size) return false;
				return true;

			case 'circle':
			default: // circle is the default shape
				if (Math.abs(dx)+Math.abs(dy) > size) return false;
				return true;
		};
	};

//====================================================================
// Using AoE skills
//====================================================================

	// update the active AoE when you move the cursor
	var _startMapEvent = Game_Player.prototype.startMapEvent;
	Game_Player.prototype.startMapEvent = function(x, y, triggers, normal) {
		if ($gameSystem.isSRPGMode() && triggers.contains(1)) {
			if ($gameSystem.isSubBattlePhase() === 'actor_target' && $gameSystem.positionInRange(x, y)) {
				$gameTemp.showArea(x, y);
			} else if ($gameSystem.isSubBattlePhase() !== 'invoke_action' &&
			$gameSystem.isSubBattlePhase() !== 'battle_window') {
				$gameTemp.clearAoE();
			}
		}
		_startMapEvent.call(this, x, y, triggers, normal);
	};

	// show the AoE when you start targeting
	var _startActorTargetting = Scene_Map.prototype.startActorTargetting;
	Scene_Map.prototype.startActorTargetting = function() {
		_startActorTargetting.call(this);
		var x = $gamePlayer.posX();
		var y = $gamePlayer.posY();
		if ($gameSystem.positionInRange(x, y)) {
			$gameTemp.showArea(x, y);
		}
	};

	// clear the AoE when you cancel targeting
	var _updateCallMenu = Scene_Map.prototype.updateCallMenu;
	Scene_Map.prototype.updateCallMenu = function() {
		if ($gameSystem.isSRPGMode() && $gameSystem.isSubBattlePhase() === 'actor_target' &&
		(Input.isTriggered('cancel') || TouchInput.isCancelled())) {
			$gameTemp.clearAoE();
		}
		_updateCallMenu.call(this);
	};

	// highlight the area of effect for an AoE
	Game_Temp.prototype.showArea = function(x, y) {
		var unit = $gameTemp.activeEvent();
		var actor = $gameSystem.EventToUnit(unit.eventId())[1];
		if (!actor) return;
		var skill = actor.currentAction();
		if (!skill) return;
		var size = skill.area();
		var shape = skill.areaType();
		var dir = unit.dirTo(x, y);
		this._activeAoE = {
			x: x, 
			y: y,
			size: size,
			shape: shape,
			dir: dir
		};
	};

	// clear out the highlighted area
	Game_Temp.prototype.clearAoE = function() {
		this._activeAoE = null;
	};

	// AoE skills can select empty cells
	var _triggerAction = Game_Player.prototype.triggerAction;
	Game_Player.prototype.triggerAction = function() {
		if ($gameSystem.isSRPGMode() && $gameSystem.isSubBattlePhase() === 'actor_target') {
			if (Input.isTriggered('ok') || TouchInput.isTriggered()) {
				var userArray = $gameSystem.EventToUnit($gameTemp.activeEvent().eventId());
				var skill = userArray[1].currentAction();

				if ($gameTemp.selectArea(userArray[1], skill)) {
					SoundManager.playOk();

					var action = $gameTemp.areaTargets().shift();
					var targetArray = $gameSystem.EventToUnit(action.event.eventId());
					$gameTemp.setTargetEvent(action.event);
					$gameTemp.setSrpgDistance($gameSystem.unitDistance($gameTemp.activeEvent(), action.event));
					// special range isn't set, because the AoE will override it anyway

					$gameSystem.clearSrpgActorCommandStatusWindowNeedRefresh();
					if (_srpgPredictionWindowMode != 3) $gameSystem.setSrpgStatusWindowNeedRefresh(userArray);
					$gameSystem.setSrpgBattleWindowNeedRefresh(userArray, targetArray);
					$gameSystem.setSubBattlePhase('battle_window');
					return true;
				}
			}
		}
		return _triggerAction.call(this);
	};

	// Apply AoEs for auto units as well
	var _srpgInvokeAutoUnitAction = Scene_Map.prototype.srpgInvokeAutoUnitAction;
	Scene_Map.prototype.srpgInvokeAutoUnitAction = function() {
		var mainTarget = $gameTemp.targetEvent();
		if (mainTarget && $gameSystem.positionInRange(mainTarget.posX(), mainTarget.posY())) {
			var userArray = $gameSystem.EventToUnit($gameTemp.activeEvent().eventId());
			var skill = userArray[1].currentAction();
			if (skill.area() > 0) {
				$gameTemp.showArea(mainTarget.posX(), mainTarget.posY());
				$gameTemp.selectArea(userArray[1], skill, mainTarget);
			}
		}
		_srpgInvokeAutoUnitAction.call(this);
	};

	// Find all the targets within the current AoE
	Game_Temp.prototype.selectArea = function(user, skill, initialTarget) {
		this.clearAreaTargets();
		var friends = (user.isActor()) ? 'actor' : 'enemy';
		var opponents = (user.isActor()) ? 'enemy' : 'actor';

		// identify targets
		var targets = $gameMap.events().filter(function (event) {
			if (event.isErased() || event == initialTarget) return false;
			if ((event.isType() == friends && skill.isForFriend()) || 
			(event.isType() == opponents && skill.isForOpponent())) {
				return $gameTemp.inArea(event);
			}
		});

		// there are no targets!
		if (targets.length == 0 && !initialTarget) return false;

		// sort by distance
		targets = targets.sort(function (a, b) {
			var aDist = a.distTo($gameTemp.areaX(), $gameTemp.areaY());
			var bDist = b.distTo($gameTemp.areaX(), $gameTemp.areaY());
			return aDist - bDist;
		});

		// queue up actions on each target
		for (var i = 0; i < targets.length; i++) {
			var targetArray = $gameSystem.EventToUnit(targets[i].eventId());
			this.addAreaTarget({
				item: skill.item(),
				event: targets[i]
			});
		}
		return true;
	};

	// work through the queue of actions
	var _srpgAfterAction = Scene_Map.prototype.srpgAfterAction;
	Scene_Map.prototype.srpgAfterAction = function() {
		if ($gameTemp.areaTargets().length > 0) {
			this.srpgBattlerDeadAfterBattle();
			var actionArray = $gameSystem.EventToUnit($gameTemp.activeEvent().eventId());
			nextaction = $gameTemp.areaTargets().shift();
			actionArray[1].srpgMakeNewActions();
			actionArray[1].action(0).setItemObject(nextaction.item);
			var targetArray = $gameSystem.EventToUnit(nextaction.event.eventId());
			$gameTemp.setTargetEvent(nextaction.event);
			if (_refocus) {
				$gameTemp.setAutoMoveDestinationValid(true);
				$gameTemp.setAutoMoveDestination($gameTemp.targetEvent().posX(), $gameTemp.targetEvent().posY());
			}
			$gameTemp.setShouldPayCost(false);
			$gameSystem.setSubBattlePhase('invoke_action');
			this.srpgBattleStart(actionArray, targetArray);
		} else {
			$gameTemp.clearAoE();
			$gameTemp.setShouldPayCost(true);
			_srpgAfterAction.call(this);
		}
	};

	// AoE skills can be used as long as you're in the targeted area
	var _canUse = Game_BattlerBase.prototype.canUse;
	Game_BattlerBase.prototype.canUse = function(item) {
		if (item && $gameSystem.isSRPGMode() &&
		Number(item.meta.srpgAreaRange) > 0 && this._srpgActionTiming != 1) {
			if ($gameSystem.isSubBattlePhase() === 'invoke_action' ||
			$gameSystem.isSubBattlePhase() === 'auto_actor_action' ||
			$gameSystem.isSubBattlePhase() === 'enemy_action' ||
			$gameSystem.isSubBattlePhase() === 'battle_window') {
				return $gameTemp.inArea($gameTemp.targetEvent());
			}
		}
		return _canUse.call(this, item);
	};

//====================================================================
// Sprite_SrpgAoE
//====================================================================

	window.Sprite_SrpgAoE = function() {
		this.initialize.apply(this, arguments);
	};

	Sprite_SrpgAoE.prototype = Object.create(Sprite.prototype);
	Sprite_SrpgAoE.prototype.constructor = Sprite_SrpgAoE;

	Sprite_SrpgAoE.prototype.initialize = function() {
		Sprite.prototype.initialize.call(this);
		this.anchor.x = 0.5;
		this.anchor.y = 0.5;
		this._frameCount = 0;
		this._posX = -1;
		this._posY = -1;
		this.z = 0;
		this.visible = false;
	};

	Sprite_SrpgAoE.prototype.isActive = function() {
		return this._posX >= 0 && this._posY >= 0;
	};

	Sprite_SrpgAoE.prototype.update = function() {
		Sprite.prototype.update.call(this);
		if (this.isActive()){
			this.updatePosition();
			this.updateAnimation();
			this.visible = true;
		} else {
			this.visible = false;
		}
	};

	Sprite_SrpgAoE.prototype.setAoE = function(x, y, size, type, dir) {
		this._posX = x;
		this._posY = y;
		this.blendMode = Graphics.BLEND_ADD;

		if (this._size != size || this._type != type || this._dir != dir) {
			this._size = size;
			this._type = type;
			this._dir = dir;
			this.redrawArea(size, type, dir);
		}
	};

	Sprite_SrpgAoE.prototype.redrawArea = function(size, type, dir) {
		var tileWidth = $gameMap.tileWidth();
		var tileHeight = $gameMap.tileHeight();
		this.bitmap = new Bitmap(tileWidth*(1+size*2), tileHeight*(1+size*2));

		if (!_oneSquare && size <= 0) return;

		for (var x = 0; x < 1+size*2; x++) {
			for (var y = 0; y < 1+size*2; y++) {
				if ($gameMap.inArea(x-size, y-size, size, type, dir)) {
					this.drawCell(this.bitmap, x*tileWidth, y*tileHeight, tileWidth, tileHeight);
				}
			}
		}
	};

	Sprite_SrpgAoE.prototype.drawCell = function(bitmap, x, y, tileWidth, tileHeight) {
		bitmap.fillRect(x, y, tileWidth, tileHeight, _areaColor);
	};

	Sprite_SrpgAoE.prototype.clearAoE = function() {
		this._posX = -1;
		this._posY = -1;
	};

	Sprite_SrpgAoE.prototype.updatePosition = function() {
		var tileWidth = $gameMap.tileWidth();
		var tileHeight = $gameMap.tileHeight();
		this.x = ($gameMap.adjustX(this._posX) + 0.5) * tileWidth;
		this.y = ($gameMap.adjustY(this._posY) + 0.5) * tileHeight;
	};

	Sprite_SrpgAoE.prototype.updateAnimation = function() {
		this._frameCount++;
		this._frameCount %= 40;
		this.opacity = (40 - this._frameCount) * 3;
	};

//====================================================================
// Spriteset_Map
//====================================================================

	// add the AoE sprite to the list
	var _Spriteset_Map_createTilemap = Spriteset_Map.prototype.createTilemap;
	Spriteset_Map.prototype.createTilemap = function() {
		_Spriteset_Map_createTilemap.call(this);
		this._srpgAoE = new Sprite_SrpgAoE();
		this._tilemap.addChild(this._srpgAoE);
	};

	var _Spriteset_Map_update = Spriteset_Map.prototype.update;
	Spriteset_Map.prototype.update = function() {
		_Spriteset_Map_update.call(this);
		if ($gameSystem.isSRPGMode()) {
			this.updateSrpgAoE();
		}
	};

	// refresh the AoE sprite
	Spriteset_Map.prototype.updateSrpgAoE = function() {
		var aoe = $gameTemp._activeAoE;
		if (aoe) {
			this._srpgAoE.setAoE(aoe.x, aoe.y, aoe.size, aoe.shape, aoe.dir);
		} else {
			this._srpgAoE.clearAoE();
		}
	};

})();