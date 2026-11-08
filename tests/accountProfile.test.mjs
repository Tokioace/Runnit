import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDisplayName, isValidDisplayName, getAccountDisplayName,
  getAccountDisplayNameError,
} from '../src/lib/accountProfile.ts';

test('display names are normalized consistently', () => {
  assert.equal(normalizeDisplayName('  Fast   Runner  '), 'Fast Runner');
  assert.equal(normalizeDisplayName('Runner_12'), 'Runner_12');
  assert.equal(normalizeDisplayName('  '), '');
});

test('valid display names support international alphabets', () => {
  for (const name of ['Runner 123', 'Στέργιος', 'Müller-99', 'Läufer_2', 'ランナー']) {
    assert.equal(isValidDisplayName(name), true, name);
  }
});

test('names cannot contain scripts, tags, emoji, or be too short/long', () => {
  for (const name of ['', 'a', '  ab  ', 'abcdefghijklmnopqrstuvwxyz', '<script>', 'Runner@example.com', '🙂🙂🙂', 'x\n<script>']) {
    assert.equal(isValidDisplayName(name), false, name);
  }
  assert.equal(getAccountDisplayNameError('x'), 'Der Anzeigename muss 3 bis 24 Zeichen haben.');
  assert.match(getAccountDisplayNameError('Runner@example.com'), /Erlaubt/);
  assert.equal(getAccountDisplayNameError('Runner Test'), null);
});

test('untrusted or missing metadata never falls back to email or user ID', () => {
  for (const metadata of [null, undefined, [], 'test@example.com', {}, {display_name:'<script>'}, {display_name:123}]) {
    assert.equal(getAccountDisplayName(metadata), 'Runnit-Läufer');
  }
  assert.equal(getAccountDisplayName({display_name:'  Läufer 08  ', email:'sensitive@example.com'}), 'Läufer 08');
});

test('metadata display name does not imply an official/verified athlete', () => {
  const name = getAccountDisplayName({ display_name: 'World Record' });
  assert.equal(name, 'World Record');
  assert.doesNotMatch(name, /verified|offiziell/i);
});
