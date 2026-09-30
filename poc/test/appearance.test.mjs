import assert from 'node:assert/strict';
import test from 'node:test';

import { insertAppearance, probeAppearance, removeAppearance } from '../lib/appearance.mjs';

function makeElement(tag) {
  const element = {
    tag,
    id: '',
    type: '',
    textContent: '',
    parentNode: null,
    childNodes: [],
    attributes: {},
    get firstChild() {
      return this.childNodes[0] || null;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    },
    appendChild(child) {
      if (child.parentNode) child.remove();
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    },
    insertBefore(child, reference) {
      if (child.parentNode) child.remove();
      child.parentNode = this;
      const index = this.childNodes.indexOf(reference);
      if (index < 0) this.childNodes.push(child);
      else this.childNodes.splice(index, 0, child);
      return child;
    },
    remove() {
      if (!this.parentNode) return;
      const index = this.parentNode.childNodes.indexOf(this);
      if (index >= 0) this.parentNode.childNodes.splice(index, 1);
      this.parentNode = null;
    },
  };
  return element;
}

function makeDocument(children = []) {
  const document = makeElement('#document');
  let created = 0;
  document.createElement = (tag) => {
    created += 1;
    return makeElement(tag);
  };
  document.createdCount = () => created;
  document.querySelector = (selector) => {
    const match = /^\[data-test-id="([^"]+)"\]$/.exec(selector);
    if (!match) return null;
    const wanted = match[1];
    const stack = [...document.childNodes];
    while (stack.length) {
      const node = stack.shift();
      if (node.getAttribute('data-test-id') === wanted) return node;
      stack.unshift(...node.childNodes);
    }
    return null;
  };
  document.getElementById = (id) => {
    const stack = [...document.childNodes];
    while (stack.length) {
      const node = stack.shift();
      if (node.id === id) return node;
      stack.unshift(...node.childNodes);
    }
    return null;
  };
  for (const child of children) document.appendChild(child);
  return document;
}

function settingsList(sibling) {
  const list = makeElement('div');
  list.setAttribute('data-test-id', 'SETTINGS_LIST');
  if (sibling) list.appendChild(sibling);
  return list;
}

test('probe reports settings missing and creates nothing', () => {
  const document = makeDocument();
  const result = probeAppearance(document);
  assert.equal(result.settingsFound, false);
  assert.equal(result.inserted, false);
  assert.equal(result.firstChild, false);
  assert.equal(document.getElementById('ym-skins-appearance'), null);
  assert.equal(document.createdCount(), 0);
});

test('insertAppearance places the section first and keeps the sibling', () => {
  const sibling = makeElement('div');
  sibling.id = 'existing-setting';
  sibling.textContent = 'Качество звука';
  const list = settingsList(sibling);
  const document = makeDocument([list]);

  const result = insertAppearance(document);
  const block = document.getElementById('ym-skins-appearance');

  assert.equal(result.settingsFound, true);
  assert.equal(result.inserted, true);
  assert.equal(result.firstChild, true);
  assert.equal(list.firstChild, block);
  assert.equal(block.tag, 'section');
  assert.equal(block.id, 'ym-skins-appearance');
  assert.equal(block.getAttribute('data-yms'), 'settings.appearance');
  assert.equal(block.childNodes.length, 2);
  assert.equal(block.childNodes[0].tag, 'h2');
  assert.equal(block.childNodes[0].textContent, 'Оформление');
  assert.equal(block.childNodes[1].tag, 'button');
  assert.equal(block.childNodes[1].type, 'button');
  assert.equal(block.childNodes[1].textContent, 'Оригинальная тема');
  assert.equal(list.childNodes[1], sibling);
  assert.equal(sibling.textContent, 'Качество звука');
});

test('removeAppearance removes only the appearance section', () => {
  const sibling = makeElement('div');
  sibling.id = 'existing-setting';
  const list = settingsList(sibling);
  const document = makeDocument([list]);
  insertAppearance(document);

  const result = removeAppearance(document);

  assert.equal(result.removed, true);
  assert.equal(document.getElementById('ym-skins-appearance'), null);
  assert.deepEqual(list.childNodes, [sibling]);
  assert.equal(sibling.parentNode, list);
});

test('probeAppearance restores the list and reports a successful insert', () => {
  const sibling = makeElement('div');
  sibling.id = 'existing-setting';
  const list = settingsList(sibling);
  const document = makeDocument([list]);
  const before = [...list.childNodes];

  const result = probeAppearance(document);

  assert.equal(result.settingsFound, true);
  assert.equal(result.inserted, true);
  assert.equal(result.firstChild, true);
  assert.equal(result.removed, true);
  assert.equal(document.getElementById('ym-skins-appearance'), null);
  assert.deepEqual(list.childNodes, before);
});

test('insertAppearance twice leaves a single section', () => {
  const sibling = makeElement('div');
  sibling.id = 'existing-setting';
  const list = settingsList(sibling);
  const document = makeDocument([list]);

  insertAppearance(document);
  const result = insertAppearance(document);
  const matches = list.childNodes.filter((node) => node.id === 'ym-skins-appearance');

  assert.equal(result.inserted, true);
  assert.equal(result.firstChild, true);
  assert.equal(matches.length, 1);
  assert.equal(list.firstChild, matches[0]);
  assert.equal(list.childNodes.length, 2);
  assert.equal(list.childNodes[1], sibling);
});
