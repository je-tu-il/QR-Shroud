const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

test('les trois étapes ont des boutons reliés à leurs sections', () => {
  const buttons = [...html.matchAll(/<button type="button" class="step-indicator[^"]*" data-step="(\d+)"([^>]*)>/g)];
  const sections = [...html.matchAll(/<section class="wizard-step[^"]*" id="step-(\d+)">/g)];
  assert.deepEqual(buttons.map(match => match[1]), ['1', '2', '3']);
  assert.deepEqual(sections.map(match => match[1]), buttons.map(match => match[1]));
  assert.match(buttons[0][2], /aria-current="step"/);
  assert.ok(buttons.every(match => match[2].includes('disabled')));
});

test('la saisie et les commandes de navigation restent accessibles au chargement', () => {
  assert.match(html, /<label for="secret-text-input"/);
  assert.match(html, /<textarea id="secret-text-input"/);
  for (const id of ['btn-goto-step-2', 'btn-goto-step-3', 'btn-back-to-step-1', 'btn-back-to-step-2']) {
    assert.match(html, new RegExp('<button[^>]*id="' + id + '"'));
  }
});
