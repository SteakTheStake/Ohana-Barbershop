import * as migration_20261020_070459 from './20261020_070459';
import * as migration_20261020_205449_reliability from './20261020_205449_reliability';

export const migrations = [
  {
    up: migration_20261020_070459.up,
    down: migration_20261020_070459.down,
    name: '20261020_070459',
  },
  {
    up: migration_20261020_205449_reliability.up,
    down: migration_20261020_205449_reliability.down,
    name: '20261020_205449_reliability'
  },
];
