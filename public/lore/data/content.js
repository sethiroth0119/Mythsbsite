/* ═══════════════════════════════════════════════════════════════
   CONTENT — everything you'll normally change lives in this file.
   Pins, stories, comic issues, rewards, colours, opening camera.
   Nothing here is engine code; edit it freely.
   ═══════════════════════════════════════════════════════════════ */
"use strict";

/* Shorthand for a folder of numbered pages:
     pagesFrom('comics/ashfall-01', 5)
   becomes comics/ashfall-01/01.jpg … 05.jpg          */
function pagesFrom(dir, count, ext) {
  ext = ext || 'jpg';
  const out = [];
  for (let i = 1; i <= count; i++) out.push(dir + '/' + String(i).padStart(2, '0') + '.' + ext);
  return out;
}

/* ─────────────────── EDIT ZONE — START ─────────────────────── */

/* BRAND
   Change these and the whole interface follows. In admin mode you
   can edit them live with colour pickers instead. `terrain` tints
   the generated landmass toward your palette. */
const THEME = {
  ember:  '#FFC15E',  // primary accent — the gold of the border network
  brass:  '#C4923A',  // metal / recovered state
  arcane: '#B87BFF',  // corruption / sealed state
  bone:   '#DFE4DE',  // text
  void:   '#06080A',  // page background
  soot:   '#0D1114'   // panel background
};

const CONFIG = {
  seed: 91177,                // change this number and the whole world changes
  tile: 1024,                 // world-pixels per generated tile
  res: 512,                   // canvas pixels per tile (higher = crisper, slower)
  start: { x: -217, y: -69, z: 0.26 },   // opening camera position
  redeemUrl: 'https://mythicspellbook.com/redeem'
};

/* PAINTED ART TILES
   Drop your own map art on top of the procedural world. Tiles are
   never stretched: the image is cropped to fill (`cover`) and the
   edges are feathered so it melts into the terrain underneath.

   x, y, w, h  → position and size in world-pixels
   feather     → px of soft edge on every side (120–220 works well)
   filter      → CSS filter to colour-match a tile to its neighbours
   edges       → which sides to feather, e.g. 'trbl', or 'tb' to keep
                 left/right hard where two tiles butt together
*/
const ART_TILES = [
  // { src:'art/world_00_00.webp', x:0,    y:0,    w:2048, h:2048, feather:180, edges:'trbl', filter:'saturate(.85) brightness(.95) contrast(1.05)' },
  // { src:'art/world_01_00.webp', x:2048, y:0,    w:2048, h:2048, feather:180, edges:'trbl' },
];

/* PIN GLYPHS
   Line-art icons in the same family as the map's own markers.
   Set `glyph:'tower'` on a location, or upload custom art in admin. */
const GLYPHS = {
  sigil: 'M12 2.5a9.5 9.5 0 1 0 .01 19 9.5 9.5 0 0 0-.01-19M12 6.2l1.8 3.9 4.2.6-3 2.9.7 4.2-3.7-2-3.7 2 .7-4.2-3-2.9 4.2-.6z',
  tower: 'M9 21V8l3-5 3 5v13M6.5 21h11M10.5 12.5h3M12 3V1.6',
  rig:   'M12 3.5v17.5M6 21 12 6l6 15M8.5 15h7M10 11h4M4 21h16',
  shard: 'M12 2.2 4.2 12 12 21.8 19.8 12zM12 2.2v19.6M4.2 12h15.6',
  bell:  'M12 3.6a5.5 5.5 0 0 1 5.5 5.5c0 4.4 2 6.9 2 6.9h-15s2-2.5 2-6.9A5.5 5.5 0 0 1 12 3.6M9.8 19a2.2 2.2 0 0 0 4.4 0M12 3.6V2',
  hazard:'M12 10.2a2.4 2.4 0 1 0 .01 4.8 2.4 2.4 0 0 0-.01-4.8M12 2.6a6 6 0 0 1 3 5.2M12 2.6a6 6 0 0 0-3 5.2M3.6 17.6a6 6 0 0 1 1.5-5.9M20.4 17.6a6 6 0 0 0-1.5-5.9M7 20.6a6 6 0 0 0 10 0',
  swords:'M4.5 4.5 19 19M19.5 4.5 5 19M3 16.5l3 3M18 19.5l3-3',
  crate: 'M4.5 7.5h15v12h-15zM4.5 7.5 6.5 4h11l2 3.5M4.5 13.5h15M12 7.5v12',
  skull: 'M12 3.2a7 7 0 0 0-7 7v3.6l1.8 1.8v3.4h10.4v-3.4L19 13.8v-3.6a7 7 0 0 0-7-7M9.6 11.4a1.2 1.2 0 1 0 .01 0M14.4 11.4a1.2 1.2 0 1 0 .01 0'
};

