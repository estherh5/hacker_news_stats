// Set up jsdom HTML
var htmlMarkup = require ('fs')
  .readFileSync(__dirname + '/src/index.html').toString();

document.documentElement.innerHTML = htmlMarkup;


// Initiate mock for fetch
global.fetch = require('jest-fetch-mock');
