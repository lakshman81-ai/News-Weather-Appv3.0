// import { getSettings } from '../utils/storage';
import { getSettings } from '../utils/storage.js';

// ============================================
// 1. STOCK INDICES (NSE/BSE)
// ============================================

// Using Yahoo Finance symbols for Indian indices
const INDICES = {
    nifty50: '^NSEI',
    sensex: '^BSESN',
    niftyBank: '^NSEBANK',
    niftyIT: '^CNXIT',
    niftyMidcap: 'NIFTYMIDCAP150.NS',
    // Sectoral Indices (Phase 2)
    niftyPharma: '^CNXPHARMA',
    niftyAuto: '^CNXAUTO'
};

// Yahoo Finance API Base
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';

// Proxy Rotation Strategy
const PROXIES = [
    // Strategy 1: AllOrigins (Verified working for Yahoo)
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    // Strategy 2: CodeTabs (Verified working general proxy)
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

// Helper to fetch with CORS proxy rotation
async function fetchYahooData(symbol) {
    const targetUrl = `${YAHOO_BASE}${encodeURIComponent(symbol)}?interval=1d&range=1d`;

    const fetchWithTimeout = async (url, options = {}) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (e) {
            clearTimeout(id);
            throw e;
        }
    };

    // Try Proxies sequentially
    for (const proxyGen of PROXIES) {
        try {
            const proxyUrl = proxyGen(targetUrl);
            const response = await fetchWithTimeout(proxyUrl);
            if (response.ok) {
                return await response.json();
            }
        } catch (e) {
            console.warn(`[MarketService] Proxy failed: ${e.message}`);
            // Continue to next proxy
        }
    }

    throw new Error(`Failed to fetch market data for ${symbol}`);
}

// Helper to fetch from Alpha Vantage
async function fetchAlphaVantage(functionName, symbol, apikey) {
    if (!apikey) return null;
    const url = `https://www.alphavantage.co/query?function=${functionName}&symbol=${symbol}&apikey=${apikey}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data['Global Quote']) return data['Global Quote'];
        if (data['Top Gainers, Losers, and Most Active']) return data;
    } catch (e) {
        console.warn('Alpha Vantage fetch failed', e);
    }
    return null;
}

// Helper to extract price data from Yahoo response
function extractYahooPrice(data) {
    // Yahoo often wraps in chart.result[0]
    const result = data.chart?.result?.[0] || data.finance?.result?.[0];
    if (!result || !result.meta) return null;

    const quote = result.meta;
    const currentPrice = quote.regularMarketPrice;
    const prevClose = quote.chartPreviousClose || quote.previousClose;
    const change = currentPrice - prevClose;
    const changePercent = prevClose ? ((change / prevClose) * 100) : 0;
    const timestamp = quote.regularMarketTime ? quote.regularMarketTime * 1000 : Date.now();

    return {
        price: currentPrice,
        change: change,
        changePercent: changePercent.toFixed(2),
        timestamp: timestamp
    };
}

export async function fetchIndices() {
    console.log('[MarketService] Fetching Indian indices...');

    const promises = Object.entries(INDICES).map(async ([name, symbol]) => {
        try {
            // Strategy: Yahoo Finance
            const data = await fetchYahooData(symbol);
            const priceData = extractYahooPrice(data);

            if (!priceData) return null;

            console.log(`[MarketService] ✅ ${name}: ${priceData.price}`);
            return {
                name: name === 'nifty50' ? 'NIFTY 50' :
                    name === 'sensex' ? 'SENSEX' :
                    name === 'niftyBank' ? 'BANK NIFTY' :
                    name === 'niftyIT' ? 'NIFTY IT' :
                    name === 'niftyPharma' ? 'NIFTY PHARMA' :
                    name === 'niftyAuto' ? 'NIFTY AUTO' : 'MIDCAP 150',
                symbol: symbol,
                value: priceData.price.toLocaleString('en-IN'),
                change: priceData.change.toFixed(2),
                changePercent: priceData.changePercent,
                direction: priceData.change >= 0 ? 'up' : 'down',
                currency: '₹',
                timestamp: priceData.timestamp
            };
        } catch (err) {
            console.warn(`[MarketService] ⚠️ Failed to fetch ${name}:`, err.message);
            return null;
        }
    });

    const results = await Promise.all(promises);
    const validResults = results.filter(item => item !== null);

    // Backup Strategy: If primary fetch yields 0 results, try fallback scraping (Google Finance via Proxy)
    if (validResults.length === 0) {
        console.warn('[MarketService] Yahoo Indices failed, trying backup...');
        return await fetchIndicesBackup();
    }

    return validResults;
}

// Backup: Scrape Google Finance for key indices (Fragile, use only as backup)
async function fetchIndicesBackup() {
    const BACKUP_MAP = {
        'NIFTY 50': 'INDEXNSE:NIFTY_50',
        'SENSEX': 'INDEXBOM:SENSEX'
    };

    try {
        const promises = Object.entries(BACKUP_MAP).map(async ([name, symbol]) => {
            // Using a simple proxy to get HTML
            const url = `https://www.google.com/finance/quote/${symbol}`;
            const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
            const resp = await fetch(proxyUrl);
            const text = await resp.text();

            // Very simple regex to find price (meta tag or specific class often works)
            // Looking for <div class="YMlKec fxKbKc">23,456.78</div> pattern common in Google Finance
            const priceMatch = text.match(/<div[^>]*class="[^"]*YMlKec[^"]*"[^>]*>([^<]+)<\/div>/);

            if (priceMatch && priceMatch[1]) {
                const priceStr = priceMatch[1].replace(/,/g, '');
                const price = parseFloat(priceStr);
                return {
                    name,
                    symbol,
                    value: price.toLocaleString('en-IN'),
                    change: '0.00', // Hard to parse reliably without full DOM
                    changePercent: '0.00',
                    direction: 'neutral',
                    currency: '₹',
                    timestamp: Date.now(),
                    source: 'Google (Backup)'
                };
            }
            return null;
        });

        const results = await Promise.all(promises);
        return results.filter(r => r !== null);
    } catch (e) {
        console.error('Backup indices fetch failed', e);
        return [];
    }
}

