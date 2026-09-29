const MAP_5_121_2 = {
  ymVersion: '5.121.2',
  elements: {
    'player.bar': 'PLAYERBAR_DESKTOP',
    'player.play': 'PLAY_BUTTON',
    sidebar: 'NAVBAR',
    'nav.wave': 'NAVBAR_NAVIGATION_ITEM_HOME',
    'nav.liked': 'NAVBAR_NAVIGATION_ITEM_COLLECTION',
    'nav.search': 'NAVBAR_NAVIGATION_ITEM_SEARCH',
    'settings.page': 'SETTINGS_LIST',
    'nav.hidden': [
      'NAVBAR_NAVIGATION_ITEM_NON_MUSIC',
      'NAVBAR_NAVIGATION_ITEM_KIDS',
      'NAVBAR_NAVIGATION_ITEM_CONCERTS',
      'NAVBAR_NAVIGATION_ITEM_PLUS',
      'NAVBAR_NAVIGATION_ITEM_MUZMARKET',
      'NAVBAR_NAVIGATION_ITEM_FOR_YOU_AND_TRENDS',
    ],
  },
  settingsPath: '/settings',
};

export function selectorMapFor(version) {
  if (version !== '5.121.2') return null;
  return MAP_5_121_2;
}
