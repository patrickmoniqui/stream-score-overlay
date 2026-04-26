import type { TeamRecord } from '../lib/types';

export interface GoalFlashState {
  key: number;
  team: TeamRecord;
  alignment: 'away' | 'home';
  gameId?: number;
}

function getTeamLogo(team: TeamRecord): string | undefined {
  return team.logo ?? team.darkLogo;
}

export function GoalFlash({
  goalFlash,
}: {
  goalFlash: GoalFlashState;
}) {
  const logo = getTeamLogo(goalFlash.team);

  return (
    <div className={`goal-flash goal-flash-${goalFlash.alignment}`}>
      <div className="goal-flash-content">
        <div className="goal-flash-kicker">GOAL!</div>
        <div className="goal-flash-team">
          {logo ? (
            <img
              src={logo}
              alt={`${goalFlash.team.abbrev} logo`}
              className="goal-flash-logo"
            />
          ) : (
            <span className="goal-flash-logo-fallback">
              {goalFlash.team.abbrev}
            </span>
          )}
          <span className="goal-flash-abbrev">{goalFlash.team.abbrev}</span>
        </div>
      </div>
    </div>
  );
}