// ============================================
// 2. MUTUAL FUNDS (mfapi.in - FREE, no key)
// ============================================

const MF_API = 'https://api.mfapi.in/mf/';

// Popular scheme codes
const POPULAR_MF_SCHEMES = [
    { code: '119551', name: 'SBI Bluechip Fund' },
    { code: '120503', name: 'HDFC Mid-Cap Opportunities' },
    { code: '118834', name: 'ICICI Prudential Value Discovery' },
    { code: '122639', name: 'Axis Long Term Equity Fund' },
    { code: '125354', name: 'Mirae Asset Large Cap Fund' },
    { code: '118989', name: 'Kotak Emerging Equity Fund' }
];

export async function fetchMutualFunds() {
    console.log('[MarketService] Fetching Mutual Fund NAVs...');

    const results = await Promise.allSettled(
        POPULAR_MF_SCHEMES.map(async (scheme) => {
            const response = await fetch(`${MF_API}${scheme.code}`);
            const data = await response.json();

            if (!data.data || data.data.length === 0) {
                throw new Error('No NAV data');
            }

            const latestNAV = parseFloat(data.data[0].nav);
            const prevNAV = data.data.length > 1 ? parseFloat(data.data[1].nav) : latestNAV;
            const change = latestNAV - prevNAV;
            const changePercent = ((change / prevNAV) * 100).toFixed(2);

            return {
                code: scheme.code,
                name: data.meta?.scheme_name || scheme.name,
                category: data.meta?.scheme_category || 'Equity',
                fundHouse: data.meta?.fund_house || 'Unknown',
                nav: latestNAV.toFixed(2),
                navDate: data.data[0].date,
                change: change.toFixed(2),
                changePercent: changePercent,
                direction: change >= 0 ? 'up' : 'down'
            };
        })
    );

    const successful = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);

    return successful;
}

