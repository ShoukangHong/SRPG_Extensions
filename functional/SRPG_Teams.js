//-----------------------------------------------------------------------------
// copyright 2020 Doktor_Q all rights reserved.
// Released under the MIT license.
// http://opensource.org/licenses/mit-license.php
//=============================================================================

/*:
 * @plugindesc SRPG Create teams for battlers (v1.0)
 * @author Dr. Q
 *
 * @param Default Actor Team
 * @desc Default team for actors if none is specified
 * @default actor
 *
 * @param Default Enemy Team
 * @desc Default team for enemies if none is specified
 * @default enemy
 *
 * @help
 * Allows actors and enemies to be assigned to teams
 * /!\ Teams DO NOT automatically change AI behavior or skills /!\
 *
 * By checking teams in damage formulas or other plugins, such as SRPG_AIControl,
 * you can create more team-like behaviors, and by checking the size of each team
 * you can make more specific victory conditions, allowing for neutral entities
 * and non-standard "death" conditions, like petrification or permanent charm
 *
 * New actor, class, enemy, and state tag:
 * <srpgTeam:teamName>    changes the battler's team from the default
 *
 * New script calls:
 * a.srpgTeam()       returns the name of the a's team
 * a.sameTeam(b)      check if a and b are on the same team
 * $gameSystem.teamSize("teamName")  returns the current size of teamName
 *                                   only counts living actors and enemies
 * $gameSystem.teamIsDead("teamName") easily check if the team size is 0
 *
 * $gameSystem.teamSize() allows for more advanced win / loss conditions, such as:
 *
 * - $gameSystem.teamIsDead("enemy") tells you when no enemies are left, but
 *   excludes surviving "neutral" enemies (NPCs, breakable objects, etc).
 *
 * - $gameSystem.teamIsDead("actor") tells you when no actors are left, but
 *   excludes technically-alive actors with a "stone" team, applied by a petrify
 *   state that doesn't wear off on its own, counting them as defeated.
 *
 * - A charm status that never expires could change an enemy's team to "traitor," so
 *   they don't have to be killed for the battle to end.
 *
 * - $gameSystem.teamIsDead("crystal") tells you when all battlers on the "crystal"
 *   team are defeated, regardless of actor or enemy, to easily create defense or
 *   assault missions
 */

(function(){

	var parameters = PluginManager.parameters('SRPG_Teams');
	var _actorTeam = parameters['Default Actor Team'] || "";
	var _enemyTeam = parameters['Default Enemy Team'] || "";

	// generic battler team
	Game_BattlerBase.prototype.srpgTeam = function() {
		var team = ""
		this.states().some(function(state) {
			if (state.meta.srpgTeam) {
				team = state.meta.srpgTeam;
				return true;
			}
			return false;
		};
		return team.trim().toLowerCase();;
	};

	// get an actor's team
	Game_Actor.prototype.srpgTeam = function() {
		var team = Game_BattlerBase.prototype.srpgTeam.call(this) || _actorTeam;
		if (this.currentClass().meta.srpgTeam) {
			team = this.currentClass().meta.srpgTeam;
		} else if (this.actor().meta.srpgTeam) {
			team = this.actor().meta.srpgTeam;
		}
		return team.trim().toLowerCase();
	};

	// get an enemy's team
	Game_Enemy.prototype.srpgTeam = function() {
		var team = Game_BattlerBase.prototype.srpgTeam.call(this) || _enemyTeam;
		if (this.enemy().meta.srpgTeam) {
			team = this.enemy().meta.srpgTeam.toLowerCase();
		}
		return team.trim().toLowerCase();
	};

	// compare the two battler's teams
	Game_BattlerBase.prototype.sameTeam = function(other) {
		return (this.srpgTeam() == other.srpgTeam());
	};

	// count the living members of a given team
	Game_System.prototype.teamSize = function(team) {
		team = team || "";
		team = team.trim().toLowerCase();
		var count = 0;
		$gameMap.events().forEach(function(event) {
			if (event.isErased()) return;
			var battlerArray = $gameSystem.EventToUnit(event.eventId());
			if (!battlerArray || !battlerArray[1] || battlerArray[1].isDead()) return;

			if (battlerArray[1].srpgTeam() == team) count++;
		});
		return count;
	};

	// shorthand to check if there's nobody left on the team
	Game_System.prototype.teamIsDead = function(team) {
		return !!(this.teamSize(team) <= 0)
	};

})();