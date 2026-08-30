/**
 * Lost & Found reports data, search matching, and UI rendering.
 */

export const CATEGORIES = [
  'All',
  'Electronics',
  'Keys',
  'Wallet',
  'Bags',
  'Documents',
  'Clothing',
  'Jewelry',
  'Pets',
  'Other',
];

export const lostReports = [
  {
    id: 'lost-1',
    title: 'Black Leather Wallet',
    category: 'Wallet',
    description: 'Black leather wallet with ID cards and a college ID inside. Lost near the main library entrance.',
    location: 'Main Library, 2nd Floor',
    date: '2026-08-28',
    contactName: 'Rahul Sharma',
    contactEmail: 'rahul.sharma@email.com',
    contactPhone: '+91 98765 43210',
    keywords: ['wallet', 'black', 'leather', 'id', 'cards'],
  },
  {
    id: 'lost-2',
    title: 'iPhone 14 Pro',
    category: 'Electronics',
    description: 'Space black iPhone 14 Pro in a clear case. Small crack on bottom corner. Last seen in cafeteria.',
    location: 'Student Cafeteria',
    date: '2026-08-27',
    contactName: 'Priya Mehta',
    contactEmail: 'priya.mehta@email.com',
    contactPhone: '+91 91234 56789',
    keywords: ['iphone', 'phone', 'apple', 'black', 'mobile', 'electronics'],
  },
  {
    id: 'lost-3',
    title: 'Car Keys with Blue Keychain',
    category: 'Keys',
    description: 'Set of car keys with a blue rubber keychain shaped like a star. Hyundai logo on the fob.',
    location: 'Parking Lot B',
    date: '2026-08-29',
    contactName: 'Arjun Patel',
    contactEmail: 'arjun.patel@email.com',
    contactPhone: '+91 99887 76655',
    keywords: ['keys', 'car', 'blue', 'keychain', 'hyundai'],
  },
  {
    id: 'lost-4',
    title: 'Blue Backpack',
    category: 'Bags',
    description: 'Navy blue JanSport backpack with laptop sleeve. Stickers on the front pocket.',
    location: 'Engineering Block, Room 204',
    date: '2026-08-26',
    contactName: 'Sneha Reddy',
    contactEmail: 'sneha.reddy@email.com',
    contactPhone: '+91 97654 32109',
    keywords: ['backpack', 'bag', 'blue', 'jansport', 'laptop'],
  },
  {
    id: 'lost-5',
    title: 'Aadhaar & PAN Card Set',
    category: 'Documents',
    description: 'Lost document pouch containing Aadhaar card and PAN card in a brown envelope.',
    location: 'Admin Office Corridor',
    date: '2026-08-25',
    contactName: 'Vikram Singh',
    contactEmail: 'vikram.singh@email.com',
    contactPhone: '+91 90123 45678',
    keywords: ['documents', 'aadhaar', 'pan', 'card', 'envelope'],
  },
  {
    id: 'lost-6',
    title: 'Gold Chain with Pendant',
    category: 'Jewelry',
    description: 'Thin gold chain with a small heart-shaped pendant. Sentimental value.',
    location: 'Sports Complex Gym',
    date: '2026-08-24',
    contactName: 'Ananya Iyer',
    contactEmail: 'ananya.iyer@email.com',
    contactPhone: '+91 93456 78901',
    keywords: ['gold', 'chain', 'jewelry', 'pendant', 'necklace'],
  },
];