// ============================================
// 3. IPO DATA (Scraping ipowatch.in)
// ============================================

export async function fetchIPOData() {
    console.log('[MarketService] Fetching IPO data from IPOWatch...');
    const targetUrl = 'https://ipowatch.in/upcoming-ipo-calendar-ipo-list/';
    // Using AllOrigins to get HTML
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Proxy failed');

        const json = await response.json();
        const html = json.contents;

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Find the main table (Updated logic for 2026 format)
        // Table often contains "IPO" and "Price" in header
        const tables = doc.querySelectorAll('table');
        let table = null;

        for (const t of tables) {
            const text = t.textContent.toLowerCase();
            if ((text.includes('ipo') && text.includes('price')) || text.includes('ipo name')) {
                table = t;
                break;
            }
        }

        if (!table) throw new Error('No IPO table found');

        const rows = Array.from(table.querySelectorAll('tr'));
        const ipos = [];

        // Parse rows (Skip header)
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].querySelectorAll('td');
            // Expecting at least 4 cols: Name, Status, Date, Price
            if (cols.length < 3) continue;

            const name = cols[0]?.textContent?.trim() || 'Unknown';
            // Column 1 is usually Status in new layout ("Upcoming", "Closed")
            // But sometimes it might be old layout. Let's heuristic.

            let statusRaw = 'Upcoming';
            let dateRaw = 'TBA';

            // Check if Col 1 is a date or status
            const col1Text = cols[1]?.textContent?.trim();
            const col2Text = cols[2]?.textContent?.trim();

            if (col1Text) statusRaw = col1Text;
            if (col2Text) dateRaw = col2Text;

            // Determine standardized status
            let status = 'upcoming';
            const lowerStatus = statusRaw.toLowerCase();
            if (lowerStatus.includes('live') || lowerStatus.includes('open')) {
                status = 'live';
            } else if (lowerStatus.includes('close')) {
                status = 'recent';
            } else if (lowerStatus.includes('upcoming')) {
                status = 'upcoming';
            }

            const isSME = name.includes('SME') || table.textContent.includes('SME');

            ipos.push({
                name,
                openDate: dateRaw,
                closeDate: '',
                status,
                isSME,
                issueSize: '-'
            });
        }

        // Categorize
        const upcoming = ipos.filter(i => i.status === 'upcoming').slice(0, 5);
        const live = ipos.filter(i => i.status === 'live');
        const recent = ipos.filter(i => i.status === 'recent').slice(0, 5);

        return {
            upcoming: upcoming.length ? upcoming : ipos.slice(0, 3),
            live: live,
            recent: recent.length ? recent : ipos.slice(3, 6),
            fetchedAt: Date.now()
        };

    } catch (err) {
        console.error('[MarketService] IPO Fetch Failed:', err);
        return {
            upcoming: [],
            live: [],
            recent: [],
            fetchedAt: Date.now(),
            error: err.message
        };
    }
}

// ============================================
// 4. MARKET MOVERS (Gainers/Losers)
// ============================================

const SCREENER_URL = 'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved/screener/new?scrIds=day_gainers&count=5';
const SCREENER_URL_LOSERS = 'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved/screener/new?scrIds=day_losers&count=5';

async function fetchScreenerData(url) {
    const PROXY = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

    try {
        const response = await fetch(PROXY);
        if (!response.ok) return [];

        const data = await response.json();
        const results = data.finance?.result?.[0]?.quotes || [];

        return results.map(quote => ({
            symbol: quote.symbol.replace('.NS', '').replace('.BO', ''),
            price: quote.regularMarketPrice?.toFixed(2) || '0.00',
            change: quote.regularMarketChange?.toFixed(2) || '0.00',
            changePercent: quote.regularMarketChangePercent?.toFixed(2) || '0.00',
            direction: (quote.regularMarketChange || 0) >= 0 ? 'up' : 'down',
            volume: quote.regularMarketVolume
        })).filter(q => q.symbol);
    } catch (e) {
        console.warn('[MarketService] Screener fetch failed:', e);
        return [];
    }
}

