#!/usr/bin/env node
'use strict';
//short and sweet, just run the init in the bin
const { init } = require('./bin/wp-env-bin');
init(process.argv);