export const foundReports = [
  {
    id: 'found-1',
    title: 'Black Wallet Found',
    category: 'Wallet',
    description: 'Found a black wallet near the library. Contains ID cards.',
    location: 'Main Library Entrance',
    date: '2026-08-29',
    finderName: 'Meera Joshi',
    finderEmail: 'meera.joshi@email.com',
    keywords: ['wallet', 'black', 'library'],
  },
  {
    id: 'found-2',
    title: 'Smartphone Found in Cafeteria',
    category: 'Electronics',
    description: 'Black smartphone found on a cafeteria table. In clear case.',
    location: 'Student Cafeteria',
    date: '2026-08-28',
    finderName: 'Karan Malhotra',
    finderEmail: 'karan.malhotra@email.com',
    keywords: ['phone', 'iphone', 'smartphone', 'black', 'cafeteria'],
  },
  {
    id: 'found-3',
    title: 'Keys with Blue Keychain',
    category: 'Keys',
    description: 'Found car keys with a blue star keychain in parking area.',
    location: 'Parking Lot B',
    date: '2026-08-30',
    finderName: 'Divya Nair',
    finderEmail: 'divya.nair@email.com',
    keywords: ['keys', 'blue', 'keychain', 'car', 'parking'],
  },
  {
    id: 'found-4',
    title: 'Blue Backpack Found',
    category: 'Bags',
    description: 'Navy blue backpack left in a classroom. Has stickers.',
    location: 'Engineering Block',
    date: '2026-08-27',
    finderName: 'Rohit Gupta',
    finderEmail: 'rohit.gupta@email.com',
    keywords: ['backpack', 'blue', 'bag', 'jansport'],
  },
];

/**
 * Match lost reports against a search query and optional category filter.
 */
export function searchLostReports(query, category = 'All') {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0 && category === 'All') return [];

  return lostReports.filter((item) => {
    const categoryMatch = category === 'All' || item.category === category;
    if (!categoryMatch) return false;
    if (terms.length === 0) return true;

    const searchable = [
      item.title,
      item.category,
      item.description,
      item.location,
      ...(item.keywords || []),
    ]
      .join(' ')
      .toLowerCase();

    return terms.some((term) => searchable.includes(term));
  });
}

/**
 * Score-based match: how well a lost item matches a found item description.
 */
export function matchLostToFound(foundItem) {
  const query = [foundItem.title, foundItem.description, ...(foundItem.keywords || [])].join(' ');
  return searchLostReports(query, foundItem.category === 'Other' ? 'All' : foundItem.category);
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function createLostCard(item, index, showContact = true) {
  const card = document.createElement('article');
  card.className = 'report-card card-lost animate-in';
  card.style.animationDelay = `${index * 0.08}s`;
  card.dataset.id = item.id;

  card.innerHTML = `
    <div class="card-top">
      <span class="card-category">${escapeHtml(item.category)}</span>
      <span class="card-date">${formatDate(item.date)}</span>
    </div>
    <h3 class="card-title">${escapeHtml(item.title)}</h3>
    <p class="card-desc">${escapeHtml(item.description)}</p>
    <p class="card-location">📍 ${escapeHtml(item.location)}</p>
    ${
      showContact
        ? `<button type="button" class="btn btn-primary btn-sm contact-btn" data-id="${item.id}">
             Contact Owner
           </button>`
        : ''
    }
  `;

  return card;
}

export function createFoundCard(item, index) {
  const card = document.createElement('article');
  card.className = 'report-card card-found animate-in';
  card.style.animationDelay = `${index * 0.08}s`;
  card.dataset.id = item.id;

  card.innerHTML = `
    <div class="card-top">
      <span class="card-category">${escapeHtml(item.category)}</span>
      <span class="card-date">${formatDate(item.date)}</span>
    </div>
    <h3 class="card-title">${escapeHtml(item.title)}</h3>
    <p class="card-desc">${escapeHtml(item.description)}</p>
    <p class="card-location">📍 ${escapeHtml(item.location)}</p>
    <button type="button" class="btn btn-outline btn-sm match-btn" data-id="${item.id}">
      Find Matching Lost Reports
    </button>
  `;

  return card;
}

export function getLostById(id) {
  return lostReports.find((item) => item.id === id);
}

export function getFoundById(id) {
  return foundReports.find((item) => item.id === id);
}

export function animateCounter(el, target, duration = 1200) {
  const start = performance.now();
  const from = 0;

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (target - from) * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}