// Fallback: Use the static list if screener fails (Original Logic)
const TOP_STOCKS = [
    'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS',
    'HINDUNILVR.NS', 'SBIN.NS', 'BHARTIARTL.NS', 'ITC.NS', 'KOTAKBANK.NS',
    'LT.NS', 'AXISBANK.NS', 'ASIANPAINT.NS', 'MARUTI.NS', 'BAJFINANCE.NS'
];

async function fetchTopMoversFallback() {
    console.log('[MarketService] Using fallback for movers...');
    const promises = TOP_STOCKS.slice(0, 10).map(async (symbol) => {
        try {
            const data = await fetchYahooData(symbol);
            const priceData = extractYahooPrice(data);
            if (!priceData) return null;
            return {
                symbol: symbol.replace('.NS', ''),
                price: priceData.price.toFixed(2),
                change: priceData.change.toFixed(2),
                changePercent: parseFloat(priceData.changePercent),
                direction: priceData.change >= 0 ? 'up' : 'down'
            };
        } catch (err) { return null; }
    });

    const results = await Promise.all(promises);
    const valid = results.filter(r => r !== null);
    const sorted = valid.sort((a, b) => b.changePercent - a.changePercent);

    return {
        gainers: sorted.filter(s => s.changePercent > 0).slice(0, 5),
        losers: sorted.filter(s => s.changePercent < 0).slice(-5).reverse()
    };
}

export async function fetchTopMovers() {
    console.log('[MarketService] Fetching top movers...');
    const settings = getSettings();
    const avKey = settings.alphaVantageKey;

    if (avKey) {
        try {
            console.log('[MarketService] Trying Alpha Vantage for Movers...');
            const avData = await fetchAlphaVantage('TOP_GAINERS_LOSERS', '', avKey);
            if (avData && avData.top_gainers && avData.top_losers) {
                const parseAV = (list) => list.slice(0, 5).map(item => ({
                    symbol: item.ticker,
                    price: parseFloat(item.price).toFixed(2),
                    change: parseFloat(item.change_amount).toFixed(2),
                    changePercent: parseFloat(item.change_percentage.replace('%','')).toFixed(2),
                    direction: parseFloat(item.change_amount) >= 0 ? 'up' : 'down'
                }));

                return {
                    gainers: parseAV(avData.top_gainers),
                    losers: parseAV(avData.top_losers)
                };
            }
        } catch (e) {
            console.warn('[MarketService] Alpha Vantage failed:', e);
        }
    }

    try {
        const [gainers, losers] = await Promise.all([
            fetchScreenerData(SCREENER_URL),
            fetchScreenerData(SCREENER_URL_LOSERS)
        ]);

        if (gainers.length > 0 || losers.length > 0) {
            console.log('[MarketService] ✅ Used Screener API');
            return {
                gainers: gainers.slice(0, 5),
                losers: losers.slice(0, 5)
            };
        }
    } catch (e) {
        console.warn('[MarketService] Screener API failed, trying fallback...');
    }

    return await fetchTopMoversFallback();
}

// ============================================
// 5. SECTORAL INDICES (Phase 2)
// ============================================

export async function fetchSectoralIndices() {
    console.log('[MarketService] Fetching sectoral indices...');

    const sectorals = [
        { key: 'niftyBank', name: 'Bank Nifty', symbol: INDICES.niftyBank },
        { key: 'niftyIT', name: 'Nifty IT', symbol: INDICES.niftyIT },
        { key: 'niftyPharma', name: 'Nifty Pharma', symbol: INDICES.niftyPharma },
        { key: 'niftyAuto', name: 'Nifty Auto', symbol: INDICES.niftyAuto }
    ];

    const results = await Promise.allSettled(
        sectorals.map(async (sector) => {
            const data = await fetchYahooData(sector.symbol);
            const priceData = extractYahooPrice(data);

            if (!priceData) throw new Error('No data');

            return {
                name: sector.name,
                value: priceData.price.toFixed(2),
                change: priceData.change.toFixed(2),
                changePercent: priceData.changePercent,
                timestamp: priceData.timestamp
            };
        })
    );

    return results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
}

