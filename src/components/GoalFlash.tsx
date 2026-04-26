import type { GoalAnimationStyle, TeamRecord } from '../lib/types';

export interface GoalFlashState {
  key: number;
  team: TeamRecord;
  alignment: 'away' | 'home';
  gameId?: number;
}

function getTeamLogo(team: TeamRecord): string | undefined {
  return team.logo ?? team.darkLogo;
}

const LOGO_PARTICLE_COUNT = 18;

function LogoMark({
  goalFlash,
  className,
}: {
  goalFlash: GoalFlashState;
  className: string;
}) {
  const logo = getTeamLogo(goalFlash.team);

  return logo ? (
    <img
      src={logo}
      alt={`${goalFlash.team.abbrev} logo`}
      className={className}
    />
  ) : (
    <span className={`${className} goal-flash-logo-fallback`}>
      {goalFlash.team.abbrev}
    </span>
  );
}

export function GoalFlash({
  goalFlash,
  animationStyle = 'logo-storm',
}: {
  goalFlash: GoalFlashState;
  animationStyle?: GoalAnimationStyle;
}) {
  return (
    <div
      className={`goal-flash goal-flash-${goalFlash.alignment} goal-flash-${animationStyle}`}
      data-goal-animation={animationStyle}
    >
      <div className="goal-flash-logo-field" aria-hidden="true">
        {Array.from({ length: LOGO_PARTICLE_COUNT }, (_, index) => (
          <LogoMark
            key={index}
            goalFlash={goalFlash}
            className="goal-flash-particle-logo"
          />
        ))}
      </div>
      <div className="goal-flash-content">
        <div className="goal-flash-kicker">GOAL!</div>
        <div className="goal-flash-team">
          <LogoMark goalFlash={goalFlash} className="goal-flash-logo" />
          <span className="goal-flash-abbrev">{goalFlash.team.abbrev}</span>
        </div>
      </div>
    </div>
  );
}
