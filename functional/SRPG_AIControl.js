//-----------------------------------------------------------------------------
// copyright 2020 Doktor_Q all rights reserved.
// Released under the MIT license.
// http://opensource.org/licenses/mit-license.php
//=============================================================================

/*:
 * @plugindesc SRPG advanced AI (v0.9)
 * @author Dr. Q
 * 
 * @param Target Formula
 * @desc Default formula for picking a target
 * The one with the highest value is chosen
 * @default 1
 * 
 * @param Move Formula
 * @desc Default formula for choosing where to move
 * @default nearestOpponent
 * 
 * @help
 * This plugin is a work in progress!
 *
 * Requires SRPG_RangeControl, place this plugin below it.
 * If you are using SRPG_AoE and/or SRPG_PositionEffects, place this plugin
 * below those as well.
 *
 * Allows the AI to utilize anyTarget and AoE skills, and gives you more control
 * over the behaviors of individual units
 *
 * The formulas in this plugin are meant for advanced users with some knowledge
 * of javascript.
 *
 * New skill tags:
 * <aiAvoidFriend>      avoids targeting allied units
 * <aiAvoidOpponent>    avoids targeting enemy units
 * <aiIgnoreFriend>     ignores allied units
 * <aiIgnoreOpponent>   ignores enemy units
 * <aiIgnoreAiming>     ignores aimingActor and aimingEvent
 * <aiTarget: formula>  custom Target Formula for this skill
 * <aiMove: formula>    custom Move Formula when self-targeting this skill
 * 
 * New actor, class, and enemy tags:
 * <aiTarget: formula>  default Target Formula for this unit
 * <aiMove: formula>    default Move Formula for this unit
 *
 * New actor, class, enemy, weapon, armor, skill, and state tag:
 * <aiIgnore>           this unit is completely invisible to AI units
 *
 * Unlike setting a unit's Target Rate to 0, <aiIgnore> bypasses the
 * <aimingEvent:X> and <aimingActor:X> tags, and also nearestFriend,
 * nearestOpponent, mostFriends, and mostOpponents values in Move
 * Formulas.
 *
 * ------------------------
 * TARGET FORMULAS
 * ------------------------
 *
 * After choosing a skill the AI will examine all possible targets within range,
 * from all possible positions, and select the one with the highest Target Score.
 * Targets with a score of 0 or less are ignored.
 *
 * Target Score is calculated by multiplying the result of the Target Formula by
 * the Target Rate (tgr) stat. If a unit has a target rate of 0% it will be the
 * ignored by allies and enemies alike.
 *
 * AoE skills combine the score of all targets in the area, so they usually
 * choose the option that hits the most targets.
 *
 * If you use the <avoidFriends> or <avoidOpponents> notetags on the skill, it
 * will treat those units' scores as negative, while the <ignore_> versions treat
 * their scores as 0. The difference matters for AoE skills that can affect both
 * teams.
 * An AoE that hits two opponents and one friend would have the score of
 * opponent A + opponent B - friend A.
 *
 * In addition to the default formula in the plugin parameters, you can add
 * a default formula to a class, actor, or enemy, or have a formula specific
 * to that skill.
 *
 * If you use <mode:aimingActor> or <mode:aimingEvent>, then the specified
 * target will take priority over all other targets whenever it is valid.
 *
 * The following values can be used in target formulas:
 * s[n]         value of switch n
 * v[n]         value of variable n
 * user         the user of the skill
 * target       the target of the skill being evaluated
 * a            (same as user)
 * b            (same as target)
 * item         the skill being used
 * distance     distance moved to the destination
 * region       region ID of the destination space
 * terrain      terrain tag of the destination space
 * tag          (same as terrain)
 * damageFloor  = 1 if the destination space is a damage floor
 * range        distance from the destination to the target
 * face         'front' 'back' or 'side', which side of the target the skill hits
 *
 * Examples:
 *
 * <aiTarget: 4 * a.atk - 2 * b.def> chooses the target who takes the most
 * damage from the default damage formula, ignoring targets who take no damage.
 *
 * <aiTarget: a.hp - b.atk> chooses the target with the lowest attack, ignoring
 * targets whose attack is more than your current health.
 *
 * <aiTarget: 1-b.hpRate()> chooses the target with the lowest HP %, ignoring
 * anyone who is unhurt. This is especially useful on healing skills
 *
 * <aiTarget: (face == 'back ? 2 : 1)> chooses targets it can hit from behind
 * whenever possible.
 *
 * <aiTarget: range> chooses the target it can hit at the furthest range.
 *
 * ------------------------
 * MOVE FORMULAS
 * ------------------------
 *
 * If the AI has a target, it moves to the best
 *
 * However, if the AI isn't using an action, can't find any targets, or if the
 * action is targeting itself, the AI will use the Move Formula to decide where
 * it should go.
 *
 * The AI will check every unoccupied position within movement range, including
 * its current position, and move to the one with the highest (or least
 * negative) score. If multiple positions have the same score, it will choose
 * the closest one.
 *
 * In addition to the default formula in the plugin parameters, you can add a
 * default formula to a class, actor, or enemy.
 *
 * Move formulas specified on the skill are only used if the skill is targeting
 * user- for example, fleeing while healing, or moving to allies when guarding.
 *
 * If you use an any of the <mode:> tags on an event, it will override the unit's
 * default Move Formula. Refer to SRPG_core for the list of modes.
 *
 * The following values can be used in move formulas:
 * s[n]              value of switch n
 * v[n]              value of variable n
 * user              the unit who is moving
 * a                 (same as user)
 * distance          distance moved
 * region            region ID of the destination
 * terrain           terrain tag of the destination
 * tag               (same as terrain)
 * damageFloor       = 1 if the destination is a damage floor
 * nearestFriend     distance to nearest friend (negative)
 * nearestOpponent   distance to nearest opponent (negative)
 * nearestUnitEvent  distance to nearest unitEvent (negative)
 * mostFriends       combined distance to all friends (negative)
 * mostOpponents     combined distance to all opponents (negative)
 *
 * Examples:
 *
 * <aiMove: nearestOpponent> will move toward the nearest opponent unit
 *
 * <aiMove: nearestOpponent - damageFloor*2> will move toward the nearest
 * opponent, but will stop upt to 2 space early to avoid damage floors
 *
 * <aiMove: mostOpponents> will move toward the largest group of opponents, but
 * wanders a bit if they are too spread out
 *
 * <aiMove: a.hpRate() > 0.5 ? nearestOpponent : mostFriends> will approach the
 * enemy while HP is above 50%, but run to safety when wounded
 *
 * <aiMove: region> will move to the space with the highest region. If there
 * isn't a higher region, it will simply stand still.
 *
 * <aiMove: -region> is the same, but moves to the lowest region.
 */