// ============================================
// 6. COMMODITIES
// ============================================

export async function fetchCommodities() {
    console.log('[MarketService] Fetching commodities...');

    try {
        const usdInrData = await fetchYahooData('INR=X');
        const usdPriceData = extractYahooPrice(usdInrData);
        const usdRate = usdPriceData ? usdPriceData.price : 84.0;

        const commoditiesList = [
            { name: 'Gold', symbol: 'GC=F', type: 'gold' },
            { name: 'Silver', symbol: 'SI=F', type: 'silver' },
            { name: 'Crude Oil', symbol: 'CL=F', type: 'crude' }
        ];

        const results = await Promise.allSettled(
            commoditiesList.map(async (commodity) => {
                let priceData = null;
                try {
                    const data = await fetchYahooData(commodity.symbol);
                    priceData = extractYahooPrice(data);
                } catch (e) {
                    console.warn(`[MarketService] Failed to fetch ${commodity.name} (${commodity.symbol})`);
                }

                if (!priceData) throw new Error('No data');

                let value, change, unit;

                if (commodity.type === 'gold') {
                    value = ((priceData.price * usdRate) / 31.1035) * 10;
                    change = ((priceData.change * usdRate) / 31.1035) * 10;
                    unit = '₹/10g';
                } else if (commodity.type === 'silver') {
                    value = ((priceData.price * usdRate) / 31.1035) * 1000;
                    change = ((priceData.change * usdRate) / 31.1035) * 1000;
                    unit = '₹/kg';
                } else {
                    value = priceData.price * usdRate;
                    change = priceData.change * usdRate;
                    unit = '₹/bbl';
                }

                return {
                    name: commodity.name,
                    value: value.toFixed(2),
                    change: change.toFixed(2),
                    changePercent: priceData.changePercent,
                    unit: unit,
                    direction: change >= 0 ? 'up' : 'down',
                    timestamp: priceData.timestamp
                };
            })
        );

        return results
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);

    } catch (error) {
        return [];
    }
}

// ============================================
// 7. CURRENCY RATES
// ============================================

export async function fetchCurrencyRates() {
    console.log('[MarketService] Fetching currency rates...');

    const currencies = [
        { name: 'USD/INR', symbol: 'INR=X' },
        { name: 'OMR/INR', symbol: 'OMRINR=X' }
    ];

    const yahooPromises = currencies.map(async (currency) => {
        try {
            const data = await fetchYahooData(currency.symbol);
            const priceData = extractYahooPrice(data);
            if (!priceData) throw new Error('No data');
            return {
                name: currency.name,
                value: priceData.price.toFixed(2),
                change: priceData.change.toFixed(2),
                changePercent: priceData.changePercent,
                timestamp: priceData.timestamp,
                source: 'yahoo'
            };
        } catch (e) {
            return null;
        }
    });

    const yahooResults = await Promise.all(yahooPromises);
    const validYahoo = yahooResults.filter(r => r !== null);
    if (validYahoo.length === currencies.length) {
        return validYahoo;
    }

    console.log('[MarketService] ⚠️ Yahoo Currency failed, using fallback...');
    try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await response.json();

        if (!data || !data.rates) throw new Error('Fallback API failed');

        const inr = data.rates.INR;
        const omr = data.rates.OMR;

        const fallbackResults = [];

        fallbackResults.push({
            name: 'USD/INR',
            value: inr.toFixed(2),
            change: '0.00',
            changePercent: '0.00',
            timestamp: Date.now(),
            source: 'fallback'
        });

        if (omr) {
            const omrInr = inr / omr;
            fallbackResults.push({
                name: 'OMR/INR',
                value: omrInr.toFixed(2),
                change: '0.00',
                changePercent: '0.00',
                timestamp: Date.now(),
                source: 'fallback'
            });
        }

        return fallbackResults;

    } catch (e) {
        console.error('[MarketService] ❌ All currency sources failed:', e);
        return validYahoo;
    }
}

