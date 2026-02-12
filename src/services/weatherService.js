/**
 * Multi-Model Weather Service
 * Fetches data from 3 weather models via Open-Meteo API:
 * - ECMWF IFS (European, highest accuracy)
 * - GFS (NOAA, strong precipitation)
 * - ICON (DWD Germany, excellent global coverage)
 * 
 * NO MOCK DATA - Returns null/error on failure
 */

import {
    calculateRainfallConsensus,
    averageTemperature,
    averageApparentTemperature,
    getMostCommonWeatherCode,
    averagePrecipitation,
    getSuccessfulModels,
    formatModelNames
} from '../utils/multiModelUtils.js';
import { getSettings } from '../utils/storage.js';
import logStore from '../utils/logStore.js';
import { getWeatherIconId } from '../utils/weatherUtils.js';

// Model-specific API endpoints
const MODELS = {
    ecmwf: 'https://api.open-meteo.com/v1/ecmwf',
    gfs: 'https://api.open-meteo.com/v1/gfs',
    icon: 'https://api.open-meteo.com/v1/dwd-icon'
};

// Coordinates for key cities
const LOCATIONS = {
    chennai: { lat: 13.0827, lon: 80.2707 },
    trichy: { lat: 10.7905, lon: 78.7047 },
    muscat: { lat: 23.5859, lon: 58.4059 }
};

/**
 * Resolve location coordinates
 * Checks local constant first, then geocoding API
 */
