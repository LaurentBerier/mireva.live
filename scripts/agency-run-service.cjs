require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { resolve } = require('path');
const service = process.argv[2];
if (!['backend', 'orchestrator'].includes(service)) throw new Error('Expected backend or orchestrator');
require(resolve(__dirname, `../apps/${service}/dist/apps/${service}/src/main.js`));
