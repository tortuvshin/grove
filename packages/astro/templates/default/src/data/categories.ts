export type Category = {
  slug: string;
  name: string;
  blurb: string;
};

// Static taxonomy. Counts are NOT stored here — they are computed at
// build time from data/generated/apps.json via src/lib/category-counts.ts
// so the numbers always match what's actually rendered.
export const categories: Category[] = [
  { slug: "productivity", name: "Productivity", blurb: "Tasks, notes, calendars, knowledge bases." },
  { slug: "finance", name: "Finance", blurb: "Budgeting, wallets, expense tracking." },
  { slug: "education", name: "Education", blurb: "Flashcards, learning, reference apps." },
  { slug: "tools", name: "Tools", blurb: "Browsers, utilities, dev helpers, file tools." },
  { slug: "communication", name: "Communication", blurb: "Chat, messaging, social, team tools." },
  { slug: "health-and-fitness", name: "Health and Fitness", blurb: "Workouts, nutrition, wellness tracking." },
  { slug: "business", name: "Business", blurb: "Invoicing, jobs, marketplace, ops tools." },
  { slug: "games", name: "Games", blurb: "Open-source games and engines." },
  { slug: "media", name: "Media", blurb: "Music, movies, photos, audio and video." },
  { slug: "entertainment", name: "Entertainment", blurb: "TV, movies, books, anime, ebooks." },
  { slug: "social-network", name: "Social Network", blurb: "Decentralized social clients and readers." },
  { slug: "shopping", name: "Shopping", blurb: "E-commerce, delivery, food, retail." },
  { slug: "news", name: "News and Magazine", blurb: "Hacker News clients, RSS, magazines." },
  { slug: "travel", name: "Travel", blurb: "Flights, tourism, cab sharing, guides." },
  { slug: "lifestyle", name: "Lifestyle", blurb: "Habits, journaling, daily life tools." },
  { slug: "personalization", name: "Personalization", blurb: "Launchers, themes, customization." },
];