async function resolveLocation(cityName) {
    const key = cityName.toLowerCase();

    // Check static list
    if (LOCATIONS[key]) {
        return LOCATIONS[key];
    }

    // Check cache
    try {
        const cache = JSON.parse(localStorage.getItem('weather_geo_cache') || '{}');
        if (cache[key]) {
            return cache[key];
        }
    } catch (e) {
        console.warn('Geocode cache read failed');
    }

    // Fetch from Open-Meteo Geocoding API
    try {
        console.log(`[WeatherService] Geocoding ${cityName}...`);
        const resp = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`);
        const data = await resp.json();

        if (data.results && data.results.length > 0) {
            const loc = { lat: data.results[0].latitude, lon: data.results[0].longitude };

            // Save to cache
            try {
                const cache = JSON.parse(localStorage.getItem('weather_geo_cache') || '{}');
                cache[key] = loc;
                localStorage.setItem('weather_geo_cache', JSON.stringify(cache));
            } catch (e) { /* ignore */ }

            return loc;
        }
    } catch (e) {
        console.error('Geocoding failed:', e);
    }

    throw new Error(`Location not found: ${cityName}`);
}

/**
 * Fetch weather from a single model
 * @param {string} modelName - 'ecmwf', 'gfs', or 'icon'
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Raw weather data from model
 */
async function fetchSingleModel(modelName, lat, lon) {
    const baseUrl = MODELS[modelName];

    if (!baseUrl) {
        throw new Error(`Unknown model: ${modelName}`);
    }

    const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        current: 'temperature_2m,weather_code,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m',
        hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,uv_index,cloud_cover,visibility,dew_point_2m',
        daily: 'precipitation_probability_max,precipitation_sum,uv_index_max',
        timezone: 'auto'
    });

    const url = `${baseUrl}?${params}`;

    console.log(`[WeatherService] Fetching ${modelName.toUpperCase()}...`);

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`${modelName.toUpperCase()} API request failed: ${response.status}`);
    }

    const data = await response.json();

    console.log(`[WeatherService] ✅ ${modelName.toUpperCase()}: Success`);

    return data;
}

/**
 * Fetch weather from all 3 models for a specific location
 * @param {string} locationKey - 'chennai', 'trichy', 'muscat'
 * @returns {Promise<Object>} Multi-model weather data object
 */
export async function fetchWeather(locationKey) {
    const _t0 = Date.now();

    let lat, lon;
    try {
        const coords = await resolveLocation(locationKey);
        lat = coords.lat;
        lon = coords.lon;
    } catch (e) {
        throw new Error(`Unknown location: ${locationKey}`);
    }

    // Get enabled models from settings
    const settings = getSettings();
    const modelSettings = settings.weather?.models || { ecmwf: true, gfs: true, icon: true };

    // Filter to only enabled models
    const enabledModelNames = Object.keys(MODELS).filter(m => modelSettings[m] !== false);

    if (enabledModelNames.length === 0) {
        console.warn('[WeatherService] No models enabled, using all models');
        enabledModelNames.push('ecmwf', 'gfs', 'icon');
    }

    console.log(`[WeatherService] Fetching from models: ${enabledModelNames.join(', ')}`);

    try {
        // Fetch from enabled models in parallel
        const results = await Promise.allSettled(
            enabledModelNames.map(model => fetchSingleModel(model, lat, lon))
        );

        // Extract successful results dynamically
        const modelData = {};
        enabledModelNames.forEach((modelName, index) => {
            modelData[modelName] = results[index].status === 'fulfilled' ? results[index].value : null;
            if (results[index].status === 'rejected') {
                console.warn(`[WeatherService] ⚠️ ${modelName.toUpperCase()} failed:`, results[index].reason?.message);
            }
        });

        // Check if at least one model succeeded
        const successfulModels = getSuccessfulModels(modelData);

        if (successfulModels.length === 0) {
            throw new Error('All weather models failed to fetch data');
        }

        const _dur = Date.now() - _t0;
        console.log(`[WeatherService] ✅ ${successfulModels.length}/${enabledModelNames.length} models succeeded: ${formatModelNames(successfulModels)}`);
        logStore.success('weather', `${locationKey}: ${successfulModels.length}/${enabledModelNames.length} models OK`, { durationMs: _dur });

        // Process and combine data
        return processMultiModelData(modelData, locationKey);

    } catch (error) {
        console.error(`[WeatherService] ❌ Error fetching weather for ${locationKey}:`, error);
        logStore.error('weather', `${locationKey}: ${error.message}`, { durationMs: Date.now() - _t0 });
        throw error;
    }
}

/**
 * Process raw multi-model data into app format
 */
function processMultiModelData(modelData, locationName) {
    // Get current data from all models
    const currentData = [
        modelData.ecmwf?.current,
        modelData.gfs?.current,
        modelData.icon?.current
    ].filter(Boolean);

    // Weather codes to SVG icon IDs (time-aware)
    const getIconForHour = (code, hour) => getWeatherIconId(code, hour ?? new Date().getHours());
    // Backward-compat emoji fallback
    const getIcon = (code) => {
        if (code <= 1) return '☀️';
        if (code <= 3) return '⛅';
        if (code <= 67) return '🌧️';
        if (code <= 99) return '⛈️';
        return '❓';
    };

    const conditionMap = {
        0: 'Clear', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
        45: 'Fog', 48: 'Fog',
        51: 'Light Drizzle', 61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
        80: 'Rain Showers', 95: 'Thunderstorm'
    };

    const getCondition = (code) => conditionMap[code] || 'Unknown';

    // Helper to get segment metrics from multiple models
    const getSegmentMetrics = (startHour, endHour) => {
        const indices = [];
        for (let i = startHour; i <= endHour; i++) indices.push(i);

        // Collect data from all available models
        const allModelHourlyData = [];

        if (modelData.ecmwf?.hourly) allModelHourlyData.push(modelData.ecmwf.hourly);
        if (modelData.gfs?.hourly) allModelHourlyData.push(modelData.gfs.hourly);
        if (modelData.icon?.hourly) allModelHourlyData.push(modelData.icon.hourly);

        // Track per-model probabilities for consensus check (Spread Calculation)
        const modelProbs = {};

        // Average temperatures across models for this time segment
        const segmentTemps = [];
        const segmentApparent = [];
        const segmentPrecip = [];
        const segmentPrecipProb = [];
        const segmentWeatherCodes = [];
        const segmentHumidity = [];
        const segmentWindSpeed = [];
        const segmentUV = [];
        const segmentCloud = [];

        indices.forEach(hourIdx => {
            // Collect for model spread calculation
            if (modelData.ecmwf?.hourly?.precipitation_probability?.[hourIdx] != null) {
                if (!modelProbs.ecmwf) modelProbs.ecmwf = [];
                modelProbs.ecmwf.push(modelData.ecmwf.hourly.precipitation_probability[hourIdx]);
            }
            if (modelData.gfs?.hourly?.precipitation_probability?.[hourIdx] != null) {
                if (!modelProbs.gfs) modelProbs.gfs = [];
                modelProbs.gfs.push(modelData.gfs.hourly.precipitation_probability[hourIdx]);
            }
            if (modelData.icon?.hourly?.precipitation_probability?.[hourIdx] != null) {
                if (!modelProbs.icon) modelProbs.icon = [];
                modelProbs.icon.push(modelData.icon.hourly.precipitation_probability[hourIdx]);
            }

            const hourData = allModelHourlyData.map(hourly => ({
                modelName: hourly._modelName, // Inject model name for weighting
                temperature_2m: hourly.temperature_2m?.[hourIdx],
                apparent_temperature: hourly.apparent_temperature?.[hourIdx],
                precipitation: hourly.precipitation?.[hourIdx],
                precipitation_probability: hourly.precipitation_probability?.[hourIdx],
                weather_code: hourly.weather_code?.[hourIdx],
                relative_humidity_2m: hourly.relative_humidity_2m?.[hourIdx],
                wind_speed_10m: hourly.wind_speed_10m?.[hourIdx],
                uv_index: hourly.uv_index?.[hourIdx],
                cloud_cover: hourly.cloud_cover?.[hourIdx]
            }));

            const avgTemp = averageTemperature(hourData);
            const avgApparent = averageApparentTemperature(hourData);
            const avgPrecip = averagePrecipitation(hourData);
            const weatherCode = getMostCommonWeatherCode(hourData);

            if (avgTemp !== null) segmentTemps.push(avgTemp);
            if (avgApparent !== null) segmentApparent.push(avgApparent);
            if (avgPrecip !== null) segmentPrecip.push(avgPrecip);
            if (weatherCode !== null) segmentWeatherCodes.push(weatherCode);

            // Collect precipitation probabilities for consensus
            hourData.forEach(d => {
                if (d.precipitation_probability != null) {
                    segmentPrecipProb.push({ precipitation_probability: d.precipitation_probability });
                }
                if (d.relative_humidity_2m != null) segmentHumidity.push(d.relative_humidity_2m);
                if (d.wind_speed_10m != null) segmentWindSpeed.push(d.wind_speed_10m);
                if (d.uv_index != null) segmentUV.push(d.uv_index);
                if (d.cloud_cover != null) segmentCloud.push(d.cloud_cover);
            });
        });

        const avgTemp = segmentTemps.length > 0
            ? Math.round(segmentTemps.reduce((a, b) => a + b, 0) / segmentTemps.length)
            : null;

        const feelsLike = segmentApparent.length > 0
            ? Math.round(segmentApparent.reduce((a, b) => a + b, 0) / segmentApparent.length)
            : avgTemp;

        const totalRainVal = segmentPrecip.reduce((a, b) => a + b, 0);

        // Calculate rainfall consensus
        const rainfallConsensus = calculateRainfallConsensus(segmentPrecipProb);

        // Calculate Model Spread (Variation)
        const modelAverages = [];
        Object.values(modelProbs).forEach(probs => {
            if (probs.length > 0) {
                const avg = Math.round(probs.reduce((a, b) => a + b, 0) / probs.length);
                modelAverages.push(avg);
            }
        });

        let probSpread = 0;
        let minModelAvg = 0;
        let maxModelAvg = 0;
        if (modelAverages.length > 0) {
            minModelAvg = Math.min(...modelAverages);
            maxModelAvg = Math.max(...modelAverages);
            probSpread = maxModelAvg - minModelAvg;
        }

        let rainDisplay = totalRainVal.toFixed(1) + 'mm';

        // Display '-' if rainfall is negligible (< 1mm)
        if (totalRainVal < 1.0) {
            rainDisplay = '-';
        }

        // Get representative weather code (most common)
        const midCode = segmentWeatherCodes.length > 0
            ? segmentWeatherCodes[Math.floor(segmentWeatherCodes.length / 2)]
            : 0;

        const icon = getIcon(midCode);
        const midHour = Math.floor((startHour + endHour) / 2) % 24;
        const iconId = getIconForHour(midCode, midHour);

        // Additional metrics
        const avgHumidity = segmentHumidity.length > 0
            ? Math.round(segmentHumidity.reduce((a, b) => a + b, 0) / segmentHumidity.length)
            : null;

        const avgWindSpeed = segmentWindSpeed.length > 0
            ? Math.round(segmentWindSpeed.reduce((a, b) => a + b, 0) / segmentWindSpeed.length)
            : null;

        const maxUV = segmentUV.length > 0 ? Math.max(...segmentUV) : null;

        const avgCloud = segmentCloud.length > 0
            ? Math.round(segmentCloud.reduce((a, b) => a + b, 0) / segmentCloud.length)
            : null;

        // Collect hourly breakdown for this segment
        const hourlyBreakdown = indices.map((hourIdx, i) => {
            // Use the first successful model's data for hourly visualization to ensure consistency
            // Default to ECMWF if available, else GFS, else ICON
            const modelKey = modelData.ecmwf ? 'ecmwf' : (modelData.gfs ? 'gfs' : 'icon');
            const hourly = modelData[modelKey]?.hourly;

            if (!hourly) return null;

            const t = hourly.temperature_2m?.[hourIdx];
            const p = hourly.precipitation?.[hourIdx];
            const prob = hourly.precipitation_probability?.[hourIdx];
            const code = hourly.weather_code?.[hourIdx];

            // Format label: 12p, 3p, etc.
            const h = hourIdx % 24;
            const period = h >= 12 ? 'p' : 'a';
            const hour12 = h % 12 === 0 ? 12 : h % 12;
            const timeLabel = `${hour12}${period}`;

            return {
                time: timeLabel,
                temp: t,
                precip: p,
                prob: prob,
                icon: getIcon(code),
                iconId: getIconForHour(code, hourIdx % 24)
            };
        }).filter(Boolean);

        return {
            temp: avgTemp,
            feelsLike: feelsLike,
            icon: icon,
            iconId: iconId,
            rainMm: rainDisplay,
            rainProb: rainfallConsensus || { avg: 0, min: 0, max: 0, displayString: '~0%', isWideRange: false },
            probSpread,
            minModelAvg,
            maxModelAvg,
            humidity: avgHumidity,
            windSpeed: avgWindSpeed,
            uvIndex: maxUV,
            cloudCover: avgCloud,
            hourly: hourlyBreakdown
        };
    };

    // Helper to extract segments for a specific day offset (0 = today, 1 = tomorrow)
    const getDaySegments = (dayOffset) => {
        const offset = dayOffset * 24;
        return {
            morning: getSegmentMetrics(6 + offset, 11 + offset),
            noon: getSegmentMetrics(12 + offset, 16 + offset),
            evening: getSegmentMetrics(17 + offset, 22 + offset)
        };
    };

    const today = getDaySegments(0);
    const tomorrow = getDaySegments(1);

    // Current weather (averaged from all models)
    const currentTemp = averageTemperature(currentData);
    const currentFeelsLike = averageApparentTemperature(currentData);
    const currentWeatherCode = getMostCommonWeatherCode(currentData);

    // Get additional current metrics
    const currentHumidity = currentData.length > 0 && currentData[0].relative_humidity_2m != null
        ? Math.round(currentData.reduce((sum, d) => sum + (d.relative_humidity_2m || 0), 0) / currentData.length)
        : null;

    const currentWindSpeed = currentData.length > 0 && currentData[0].wind_speed_10m != null
        ? Math.round(currentData.reduce((sum, d) => sum + (d.wind_speed_10m || 0), 0) / currentData.length)
        : null;

    const currentWindDirection = currentData.length > 0 && currentData[0].wind_direction_10m != null
        ? Math.round(currentData.reduce((sum, d) => sum + (d.wind_direction_10m || 0), 0) / currentData.length)
        : null;

    // Get daily max precipitation probability
    const dailyMaxPrecipProb = [
        modelData.ecmwf?.daily?.precipitation_probability_max?.[0],
        modelData.gfs?.daily?.precipitation_probability_max?.[0],
        modelData.icon?.daily?.precipitation_probability_max?.[0]
    ].filter(v => v != null);

    const maxPrecipProb = dailyMaxPrecipProb.length > 0
        ? Math.round(dailyMaxPrecipProb.reduce((a, b) => a + b, 0) / dailyMaxPrecipProb.length)
        : 0;

    // Get daily precipitation sum
    const dailyPrecipSum = [
        modelData.ecmwf?.daily?.precipitation_sum?.[0],
        modelData.gfs?.daily?.precipitation_sum?.[0],
        modelData.icon?.daily?.precipitation_sum?.[0]
    ].filter(v => v != null);

    const totalPrecip = dailyPrecipSum.length > 0
        ? (dailyPrecipSum.reduce((a, b) => a + b, 0) / dailyPrecipSum.length).toFixed(1)
        : 0;

    // Get UV index max
    const dailyUVMax = [
        modelData.ecmwf?.daily?.uv_index_max?.[0],
        modelData.gfs?.daily?.uv_index_max?.[0],
        modelData.icon?.daily?.uv_index_max?.[0]
    ].filter(v => v != null);

    const maxUV = dailyUVMax.length > 0
        ? Math.round(dailyUVMax.reduce((a, b) => a + b, 0) / dailyUVMax.length)
        : null;

    const successfulModels = getSuccessfulModels(modelData);

    // Build 24-hour forecast from current hour (8 slots, every 3 hours)
    // Uses cross-model averaging for each slot
    const currentHour = new Date().getHours();
    const allModelHourly = [];
    if (modelData.ecmwf?.hourly) allModelHourly.push(modelData.ecmwf.hourly);
    if (modelData.gfs?.hourly) allModelHourly.push(modelData.gfs.hourly);
    if (modelData.icon?.hourly) allModelHourly.push(modelData.icon.hourly);

    const hourly24 = [];
    // Also generate next 8 hours specifically for quick summary (hour-by-hour)
    const next8Hours = [];

    // Format label: 12p, 3p, etc.
    const formatHourShort = (h) => {
        const period = h >= 12 ? 'p' : 'a';
        const hour12 = h % 12 === 0 ? 12 : h % 12;
        return `${hour12}${period}`;
    };

    // Helper to get averaged data for a specific hour offset
    const getHourlyData = (offset) => {
        const hourIdx = currentHour + offset;
        const displayHour = (currentHour + offset) % 24;

        const temps = allModelHourly.map(h => h.temperature_2m?.[hourIdx]).filter(v => v != null);
        const precips = allModelHourly.map(h => h.precipitation?.[hourIdx]).filter(v => v != null);
        const probs = allModelHourly.map(h => h.precipitation_probability?.[hourIdx]).filter(v => v != null);
        const codes = allModelHourly.map(h => h.weather_code?.[hourIdx]).filter(v => v != null);
        const clouds = allModelHourly.map(h => h.cloud_cover?.[hourIdx]).filter(v => v != null);

        const avgTemp = temps.length > 0 ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null;
        const avgPrecip = precips.length > 0 ? parseFloat((precips.reduce((a, b) => a + b, 0) / precips.length).toFixed(1)) : 0;
        const avgProb = probs.length > 0 ? Math.round(probs.reduce((a, b) => a + b, 0) / probs.length) : 0;
        const code = codes.length > 0 ? codes[Math.floor(codes.length / 2)] : 0;
        const avgCloud = clouds.length > 0 ? Math.round(clouds.reduce((a, b) => a + b, 0) / clouds.length) : 0;

        // Format label: 12p, 3p, etc.
        const formatHourShort = (h) => {
            const period = h >= 12 ? 'p' : 'a';
            const hour12 = h % 12 === 0 ? 12 : h % 12;
            return `${hour12}${period}`;
        };

        return {
            hour: displayHour,
            label: offset === 0 ? 'Now' : formatHourShort(displayHour),
            temp: avgTemp,
            precip: avgPrecip,
            prob: avgProb,
            cloud: avgCloud,
            icon: getIcon(code),
            iconId: getIconForHour(code, displayHour),
            code: code
        };
    };

    // Populate hourly24 (every 3h)
    for (let offset = 0; offset < 24; offset += 3) {
        hourly24.push(getHourlyData(offset));
    }

    // Populate next8Hours (every 1h)
    for (let offset = 0; offset < 8; offset++) {
        next8Hours.push(getHourlyData(offset));
    }

    // High/Low Temperature Calculation
    // Use the max/min from the next 24 hours of hourly data if daily max/min is missing or unreliable
    const dailyMaxTemp = [
        modelData.ecmwf?.daily?.temperature_2m_max?.[0],
        modelData.gfs?.daily?.temperature_2m_max?.[0],
        modelData.icon?.daily?.temperature_2m_max?.[0]
    ].filter(v => v != null);

    const dailyMinTemp = [
        modelData.ecmwf?.daily?.temperature_2m_min?.[0],
        modelData.gfs?.daily?.temperature_2m_min?.[0],
        modelData.icon?.daily?.temperature_2m_min?.[0]
    ].filter(v => v != null);

    let highTemp = dailyMaxTemp.length > 0
        ? Math.round(dailyMaxTemp.reduce((a, b) => a + b, 0) / dailyMaxTemp.length)
        : null;

    let lowTemp = dailyMinTemp.length > 0
        ? Math.round(dailyMinTemp.reduce((a, b) => a + b, 0) / dailyMinTemp.length)
        : null;

    // Fallback: Estimate from hourly24 if API daily data is missing
    if (highTemp === null && hourly24.length > 0) {
        highTemp = Math.max(...hourly24.map(h => h.temp || -999));
        if (highTemp === -999) highTemp = null;
    }
    if (lowTemp === null && hourly24.length > 0) {
        lowTemp = Math.min(...hourly24.map(h => h.temp || 999));
        if (lowTemp === 999) lowTemp = null;
    }

    // Dynamic Summary Construction
    let summaryText = "";
    if (parseFloat(totalPrecip) > 0) {
        summaryText += `Today's max rain probability: ${maxPrecipProb}%. Total precip: ${totalPrecip}mm. `;
    }
    summaryText += `Condition: ${getCondition(currentWeatherCode)}. UV Index: ${maxUV || 'N/A'}.`;

    return {
        name: locationName.charAt(0).toUpperCase() + locationName.slice(1),
        icon: locationName === 'muscat' ? '📍' : '🏛️',
        fetchedAt: Date.now(),
        models: {
            successful: successfulModels,
            count: successfulModels.length,
            names: formatModelNames(successfulModels)
        },
        current: {
            temp: currentTemp,
            feelsLike: currentFeelsLike,
            high: highTemp, // Added
            low: lowTemp,   // Added
            condition: getCondition(currentWeatherCode),
            icon: getIcon(currentWeatherCode),
            iconId: getIconForHour(currentWeatherCode, new Date().getHours()),
            humidity: currentHumidity,
            windSpeed: currentWindSpeed,
            windDirection: currentWindDirection
        },
        morning: today.morning,
        noon: today.noon,
        evening: today.evening,
        tomorrow: tomorrow,
        hourly24: hourly24,
        next8Hours: next8Hours,
        summary: summaryText
    };
}