// ============================================
// 8. FII/DII ACTIVITY (Mock)
// ============================================

export async function fetchFIIDII() {
    return {
        fii: { buy: 12500.5, sell: 11800.3, net: 700.2 },
        dii: { buy: 8900.7, sell: 9200.4, net: -299.7 },
        date: new Date().toISOString().split('T')[0]
    };
}

// ============================================
// 9. COMBINED FETCH
// ============================================

const CACHE_KEY = 'indian_market_data';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

export async function fetchStaticSnapshot() {
    try {
        const resp = await fetch('/data/market_snapshot.json');
        if (resp.ok) {
            return await resp.json();
        }
    } catch (e) {
        console.warn('[MarketService] Failed to load static snapshot', e);
    }
    return null;
}

export async function fetchAllMarketData() {
    console.log('[MarketService] 🚀 Fetching all market data...');

    // Attempt fresh fetch
    const [indices, mutualFunds, ipoData, movers, sectorals, commodities, currencies, fiidii] = await Promise.allSettled([
        fetchIndices(),
        fetchMutualFunds(),
        fetchIPOData(),
        fetchTopMovers(),
        fetchSectoralIndices(),
        fetchCommodities(),
        fetchCurrencyRates(),
        fetchFIIDII()
    ]);

    const result = {
        indices: indices.status === 'fulfilled' ? indices.value : [],
        mutualFunds: mutualFunds.status === 'fulfilled' ? mutualFunds.value : [],
        ipo: ipoData.status === 'fulfilled' ? ipoData.value : { upcoming: [], live: [], recent: [] },
        movers: movers.status === 'fulfilled' ? movers.value : { gainers: [], losers: [] },
        sectorals: sectorals.status === 'fulfilled' ? sectorals.value : [],
        commodities: commodities.status === 'fulfilled' ? commodities.value : [],
        currencies: currencies.status === 'fulfilled' ? currencies.value : [],
        fiidii: fiidii.status === 'fulfilled' ? fiidii.value : { fii: {}, dii: {}, date: '' },
        fetchedAt: Date.now(),
        errors: {
            indices: indices.status === 'rejected' ? indices.reason?.message : null
        }
    };

    // Robustness Check: If indices are present, we consider it a success and cache it
    if (result.indices.length > 0) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(result));
            console.log('[MarketService] ✅ Fresh data cached');
        } catch (e) {
            console.warn('[MarketService] Cache write failed', e);
        }
        return result;
    }

    // Critical Failure Handling: Missing Indices
    console.warn('[MarketService] Critical data (Indices) missing. Checking cache...');

    // 1. Try LocalStorage Cache
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            const age = Date.now() - (parsed.fetchedAt || 0);
            if (age < CACHE_TTL) {
                console.log(`[MarketService] ⚠️ Returning cached data (${(age/60000).toFixed(0)} mins old)`);
                return {
                    ...parsed,
                    isStale: true,
                    staleReason: 'Network/Proxy Failure - Showing cached data'
                };
            } else {
                console.warn('[MarketService] Cache expired');
            }
        }
    } catch (e) {
        console.error('[MarketService] Cache read failed', e);
    }

    // 2. Try Static Snapshot
    console.warn('[MarketService] Cache unavailable/expired. Attempting static snapshot...');
    const snapshot = await fetchStaticSnapshot();
    if (snapshot) {
        console.log('[MarketService] ✅ Loaded snapshot data');
        return {
            ...snapshot,
            isSnapshot: true,
            fetchedAt: snapshot.generated_at ? new Date(snapshot.generated_at).getTime() : Date.now()
        };
    }

    // 3. Return partial/empty result if all else fails
    return result;
}

export default {
    fetchAllMarketData,
    fetchStaticSnapshot,
    fetchIndices,
    fetchMutualFunds,
    fetchIPOData,
    fetchTopMovers,
    fetchSectoralIndices,
    fetchCommodities,
    fetchCurrencyRates,
    fetchFIIDII
};