/* LOCATIONS
   Each pin on the map. x/y are world-pixels — drag the map with the
   coordinate readout on (press the ` key) to find the spot you want.

   state: 'open'   → readable
          'sealed' → shown but not yet published
*/
const LOCATIONS = [

  {
    id: 'cinderfall',
    name: 'Cinderfall Basin',
    region: 'Origin Site 01',
    x: 251, y: 300,
    glyph: 'sigil',
    state: 'open',
    brief: 'The first ember fell here and never went out. Nine days of ashfall buried the old market roads; on the tenth, the survivors found the ash was <em>worth something</em>. Everything the Doctrine later called currency started as somebody sweeping their own ruined house for cinder.',
    meta: { era: 'Year 0 — 3', pov: 'Marrow Vane, ledger-keeper' },
    issues: [
      {
        no: 'I', title: 'The First Cinder',
        blurb: 'Nine days of ash. One woman keeps counting.',
        pages: [
          { layout:'splash', sfx:'ASHFALL', cap:['Day one. The sky went the colour of a closed eye.'] },
          { layout:'grid',  cap:['They told us to shelter. They did not say for how long.','By the fourth day the market roads were gone under grey.'] },
          { layout:'hero',  cap:['Marrow swept her own doorway out of habit.','The ash in her hand was warm. It had been warm for four days.'] },
          { layout:'strip', sfx:'TAKE IT', cap:['A man offered her bread for a fistful.','She weighed it. She wrote it down.','The first ledger line in the Doctrine reads: ONE LOAF / ONE HAND.'] },
          { layout:'hero',  cap:['Nothing was worth nothing anymore.','That was the whole discovery.'] }
        ],
        reward: {
          code: 'ASHFALL-FIRSTCINDER',
          title: 'Marrow\'s Ledger',
          desc: '250 ₵ Cinder and the "First Cinder" card back, stamped with the opening line of the ledger.',
          note: 'One redemption per account.'
        }
      },
      {
        no: 'II', title: 'What the Ash Remembers',
        blurb: 'The basin starts giving things back. Not all of them were lost.',
        pages: [
          { layout:'hero',  cap:['Three years on, the basin still exhales.'] },
          { layout:'grid',  cap:['Diggers pull up doorframes, coins, a child\'s shoe.','And once — a hand that was still warm.'] },
          { layout:'splash', sfx:'STILL WARM', cap:['Marrow stopped writing that day.'] }
        ]
      }
    ]
  },

  {
    id: 'blackriver',
    name: 'Black River Derricks',
    region: 'Extraction Field 07',
    x: -1554, y: -1415,
    glyph: 'rig',
    state: 'open',
    brief: 'Black River Petroleum kept pumping through the ashfall because the contracts said so. Then the weather changed and it started raining what they were pulling up. The derricks still run. Nobody has been able to find who signs the orders.',
    meta: { era: 'Year 11', pov: 'Shift crew, Derrick 12' },
    issues: [
      {
        no: 'I', title: 'Crude Doctrine',
        blurb: 'The oil rain comes first. The fire rain is a schedule, not an accident.',
        pages: [
          { layout:'splash', sfx:'DERRICK 12', cap:['The order came through at shift change. It always does.'] },
          { layout:'grid',  cap:['Nobody on the crew has met a supervisor.','The pay clears. The quotas rise. The pay clears.'] },
          { layout:'strip', cap:['At 04:10 the sky slicked over.','Black on the helmets, black in the seams.','Everyone knew what came after black.'] },
          { layout:'hero',  sfx:'IGNITION', cap:['You get eleven minutes between the oil and the fire.','Twelve if the wind is kind. It was not kind.'] },
          { layout:'grid',  cap:['They made the pump house with four to spare.','Derrick 12 burned all night and pumped straight through it.'] }
        ],
        reward: {
          code: 'ASHFALL-CRUDEDOCTRINE',
          title: 'Blackwater Rig Kit',
          desc: '150 ₵ Cinder, the Oil Rain board hazard unlocked for custom matches, and the Derrick 12 crew banner.',
          note: 'Hazard unlock applies to private lobbies.'
        }
      }
    ]
  },

  {
    id: 'kallix',
    name: 'The Reach of Kallix',
    region: 'Archon Seat',
    x: 1658, y: -1457,
    glyph: 'tower',
    state: 'open',
    brief: 'Zevran Kallix does not arrive. He is <em>paid for</em>. Two of your own, given up, and the spire answers with something larger than both. The Reach keeps the receipts of every summoning — which is how we know what the tributes were worth, and what they thought they were buying.',
    meta: { era: 'Year 14', pov: 'The Tribute Rolls' },
    issues: [
      {
        no: 'I', title: 'Two Offered, One Risen',
        blurb: 'Crystal Fire and Dani Lion go up the steps. Something else comes down.',
        pages: [
          { layout:'splash', sfx:'THE REACH', cap:['The spire only opens for a price it has already named.'] },
          { layout:'grid',  cap:['Crystal Fire went first, and went willingly.','Dani Lion had to be told twice.'] },
          { layout:'hero',  sfx:'TRIBUTE', cap:['The rolls record the exchange in one line each.','No cause of loss. No survivors listed.'] },
          { layout:'strip', cap:['What came down wore neither of their faces.','It knew both of their names.','It used them the way a man uses tools he did not make.'] },
          { layout:'splash', sfx:'KALLIX', cap:['An Archon is not summoned. An Archon is afforded.'] }
        ],
        reward: {
          code: 'ASHFALL-TWOOFFERED',
          title: 'Tribute Rolls Sigil',
          desc: '300 ₵ Cinder and the animated Tribute Rolls summon frame for Archon-class units.',
          note: 'Frame equips from the deck editor.'
        }
      },
      {
        no: 'II', title: 'The Receipts',
        blurb: 'An archivist reads the rolls backwards and finds a name that has not been offered yet.',
        pages: [
          { layout:'hero', cap:['Every summoning is written down. That is the only mercy here.'] },
          { layout:'grid', cap:['Read forward: a history.','Read backward: a schedule.'] },
          { layout:'splash', sfx:'YOUR NAME', cap:['The last entry has not happened.'] }
        ]
      }
    ]
  },

  {
    id: 'glasswaste',
    name: 'The Glasswaste',
    region: 'Storm Flat 03',
    x: -1710, y: 934,
    glyph: 'shard',
    state: 'open',
    brief: 'Crystal falls here the way rain falls elsewhere. It lands, it stands, it shatters — and for about a minute the whole flat is a lens. The survivors of the third storm all describe seeing the same thing through it, and none of them agree on what it was.',
    meta: { era: 'Year 9', pov: 'Salvage line, west flat' },
    issues: [
      {
        no: 'I', title: 'Shatterfall',
        blurb: 'A minute of clear glass. Everyone looks. Everyone sees something different.',
        pages: [
          { layout:'splash', sfx:'SHATTERFALL', cap:['You hear the storm about four seconds before it lands.'] },
          { layout:'grid', cap:['The crystal comes down whole and stands where it strikes.','Then the flat rings like a struck cup.'] },
          { layout:'hero', sfx:'KRRAKK', cap:['For one minute after, the air is glass.','Everyone on the salvage line looked. You would have too.'] },
          { layout:'strip', cap:['One saw a city that had not burned.','One saw her own house, with the door open.','One saw the flat, exactly as it was, with nobody on it.'] }
        ]
      }
    ]
  },

  {
    id: 'emberhold',
    name: 'Emberhold',
    region: 'Chartered Node 01',
    x: 1444, y: 1500,
    glyph: 'bell',
    state: 'open',
    brief: 'The first node city that held. Not because it was defended well — because someone wrote down who owed what and made it stick. Emberhold\'s charter is four pages long and has been amended eleven times, each time in blood-coloured ink and each time by a different hand.',
    meta: { era: 'Year 6 — present', pov: 'The Charter' },
    issues: [
      {
        no: 'I', title: 'Charter of Emberhold',
        blurb: 'Four pages, eleven amendments, one city that did not fall.',
        pages: [
          { layout:'hero', cap:['Walls fail. Ledgers do not, if enough people agree to read them.'] },
          { layout:'grid', cap:['Article One: every hand works or every hand leaves.','Article Two: the granary answers to the whole, not the holder.'] },
          { layout:'strip', cap:['The third amendment was written during a siege.','The seventh was written after one.','The eleventh is not finished.'] },
          { layout:'splash', sfx:'EMBERHOLD', cap:['Buy. Build. Borrow. Never sell the granary.'] }
        ],
        reward: {
          code: 'ASHFALL-CHARTER01',
          title: 'Founding Charter Deed',
          desc: '200 ₵ Cinder, a Node City plot expansion, and the Emberhold banner for your node.',
          note: 'Plot expansion applies to your active node.'
        }
      }
    ]
  },

  {
    id: 'meridian',
    name: 'The Quiet Meridian',
    region: 'Interdiction Zone',
    x: -1393, y: -274,
    glyph: 'hazard',
    state: 'sealed',
    brief: 'Weather comes through here that has no business being called weather. The Doctrine\'s own surveyors marked the meridian closed and then marked the closure closed. Recovery of this record is pending.',
    meta: { era: 'Unknown', pov: 'Sealed by order' },
    issues: [
      { no: 'I', title: 'Weather for the Dead', blurb: 'Record sealed. Recovery pending.', pages: [], locked: true }
    ]
  }

];
