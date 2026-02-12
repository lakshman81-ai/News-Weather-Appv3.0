from nsepython import nse_quote, nse_get_index_quote
from datetime import datetime
import json
import os
import pandas as pd

# Constants
OUTPUT_FILE = 'public/data/market_snapshot.json'
INDICES_MAP = {
    'NIFTY 50': 'NIFTY 50',
    'NIFTY BANK': 'NIFTY BANK',
    'NIFTY IT': 'NIFTY IT'
}
# Stocks for Top Movers Mock/Snapshot
STOCKS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'ITC', 'BHARTIARTL', 'KOTAKBANK', 'LT']

def fetch_market_snapshot():
    print("[MarketSnapshot] Starting fetch using nsepython...")

    snapshot = {
        "indices": [],
        "movers": { "gainers": [], "losers": [] },
        "generated_at": pd.Timestamp.now().isoformat()
    }

    try:
        # 1. Fetch Indices
        for display_name, nse_symbol in INDICES_MAP.items():
            print(f"Fetching {display_name}...")
            try:
                # nse_get_index_quote returns JSON like { "name": "NIFTY 50", "lastPrice": 23000.00, "change": 120.00, "pChange": 0.52 ... }
                data = nse_get_index_quote(nse_symbol)

                if data and 'lastPrice' in data:
                    snapshot["indices"].append({
                        "name": display_name,
                        "value": f"{data.get('lastPrice', 0):.2f}",
                        "change": f"{data.get('change', 0):.2f}",
                        "changePercent": f"{data.get('pChange', 0):.2f}",
                        "direction": "up" if float(data.get('change', 0)) >= 0 else "down"
                    })
                else:
                    print(f"No data for {display_name}")
            except Exception as e:
                print(f"Error fetching {display_name}: {e}")

        # 2. Fetch Stocks (Mock Movers)
        # Real top movers require scanning all stocks which is slow. We scan top 10 heavyweights.
        stock_data = []
        for symbol in STOCKS:
            print(f"Fetching {symbol}...")
            try:
                # nse_quote returns complex JSON. We need priceInfo.
                q = nse_quote(symbol)
                if q and 'priceInfo' in q:
                    info = q['priceInfo']
                    change = info.get('change', 0)
                    pChange = info.get('pChange', 0)

                    stock_data.append({
                        "symbol": symbol,
                        "price": f"{info.get('lastPrice', 0):.2f}",
                        "change": f"{change:.2f}",
                        "changePercent": pChange,
                        "direction": "up" if change >= 0 else "down"
                    })
            except Exception as e:
                print(f"Error fetching {symbol}: {e}")

        # Sort and categorize
        if stock_data:
            stock_data.sort(key=lambda x: float(x['changePercent']), reverse=True)

            # Gainers: > 0
            gainers = [s for s in stock_data if float(s['changePercent']) > 0]
            # Losers: < 0
            losers = [s for s in stock_data if float(s['changePercent']) < 0]
            # Sort losers descending by magnitude (lowest first)
            losers.sort(key=lambda x: float(x['changePercent']))

            snapshot["movers"]["gainers"] = gainers[:5]
            snapshot["movers"]["losers"] = losers[:5]

            # Format percentages
            for s in snapshot["movers"]["gainers"] + snapshot["movers"]["losers"]:
                s["changePercent"] = f"{s['changePercent']:.2f}"

        # Save to file
        os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(snapshot, f, indent=2)

        print(f"[MarketSnapshot] Saved to {OUTPUT_FILE}")

    except Exception as e:
        print(f"[MarketSnapshot] Critical Error: {e}")

if __name__ == "__main__":
    fetch_market_snapshot()
