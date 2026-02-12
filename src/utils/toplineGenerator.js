/**
 * Generates random "Topline" content:
 * - Flashback (On this day)
 * - Trending (Keywords from news)
 * - Quick Fact
 * - Weather Insight
 */

const QUICK_FACTS = [
    "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still edible.",
    "Octopuses have three hearts. Two pump blood to the gills, while one pumps it to the rest of the body.",
    "Bananas are berries, but strawberries aren't.",
    "The Eiffel Tower can be 15 cm taller during the summer due to thermal expansion.",
    "A group of flamingos is called a 'flamboyance'.",
    "Wombat poop is cube-shaped.",
    "The shortest war in history lasted 38 minutes between Britain and Zanzibar in 1896.",
    "Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid of Giza.",
    "Sloths can hold their breath longer than dolphins (up to 40 minutes).",
    "A cloud can weigh more than a million pounds.",
    "The first computer bug was an actual moth trapped in a relay of the Harvard Mark II computer in 1947.",
    "There are more possible iterations of a game of chess than there are atoms in the observable universe.",
    "Sea otters hold hands when they sleep to keep from drifting apart.",
    "The total weight of ants on Earth once equaled the total weight of people.",
    "Hot water freezes faster than cold water (the Mpemba effect).",
    "A day on Venus is longer than a year on Venus.",
    "Sharks existed before trees.",
    "The fingerprints of a koala are so indistinguishable from humans that they have on occasion been confused at a crime scene.",
    "A bolt of lightning contains enough energy to toast 100,000 slices of bread.",
    "The inventor of the Pringles can is now buried in one.",
    "Humans share 50% of their DNA with bananas.",
    "Water makes different pouring sounds depending on its temperature.",
    "The longest hiccuping spree lasted 68 years.",
    "Cows have best friends and get stressed when they are separated.",
    "The world's smallest reptile was discovered in 2021 in Madagascar and is smaller than a fingernail.",
    "New York City drifts about one inch farther away from London every year.",
    "The Moon has moonquakes.",
    "If you could fold a piece of paper 42 times, it would reach the moon.",
    "The unicorn is the national animal of Scotland.",
    "It rains diamonds on Saturn and Jupiter.",
    "Oxford University is older than the Aztec Empire.",
    "France was still executing people by guillotine when the first Star Wars movie came out.",
    "There are more stars in the universe than grains of sand on all the Earth's beaches.",
    "Only one letter doesn't appear in any U.S. state name: Q.",
    "The heart of a blue whale is so huge that a human could swim through its arteries.",
    "A snail can sleep for three years.",
    "The longest time between two twins being born is 87 days."
];

const HISTORY_EVENTS = [
    "On this day, history was made.", // Placeholder, ideally specific to date
    "Remembering the pioneers of the digital age.",
    "Today marks a moment of innovation in history."
];

export async function fetchOnThisDay() {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const url = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${mm}/${dd}`;

    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'DailyBriefApp/1.0 (contact@example.com)' }
        });
        if (!res.ok) return null;
        const data = await res.json();

        // Prefer "selected" events
        if (data.selected && data.selected.length > 0) {
            const event = data.selected[0];
            return {
                text: `On this day in ${event.year}: ${event.text}`,
                year: event.year
            };
        }
        return null;
    } catch (e) {
        console.warn('OnThisDay fetch failed:', e);
        return null;
    }
}

function getTrending(newsData) {
    // Extract words from headlines
    const words = [];
    const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'dead', 'kills', 'says', 'india', 'world', 'chennai', 'tamil', 'nadu']);

    // Aggregate all headlines
    const allNews = [
        ...(newsData.world || []),
        ...(newsData.india || []),
        ...(newsData.tech || [])
    ];

    if (allNews.length === 0) return null;

    allNews.forEach(item => {
        if (!item.title) return;
        const clean = item.title.replace(/[^\w\s]/gi, '').toLowerCase().split(/\s+/);
        clean.forEach(w => {
            if (w.length > 3 && !stopWords.has(w)) words.push(w);
        });
    });

    // Count frequency
    const freq = {};
    words.forEach(w => freq[w] = (freq[w] || 0) + 1);

    // Sort
    const sorted = Object.entries(freq).sort((a,b) => b[1] - a[1]);
    const top3 = sorted.slice(0, 3).map(x => x[0]);

    if (top3.length === 0) return null;

    return {
        type: 'TRENDING',
        icon: '🔥',
        text: `Trending now: #${top3.join(', #')}`
    };
}

function getWeatherInsight(weatherData) {
    if (!weatherData || Object.keys(weatherData).length === 0) return null;

    // Pick first available city
    const city = Object.keys(weatherData)[0];
    const data = weatherData[city];

    if (!data || !data.current) return null;

    const temp = data.current.temp;
    const cond = data.current.condition.toLowerCase();

    let text = "";
    if (temp > 35) text = `It's a scorcher today at ${temp}°C. Stay hydrated!`;
    else if (temp < 20) text = `Cooler vibes today at ${temp}°C.`;
    else if (cond.includes('rain')) text = "Rainy skies today. Don't forget your umbrella.";
    else text = `Currently ${temp}°C and ${cond}. A pleasant day ahead?`;

    return {
        type: 'WEATHER INSIGHT',
        icon: '🌤️',
        text: text
    };
}

export function generateTopline(newsData, weatherData, onThisDayEvent = null) {
    const options = [];

    // 1. Fact (Boost weight)
    options.push({
        type: 'QUICK FACT',
        icon: '💡',
        text: QUICK_FACTS[Math.floor(Math.random() * QUICK_FACTS.length)]
    });
     options.push({
        type: 'QUICK FACT',
        icon: '💡',
        text: QUICK_FACTS[Math.floor(Math.random() * QUICK_FACTS.length)]
    });

    // 2. Trending (if news available)
    const trending = getTrending(newsData);
    if (trending) options.push(trending);

    // 3. Weather (if available)
    const weather = getWeatherInsight(weatherData);
    if (weather) options.push(weather);

    // 4. Flashback (Use API result if available, else generic)
    if (onThisDayEvent) {
        options.push({
            type: 'ON THIS DAY',
            icon: '🕰️',
            text: onThisDayEvent.text
        });
        options.push({ // Boost probability
            type: 'ON THIS DAY',
            icon: '🕰️',
            text: onThisDayEvent.text
        });
    } else {
        options.push({
            type: 'FLASHBACK',
            icon: '🕰️',
            text: HISTORY_EVENTS[Math.floor(Math.random() * HISTORY_EVENTS.length)]
        });
    }

    // Random Pick
    return options[Math.floor(Math.random() * options.length)];
}
