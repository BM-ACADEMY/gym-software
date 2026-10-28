const fs = require('fs');
const path = require('path');
const { HELP_ARTICLES } = require('../config/helpArticles');

test('server help articles match the client copy', () => {
  const client = fs.readFileSync(path.join(__dirname, '../../client/src/config/helpArticles.js'), 'utf8');
  const clientIds = [...client.matchAll(/\{ id: '([a-z]+)'/g)].map((m) => m[1]);
  expect(HELP_ARTICLES.map((a) => a.id)).toEqual(clientIds);
});
