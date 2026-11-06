const { copyFileSync } = require('node:fs');

copyFileSync(`${__dirname}/src/types.d.ts`, `${__dirname}/build/types.d.ts`);
