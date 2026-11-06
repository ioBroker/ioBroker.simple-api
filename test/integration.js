const path = require('node:path');
const { tests } = require('@iobroker/testing');

// Run the standard integration tests: the adapter must start with its default settings
// See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, '..'));
