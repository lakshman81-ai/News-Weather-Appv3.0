import React, { useState, useEffect } from 'react';
import { useWeather } from '../context/WeatherContext';
import { useSettings } from '../context/SettingsContext';
import WeatherIcon from './WeatherIcons';
import { HumidityIcon, WindIcon } from './AppIcons';

/**
 * Quick Weather Widget — Redesigned
 * Shows present conditions for all 3 cities at a glance,
 * plus a 24-hour heads-up timeline for the selected city.
 */
const QuickWeather = () => {
    const { weatherData, loading, error } = useWeather();
    const [activeCity, setActiveCity] = useState(() => {
        try {
            return localStorage.getItem('weather_active_city') || 'chennai';
        } catch {
            return 'chennai';
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('weather_active_city', activeCity);
        } catch {
            // Ignore storage errors
        }
    }, [activeCity]);

    if (loading) return <div className="quick-weather-card qw-bg-day"><div style={{ textAlign: 'center', padding: '20px 0' }}>Loading weather...</div></div>;
    if (error || !weatherData) return <div className="quick-weather-card qw-bg-night"><div style={{ textAlign: 'center', padding: '20px 0' }}>Weather unavailable</div></div>;

    const { settings } = useSettings();
    const cities = (settings.weather?.cities || ['chennai', 'trichy', 'muscat']).map(c => c.toLowerCase());

    const cityLabels = {
        chennai: 'Chennai',
        trichy: 'Trichy',
        muscat: 'Muscat',
        [cities[2]]: cities[2].charAt(0).toUpperCase() + cities[2].slice(1)
    };
    const cityIcons = { chennai: '🏛️', trichy: '🏯', muscat: '📍', [cities[2]]: '📍' };

    const hour = new Date().getHours();
    let bgClass = 'qw-bg-day';
    if (hour >= 6 && hour < 11) bgClass = 'qw-bg-morning';
    else if (hour >= 11 && hour < 17) bgClass = 'qw-bg-day';
    else if (hour >= 17 && hour < 20) bgClass = 'qw-bg-evening';
    else bgClass = 'qw-bg-night';

    const activeCityData = weatherData[activeCity];
    const headsUp = getHeadsUp(activeCityData);
    const severeWarning = getSevereWarning(activeCityData);

    return (
        <section className={`quick-weather-card ${bgClass}`}>
            {/* All 3 Cities — Current Conditions */}
            <div className="qw-cities-grid">
                {cities.map(city => {
                    const d = weatherData[city];
                    if (!d?.current) return null;
                    const c = d.current;
                    const isActive = city === activeCity;
                    return (
                        <div
                            key={city}
                            className={`qw-city-card ${isActive ? 'qw-city-card--active' : ''}`}
                            onClick={() => setActiveCity(city)}
                        >
                            <div className="qw-city-header">
                                <span className="qw-city-icon">{cityIcons[city]}</span>
                                <span className="qw-city-name">{cityLabels[city]}</span>
                            </div>
                            <div className="qw-city-temp-row">
                                <span className="qw-city-temp" style={{ fontSize: '0.9rem' }}>{c.temp}°</span>
                                <span className="qw-city-weather-icon">
                                    {c.iconId ? <WeatherIcon id={c.iconId} size={48} /> : <span style={{fontSize:'2.5rem'}}>{c.icon}</span>}
                                </span>
                            </div>
                            <div className="qw-city-condition">{c.condition}</div>
                            <div className="qw-city-meta">
                                <span><HumidityIcon size="0.85em" /> {c.humidity ?? '--'}%</span>
                                <span><WindIcon size="0.85em" /> {c.windSpeed ?? '--'}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 24-Hour Timeline Strip */}
            {activeCityData?.hourly24 && (
                <div className="qw-timeline-section">
                    <div className="qw-timeline-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {getTimelineSummary(activeCityData, cityLabels[activeCity])}
                    </div>
                    <div className="qw-timeline-strip">
                        {activeCityData.hourly24.map((slot, i) => (
                            <div key={i} className="qw-timeline-slot">
                                <div className="qw-slot-time">{slot.label}</div>
                                <div className="qw-slot-icon">
                                    {slot.iconId ? <WeatherIcon id={slot.iconId} size={40} /> : slot.icon}
                                </div>
                                <div className="qw-slot-temp" style={{ fontSize: '0.9rem' }}>{slot.temp}°</div>
                                {slot.precip > 0.5 && (
                                    <div className="qw-slot-rain">{slot.precip}mm</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Heads-Up Alert */}
            {headsUp && (
                <div className="qw-headsup">
                    <span className="qw-headsup-icon">{headsUp.icon}</span>
                    <span>{headsUp.message}</span>
                </div>
            )}

            {/* Severe Weather Warning */}
            {severeWarning && (
                <div className="qw-severe" style={{
                    background: 'rgba(220,38,38,0.15)',
                    border: '1px solid rgba(220,38,38,0.4)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    margin: '8px 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.78rem',
                    color: '#fca5a5'
                }}>
                    <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                    <span>{severeWarning}</span>
                </div>
            )}
        </section>
    );
};

function getTimelineSummary(cityData, cityName) {
    if (!cityData?.hourly24) return `${cityName} • Forecast`;

    const slots = cityData.hourly24;
    const rainSlots = slots.filter(s => s.precip > 0.5 || s.prob > 40);

    const current = cityData.current;

    // 1. If Raining significantly, warn user
    if (rainSlots.length >= 3) {
        return `${cityName} • Rainy spells ahead`;
    }
    if (rainSlots.length > 0) {
        return `${cityName} • Scattered showers`;
    }

    // 2. Default: Show Current Condition (e.g. "Chennai • Partly Cloudy")
    if (current?.condition) {
        return `${cityName} • ${current.condition}`;
    }

    // 3. Fallback
    return `${cityName} • Clear Skies`;
}

function getHeadsUp(cityData) {
    if (!cityData?.hourly24) return null;
    const slots = cityData.hourly24;
    const rainSlots = slots.filter(s => s.precip > 0.5 || s.prob > 40);

    if (rainSlots.length === 0) return null;

    const totalMm = rainSlots.reduce((sum, s) => sum + (s.precip || 0), 0);
    const maxProb = Math.max(...rainSlots.map(s => s.prob || 0));

    const formatHour = (h) => {
        const period = h >= 12 ? 'p' : 'a';
        const hour12 = h % 12 === 0 ? 12 : h % 12;
        return `${hour12}${period}`;
    };

    const startHour = formatHour(rainSlots[0].hour);
    const endHour = rainSlots.length > 1 ? formatHour(rainSlots[rainSlots.length - 1].hour) : null;

    let intensity = 'Rain';
    let icon = '🌧️';
    if (totalMm >= 10 || maxProb >= 80) {
        intensity = 'Heavy rain';
        icon = '⛈️';
    } else if (totalMm < 2 && maxProb < 50) {
        intensity = 'Light showers possible';
        icon = '🌦️';
    }

    const timeRange = endHour ? `${startHour}–${endHour}` : `around ${startHour}`;
    const mmText = totalMm > 0.5 ? ` (~${totalMm.toFixed(1)}mm)` : '';

    return {
        icon,
        message: `${intensity} expected ${timeRange}${mmText}`
    };
}

function getSevereWarning(cityData) {
    if (!cityData?.hourly24) return null;

    const slots = cityData.hourly24;
    const heavyRainSlots = slots.filter(s => s.precip >= 10);
    const stormSlots = slots.filter(s => s.prob >= 80);
    const temps = slots.map(s => s.temp).filter(t => t != null);
    const maxTemp = temps.length > 0 ? Math.max(...temps) : null;

    if (heavyRainSlots.length > 0) {
        const totalMm = heavyRainSlots.reduce((s, h) => s + h.precip, 0);
        return `Heavy rainfall warning: ${totalMm.toFixed(1)}mm expected`;
    }
    if (stormSlots.length >= 2) {
        return 'Thunderstorm activity likely in the next 24 hours';
    }
    if (maxTemp != null && maxTemp >= 42) {
        return `Extreme heat warning: Temperatures may reach ${maxTemp}°C`;
    }
    return null;
}

export default QuickWeather;
