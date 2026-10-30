// Lodge settings shared by every endpoint. The booking panel in js/site.js
// mirrors these numbers for its estimate, but the server's copy is the one
// that counts.

export const RATE_PER_ROOM_NIGHT = 1500;

export const LODGES = {
  // 10 en-suite chalets, up to 30 guests.
  main: { name: 'Main Lodge', rooms: 10, cap: 30 },
  // Room count not confirmed by the lodge yet. While it's null, only
  // whole-lodge blocks and whole-lodge bookings make a date unavailable.
  bush: { name: 'Bush Lodge', rooms: null, cap: 20 },
};

export const OCCASIONS = [
  'Leisure stay',
  'Wedding',
  'Conference or retreat',
  'Celebration',
  'Photographic safari',
  'Hunting package',
];

export const STATUSES = ['new', 'contacted', 'confirmed', 'declined', 'cancelled'];

export const MAX_NIGHTS = 60;
export const MAX_GUESTS = 200;
