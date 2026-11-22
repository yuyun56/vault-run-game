// Every tuning number and colour for Vault Run in one place. The playfield is
// a fixed 1280x720 logical area; the renderer scales it to the window, so no
// rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 162,
  sneakSpeed: 88,
  /** While sneaking, every watcher sees this much less far. */
  sneakSightFactor: 0.7,
  /** Seconds between coin tosses. */
  coinCooldown: 1.1,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 74,
  suspectSpeed: 118,
  chaseSpeed: 208,
  visionRange: 242,
  visionHalfAngle: 0.62,
  /** Seconds a guard pauses at each waypoint, scanning. */
  pauseSeconds: 1.6,
  /** Personal alert (0..1) at which a guard starts toward the last seen spot. */
  suspectAt: 0.3,
  /** Personal alert at which a guard gives chase. */
  chaseAt: 0.62,
  /** Closer than this to an alert guard and the thief is grabbed. */
  catchDistance: 27,
  alertRise: 1.5,
  alertFall: 0.32,
};

export const CAMERA = {
  visionRange: 268,
  visionHalfAngle: 0.44,
  /** Alarm points per second a camera adds while it watches the thief. */
  alarmRate: 30,
};

export const ALARM = {
  max: 100,
  /** Drain per second while nobody sees the thief. */
  drain: 15,
  /** Guard alarm per second at point blank, easing to the far rate at full range. */
  guardRateNear: 58,
  guardRateFar: 22,
  /** Grabbing the vault loot jolts the meter by this much: the vault complains. */
  vaultJolt: 12,
};

/** Score values by loot kind. */
export const LOOT_VALUES = { gem: 500, gold: 800, painting: 1200, crown: 2500, vault: 5000 };

export const COLORS = {
  floor: '#1c2733',
  floorAlt: '#202d3b',
  carpet: '#5d1f26',
  wall: '#0d1119',
  wallEdge: '#3d5a76',
  cover: '#4a3a26',
  coverEdge: '#8a6d3b',
  gold: '#f2c14e',
  gem: '#57e6d9',
  danger: '#ff5347',
  safe: '#52e07a',
};