(function(){

	var parameters = PluginManager.parameters('SRPG_AIControl');
	var _targetFormula = parameters['Target Formula'] || '1';
	var _moveFormula = parameters['Move Formula'] || 'nearestOpponent';

	var coreParameters = PluginManager.parameters('SRPG_core');

//====================================================================
// Utility functions
//====================================================================

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

		// account for looping maps
		if ($gameMap.isLoopHorizontal()) dx = Math.min(dx, $gameMap.width() - dx);
		if ($gameMap.isLoopVertical()) dy = Math.min(dy, $gameMap.height() - dy);
		
		return  dx + dy;
	};

//====================================================================
// Store target position for AI movement
//====================================================================

	Game_Temp.prototype.setAIPos = function(pos) {
		this._aiPos = pos;
	};

	Game_Temp.prototype.clearAIPos = function() {
		this._aiPos = null;
	};

	Game_Temp.prototype.AIPos = function() {
		return this._aiPos || null;
	};

//====================================================================
// New decision-making functions
//====================================================================

	// enemy commands
	Scene_Map.prototype.srpgInvokeEnemyCommand = function() {
		// select unit
		if (!this.srpgGetAIUnit('enemy')) {
			$gameSystem.srpgTurnEnd();
			return;
		}

		// select action
		if (this.srpgAICommand()) {
			$gameTemp.setAutoMoveDestinationValid(true);
			$gameTemp.setAutoMoveDestination($gameTemp.activeEvent().posX(), $gameTemp.activeEvent().posY());
			$gameSystem.setSubBattlePhase('enemy_move');
		} else {
			this.srpgAfterAction();
		}
	};

	// auto-actor command
	Scene_Map.prototype.srpgInvokeAutoActorCommand = function() {
		// select unit
		if (!this.srpgGetAIUnit('actor')) {
			$gameSystem.srpgStartEnemyTurn();
			return;
		}
		// select action
		if (this.srpgAICommand()) {
			$gameTemp.setAutoMoveDestinationValid(true);
			$gameTemp.setAutoMoveDestination($gameTemp.activeEvent().posX(), $gameTemp.activeEvent().posY());
			$gameSystem.setSubBattlePhase('auto_actor_move');
		} else {
			this.srpgAfterAction();
		}
	};

	// enemy movement
	Scene_Map.prototype.srpgInvokeEnemyMove = function() {
		if (!$gamePlayer.isStopping()) return;

		// path to destination
		var pos = $gameTemp.AIPos();
		if (pos) {
			var route = $gameTemp.MoveTable(pos.x, pos.y)[1];
			$gameSystem.setSrpgWaitMoving(true);
			$gameTemp.activeEvent().srpgMoveRouteForce(route);
		}
		$gameSystem.setSubBattlePhase('enemy_action');
	};

	// auto-actor movement
	Scene_Map.prototype.srpgInvokeAutoActorMove = function() {
		if (!$gamePlayer.isStopping()) return;

		// path to destination
		var route = $gameTemp.MoveTable(pos.x, pos.y)[1];
		if (route) {
			$gameSystem.setSrpgWaitMoving(true);
			$gameTemp.activeEvent().srpgMoveRouteForce(route);
		}
		$gameSystem.setSubBattlePhase('auto_actor_action');
	};

	// standardize the APIs for choosing actions
	Game_Actor.prototype.makeSrpgActions = function() {
		this.makeActions();
		if (this.isConfused()) {
			this.makeConfusionActions();
		}
	};


//====================================================================
// Primary AI logic
//====================================================================

	// find an AI unit
	Scene_Map.prototype.srpgGetAIUnit = function(type) {
		var selection = null;
		$gameMap.events().some(function (event) {
			if (event && !event.isErased() && event.isType() === type) {
				var unit = $gameSystem.EventToUnit(event.eventId())[1];
				if (unit && unit.canMove() && !unit.srpgTurnEnd()) {
					selection = event;
					return true;
				}
			}
			return false;
		});

		if (!selection) return false;
		$gameTemp.setActiveEvent(selection);
		return true;
	};

	// decide a unit's action, target, and movement
	Scene_Map.prototype.srpgAICommand = function() {
		var event = $gameTemp.activeEvent();
		var user = $gameSystem.EventToUnit(event.eventId())[1];
		if (!event || !user) return false;

		// choose action and target
		user.makeSrpgActions();
		$gameSystem.srpgMakeMoveTable(event);
		$gameTemp.clearAIPos();
		var target = this.srpgAITarget(user, event, user.action(0));

		// standing units skip their turn entirely
		var user = $gameSystem.EventToUnit(event.eventId())[1];
		if (user.battleMode() === 'stand') {
			if (target || user.hpRate() < 1.0) {
				user.setBattleMode('normal');
			} else {
				$gameTemp.clearMoveTable();
				user.onAllActionsEnd();
				return false;
			}
		}

		// decide movement (if not decided by target)
		if (!$gameTemp.AIPos()) {
			this.srpgAIPosition(user, event);
		}

		return true;
	};

//====================================================================
// Target-finding
//====================================================================

	// decide what target to go after
	Scene_Map.prototype.srpgAITarget = function(user, event, action) {

		// no action, no target
		if (!user || !event || !action) return false;

		// self-only targeting
		if (user.srpgSkillRange(action.item()) <= 0) {
			if (action.isForFriend()) {
				$gameTemp.setTargetEvent(event);
				if (action.item().meta.notUseAfterMove) { // can't move, set the position
					$gameTemp.setAIPos({x: event.posX(), y: event.posY()});
				}
				return true;
			}
			return false;
		}

		// notetag to ignore priority targets
		if (action.item().meta.aiIgnoreAiming || user.confusionLevel() > 0) {
			$gameTemp.setSrpgPriorityTarget(null);
		} else {
			this.srpgPriorityTarget(user);
		}

		var bestScore = 0;
		var bestPriority = false;
		var bestTarget = null;
		var bestPos = null;
		$gameMap.events().forEach(function(target) {
			if (target && $gameTemp.RangeTable(target.posX(), target.posY())[0] >= 0) {
				var posList = $gameTemp.RangeMoveTable(target.posX(), target.posY());
				for (var i = 0; i < posList.length; i++) {
					var pos = posList[i];
					var priority = false;
					var score = target.targetScore(user, action, pos);

					// check priority target
					if (score >= 0 && $gameTemp.isSrpgPriorityTarget() == target) {
						priority = true;
					}

					// evaluate AoEs
					if (!isNaN(score) && action.area && action.area() > 0) {
						var x = target.posX();
						var y = target.posY();
						var r = action.area();
						var t = action.areaType();
						var d = target.dirTo(pos.x, pos.y);
						score = $gameMap.events().reduce(function(value, areaTarget) {
							if (areaTarget && areaTarget != target && areaTarget.inArea(x, y, r, t, d)) {
								var bonus = areaTarget.targetScore(user, action, pos);
								if (!isNaN(bonus)) {
									value += bonus;
									if (bonus > 0 && areaTarget == $gameTemp.isSrpgPriorityTarget()) {
										priority = true;
									}
								}
							}
							return value;
						}, score);
					}

					// pick the best target
					if ((priority && !bestPriority) ||
					(score > bestScore && priority == bestPriority)) {
						bestScore = score;
						bestPriority = priority;
						bestTarget = target;
						bestPos = pos;
					}
				}
			}
		});

		// best target
		$gameTemp.setTargetEvent(bestTarget);
		$gameTemp.setAIPos(bestPos);
		return !!bestTarget;
	};

	// get the unit's target score
	Game_CharacterBase.prototype.targetScore = function(user, action, pos) {
		if (this.isErased()) return 0;
		var unitAry = $gameSystem.EventToUnit(this.eventId());
		if (!unitAry) return 0;

		// ignored by AI
		if (unitAry[1].priorityTag('aiIgnore')) return 0;

		// initial scoring
		var score = unitAry[1].tgr;

		// invalid or avoided targets
		if (user.confusionLevel() != 2) {
			if ((unitAry[1].isActor() == user.isActor()) == (user.confusionLevel() < 3)) {
				if (!action.isForFriend() || action.ignoreFriend()) score = 0;
				else if (action.avoidFriend()) score = -score;
			} else {
				if (!action.isForOpponent() || action.ignoreOpponent()) score = 0;
				else if (action.avoidOpponent()) score = -score;
			}
		}

		// don't bother evaluating the rest
		if (score == 0) return 0;

		// stats and switches
		var s = $gameSwitches._data;
		var v = $gameVariables._data;
		var target = unitAry[1];
		var a = user;
		var b = target;
		var item = action.item();

		// TODO: Figure out what needs to be set up for the prediction to work
		//var value = Math.abs(Math.max(b.hp-b.mhp, action.srpgPredictionDamage(b)));

		// positional values
		var _x = pos.x;
		var _y = pos.y;
		var _d = this.dirTo(_x, _y);

		var range = this.distTo(_x, _y);
		var distance = $gameTemp.MoveTable(_x, _y)[1].length - 1;
		var face = this.direction() === _d ? 'front' : this.direction() === 10-_d ? 'back' : 'side';
		var damageFloor = $gameMap.isDamageFloor(_x, _y) ? 1 : 0;
		var region = $gameMap.regionId(_x, _y) || 0;
		var terrain = $gameMap.terrainTag(_x, _y) || 0;
		var tag = terrain;

		// apply the formula
		if (item.meta.aiTarget) {
			score *= eval(item.meta.aiTarget);
		} else if (user.isActor() && user.currentClass().meta.aiTarget) {
			score *= eval(user.currentClass().meta.aiTarget);
		} else if (user.isActor() && user.actor().meta.aiTarget) {
			score *= eval(user.actor().meta.aiTarget);
		} else if (user.isEnemy() && user.enemy().meta.aiTarget) {
			score *= eval(user.enemy().meta.aiTarget);
		} else {
			score *= eval(_targetFormula);
		}
		return Number(score);
	};

	// Check if the AI should avoid targeting friends
	Game_Action.prototype.avoidFriend = function() {
		return (this.item() && this.item().meta.aiAvoidFriend);
	};
	Game_Action.prototype.ignoreFriend = function() {
		return (this.item() && this.item().meta.aiIgnoreFriend);
	};
	// Check if the AI should avoid targeting opponents
	Game_Action.prototype.avoidOpponent = function() {
		return (this.item() && this.item().meta.aiAvoidOpponent);
	};
	Game_Action.prototype.ignoreOpponent = function() {
		return (this.item() && this.item().meta.aiIgnoreOpponent);
	};


//====================================================================
// Position-finding
//====================================================================

	// find the optimal position without a target
	Scene_Map.prototype.srpgAIPosition = function(user, event) {
		var bestX = event.posX();
		var bestY = event.posY();
		var bestScore = event.positionScore(event.posX(), event.posY(), user);

		// notetag to ignore priority targets
		if (user.confusionLevel() > 0) {
			$gameTemp.setSrpgPriorityTarget(null);
		} else {
			this.srpgPriorityTarget(user);
		}

		$gameTemp.moveList().forEach(function (pos) {
			if (pos[2] == 1) return; // ignore range entries if found
			var x = pos[0];
			var y = pos[1];
			var score = event.positionScore(x, y, user);

			if (score > bestScore) {
				bestX = x;
				bestY = y;
				bestScore = score;
			}
		});
		$gameTemp.setAIPos({x: bestX, y: bestY});
	};

	// determine the strategic value of a position on the map
	Game_CharacterBase.prototype.positionScore = function(x, y, user) {
		var event = this;
		var _confusion = user.confusionLevel();

		var _maxDist = 1 + $gameMap.width() + $gameMap.height();
		var nearestFriend = -_maxDist;
		var nearestOpponent = -_maxDist;
		var nearestUnitEvent = -_maxDist;
		var mostFriends = 0;
		var mostOpponents = 0;

		// find nearby units
		var occupied = $gameMap.events().some(function(otherEvent) {
			if (otherEvent !== event && !otherEvent.isErased()) {
				// ignore occupied spaces
				if (otherEvent.pos(x, y) && ['enemy', 'actor', 'playerEvent'].contains(otherEvent.isType())) {
					return true;
				}

				// ignored units
				var unitAry = $gameSystem.EventToUnit(otherEvent.eventId());
				if (unitAry && unitAry[1] && unitAry[1].priorityTag('aiIgnore')) return false;

				// track distance to nearest units
				var dist = -otherEvent.distTo(x, y);
				if (otherEvent.isType() == event.isType()) {
					if (_confusion < 3) {
						nearestFriend = Math.max(dist, nearestFriend);
						mostFriends += dist;
					}
					if (_confusion > 1) {
						nearestOpponent = Math.max(dist, nearestOpponent);
						mostOpponents += dist;
					}
				} else if (['enemy', 'actor'].contains(otherEvent.isType())) {
					if (_confusion < 3) {
						nearestOpponent = Math.max(dist, nearestOpponent);
						mostOpponents += dist;
					}
					if (_confusion > 1) {
						nearestFriend = Math.max(dist, nearestFriend);
						mostFriends += dist;
					}
				} else if (otherEvent.isType() === 'unitEvent') {
					nearestUnitEvent = Math.max(dist, nearestUnitEvent);
				}
			}
			return false;
		});
		if (occupied) return Number.NEGATIVE_INFINITY;

		// general info
		var s = $gameSwitches._data;
		var v = $gameVariables._data;
		var a = user;
		var distance = $gameTemp.MoveTable(x, y)[1].length - 1;
		var damageFloor = $gameMap.isDamageFloor(x, y) ? 1 : 0;
		var region = $gameMap.regionId(x, y) || 0;
		var terrain = $gameMap.terrainTag(x, y) || 0;
		var tag = terrain;

		// self-target skill move formula
		if (this == $gameTemp.targetEvent() && user.action(0) && user.action(0).item().meta.aiMove) {
			return eval(user.action(0).item().meta.aiMove);
		}

		// standard AI modes (TODO: This still needs some work?)
		if (user.battleMode() === 'stand') {
			return 0; // no movement
		} else if (user.battleMode() === 'regionUp' || user.battleMode() === 'absRegionUp') {
			return region; // higher region
		} else if (user.battleMode() === 'regionDown' || user.battleMode() === 'absRegionDown') {
			return -region; // lower region
		} else if (user.battleMode() === 'aimingEvent' || user.battleMode() === 'aimingActor') {
			// priority target
			if ($gameTemp.isSrpgPriorityTarget() && !$gameTemp.isSrpgPriorityTarget().isErased()) {
				var priorityUnit = $gameSystem.EventToUnit($gameTemp.isSrpgPriorityTarget().eventId());
				if (!priorityUnit || !priorityUnit[1].priorityTag('aiIgnore')) {
					return -$gameTemp.isSrpgPriorityTarget().distTo(x, y);
				}
			}
		}

		// formulas coming from actor / class / enemy
		if (user.isActor() && user.currentClass().meta.aiMove) {
			return eval(user.currentClass().meta.aiMove);
		} else if (user.isActor() && user.actor().meta.aiMove) {
			return eval(user.actor().meta.aiMove);
		} else if (user.isEnemy() && user.enemy().meta.aiMove) {
			return eval(user.enemy().meta.aiMove);
		}

		// default formula
		return eval(_moveFormula);
	};

})();