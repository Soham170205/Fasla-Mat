// Vendor + item catalogue. floorPrice and persona are SECRET: they never leave the server.
export const VENDORS = [
  {
    id: 'ramesh',
    name: 'Ramesh Kaka',
    shop: 'Ramesh Sabzi Bhandar',
    sprite: 'field_farmer',
    item: { id: 'sabzi-thaila', name: 'Sabzi thaila, 5 kg mixed', image: 'crate_tomato' },
    openingPrice: 450,
    floorPrice: 290,
    personality: 'grumpy',
    persona:
      'A stubborn 65-year-old vegetable seller who has run this stall for 40 years. Proud of his produce ("seedha Nashik ke khet se"), easily "offended" by lowball offers ("Beta, mazaak kar rahe ho?"), softens if the customer is respectful or calls him Kaka. Loves complaining about diesel prices and the old days.',
    greeting: 'Aao beta! Nashik ka taaza maal. Poora thaila ₹450, ekdum fix rate.',
    callouts: ['Taaza sabzi, taaza sabzi!', 'Tamatar lal, bhav kamaal!', 'Seedha khet se, beta!']
  },
  {
    id: 'pinky',
    name: 'Pinky Didi',
    shop: 'Pinky Anaaj Bhandar',
    sprite: 'herb_keeper',
    item: { id: 'basmati-bori', name: 'Basmati chawal, 5 kg bori', image: 'sacks_big' },
    openingPrice: 900,
    floorPrice: 560,
    personality: 'sweet-talker',
    persona:
      'A charming, sweet-talking grain and masala seller in her 30s. Flatters customers heavily ("aap toh ghar ke ho"), uses emotional lines ("subah se boni nahi hui"), pretends every price is a loss. Drops price faster if the customer threatens to go to the next shop or promises to come back every month.',
    greeting: 'Arre aaiye aaiye! Dehradun ka asli basmati, khushboo toh dekho. Sirf ₹900 ki bori.',
    callouts: ['Asli basmati, asli khushboo!', 'Haldi, mirchi, chawal, sab milega!', 'Aaiye didi, aaiye bhaiya!']
  },
  {
    id: 'salim',
    name: 'Salim Bhai',
    shop: 'Salim Machhi Center',
    sprite: 'forge_worker',
    item: { id: 'pomfret', name: 'Taaza pomfret, 1 kg', image: 'fish_shelf' },
    openingPrice: 1400,
    floorPrice: 780,
    personality: 'hustler',
    persona:
      'A fast-talking, confident fish seller in his 20s at Sassoon Dock. Swears every fish came off the boat "aaj subah 5 baje". Says boss, bhai, full guarantee. Impatient; respects customers who sound street-smart or know their fish, gets annoyed by time-wasters.',
    greeting: 'Boss! Aaj subah ki pomfret, abhi bhi taaza. ₹1400 kilo, poore dock pe aisa maal nahi.',
    callouts: ['Pomfret, surmai, bangda!', 'Aaj subah ka maal, boss!', 'Taaza machhi, taaza!']
  }
];

export const findVendor = id => VENDORS.find(v => v.id === id);

// What the browser is allowed to see
export const publicVendor = ({ id, name, shop, sprite, item, openingPrice, greeting, callouts }) => ({
  id, name, shop, sprite, item, openingPrice, greeting, callouts
});

export function vendorOfDay() {
  const istDay = Math.floor((Date.now() + 5.5 * 3600e3) / 86400e3);
  return VENDORS[istDay % VENDORS.length].id;
}
