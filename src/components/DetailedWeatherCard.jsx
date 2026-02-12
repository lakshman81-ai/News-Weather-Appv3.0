import React, { useState } from 'react';
import './DetailedWeatherCard.css';
import WeatherIcon from './WeatherIcons';
import { UmbrellaIcon, CloudIcon, HumidityIcon, WindIcon } from './AppIcons';
import { useSettings } from '../context/SettingsContext';

export default function DetailedWeatherCard({ weatherData, activeCity, setActiveCity }) {
    const { settings } = useSettings();
    const cities = (settings.weather?.cities || ['chennai', 'trichy', 'muscat']).map(c => c.toLowerCase());

    const cityLabels = {
        chennai: 'Chennai',
        trichy: 'Trichy',
        muscat: 'Muscat',
        [cities[2]]: cities[2].charAt(0).toUpperCase() + cities[2].slice(1)
    };
    const cityIcons = { chennai: '🏛️', trichy: '🏯', muscat: '📍', [cities[2]]: '📍' };

    const [expandedCard, setExpandedCard] = useState(null);

    if (!weatherData) return null;
    const cityData = weatherData[activeCity] || weatherData['chennai'];

    if (!cityData) return <div className="dw-container">Data unavailable</div>;

    // Time-based Segments Logic
    const hour = new Date().getHours();
    let segments = [];

    const getSeg = (day, period, labelOverride = null) => {
        const dKey = day === 'today' ? cityData : cityData.tomorrow;
        const pKey = period; // 'morning', 'noon', 'evening'
        const data = day === 'today' ? cityData[period] : cityData.tomorrow?.[period];

        let label = labelOverride;
        if (!label) {
            if (period === 'morning') label = 'Morning';
            else if (period === 'noon') label = 'Afternoon';
            else label = 'Evening';

            if (day === 'tomorrow') label = 'Tomorrow ' + label;
        }

        return {
            id: `${day}-${period}`,
            label: label,
            data: data
        };
    };

    // Determine 3 contextual cards
    if (hour < 11) {
        segments = [
            getSeg('today', 'morning', 'This Morning'),
            getSeg('today', 'noon'),
            getSeg('today', 'evening')
        ];
    } else if (hour < 17) {
        segments = [
            getSeg('today', 'noon', 'This Afternoon'),
            getSeg('today', 'evening'),
            getSeg('tomorrow', 'morning')
        ];
    } else if (hour < 21) {
        segments = [
            getSeg('today', 'evening', 'Tonight'),
            getSeg('tomorrow', 'morning'),
            getSeg('tomorrow', 'noon')
        ];
    } else {
        segments = [
            getSeg('tomorrow', 'morning', 'Tomorrow Morning'),
            getSeg('tomorrow', 'noon'),
            getSeg('tomorrow', 'evening')
        ];
    }

    return (
        <div className="dw-container">
            {/* Sidebar (Vertical Tabs) */}
            <div className="dw-sidebar">
                {cities.map(city => (
                    <button
                        key={city}
                        className={`dw-city-tab ${city === activeCity ? 'active' : ''}`}
                        onClick={() => setActiveCity(city)}
                        aria-label={`Select ${cityLabels[city]}`}
                    >
                        <span className="dw-city-icon">{cityIcons[city] || '📍'}</span>
                        <span className="dw-city-name">{cityLabels[city] || city}</span>
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="dw-content">
                {/* Header for Selected City */}
                <div className="dw-header">
                    <div className="dw-header-main">
                        <h2 className="dw-city-title">{cityData.name}</h2>
                        <span className="dw-current-temp">{cityData.current?.temp}°</span>
                    </div>
                    <div className="dw-header-sub">
                        {cityData.summary}
                    </div>
                </div>

                {/* 3 Contextual Cards */}
                <div className="dw-cards-list">
                    {segments.map((seg, idx) => {
                        if (!seg.data) return null;
                        return (
                            <WeatherSegmentCard
                                key={seg.id}
                                segment={seg}
                                isExpanded={expandedCard === idx}
                                onToggle={() => setExpandedCard(expandedCard === idx ? null : idx)}
                            />
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="dw-footer">
                   Forecast based on {cityData.models?.count} models ({cityData.models?.names}).
                </div>
            </div>
        </div>
    );
}

function WeatherSegmentCard({ segment, isExpanded, onToggle }) {
    const { label, data } = segment;

    // Rainfall Logic
    const rainMmVal = parseFloat(data.rainMm === '-' ? 0 : data.rainMm);
    const rainProbVal = data.rainProb?.avg || 0;
    const hasSignificantRain = rainMmVal >= 1.0;
    const hasAnyRain = rainMmVal > 0 || rainProbVal > 0;

    let RainIcon = CloudIcon;
    let rainColor = 'var(--text-secondary)';
    let rainText = 'No significant rain';

    if (hasAnyRain) {
        if (hasSignificantRain) {
            RainIcon = UmbrellaIcon;
            rainColor = '#3b82f6'; // Blue
        } else {
            RainIcon = CloudIcon; // Or trace icon
             rainColor = '#94a3b8'; // Greyish
        }

        // Format: "4.2mm (65%)"
        rainText = `${rainMmVal > 0 ? rainMmVal.toFixed(1) + 'mm' : 'Trace'} (${rainProbVal}%)`;
    }

    // Condition Text / Description
    // If API doesn't provide a text summary for the segment, infer one
    const description = getConditionText(data);

    return (
        <div className={`dw-card ${isExpanded ? 'expanded' : ''}`} onClick={onToggle}>
            <div className="dw-card-header">
                <span className="dw-period-badge">{label}</span>
                <span className="dw-expand-hint">{isExpanded ? 'Collapse' : 'Touch for Hourly'}</span>
            </div>

            <div className="dw-card-main">
                <div className="dw-main-icon">
                    {data.iconId ? <WeatherIcon id={data.iconId} size={56} /> : <span style={{fontSize:'3rem'}}>{data.icon}</span>}
                </div>
                <div className="dw-main-temp">
                    <div className="dw-temp-val">{data.temp}°</div>
                    <div className="dw-temp-feels">Feels like {data.feelsLike}°</div>
                </div>
            </div>

            <div className="dw-details-grid">
                {/* Row 1: Rainfall (Umbrella if >1mm) */}
                <div className="dw-detail-row">
                    <div className="dw-detail-icon">
                        <RainIcon size={20} color={rainColor} />
                    </div>
                    <div className="dw-detail-text">
                        {rainText}
                    </div>
                </div>

                {/* Row 2: Humidity, Wind Speed */}
                <div className="dw-detail-row">
                    <div className="dw-detail-icon"><HumidityIcon size={20} /></div>
                    <div className="dw-detail-text">
                        {data.humidity}% <span className="dw-sep">|</span> <WindIcon size={16} /> {data.windSpeed} km/h
                    </div>
                </div>

                {/* Row 3: UV, PM 2.5 */}
                <div className="dw-detail-row">
                    <div className="dw-detail-icon">☀️</div>
                    <div className="dw-detail-text">
                        UV: {data.uvIndex || '-'} <span className="dw-sep">|</span> PM 2.5: -
                    </div>
                </div>

                {/* Row 4: Descriptive */}
                <div className="dw-detail-row">
                    <div className="dw-detail-icon">ℹ️</div>
                    <div className="dw-detail-text dw-desc">
                        {description}
                    </div>
                </div>
            </div>

            {isExpanded && data.hourly && (
                <div className="dw-hourly-container hide-scrollbar" onClick={(e) => e.stopPropagation()}>
                    {data.hourly.map((h, i) => (
                        <div key={i} className="dw-hourly-slot">
                            <span className="dw-slot-time">{h.time}</span>
                            <div className="dw-slot-icon">
                                {h.iconId ? <WeatherIcon id={h.iconId} size={28} /> : h.icon}
                            </div>
                            <strong className="dw-slot-temp">{h.temp}°</strong>
                            {h.precip > 0 && (
                                <span className="dw-slot-precip">
                                    {h.precip >= 1 && <span style={{fontSize:'0.7rem'}}>☂️</span>}
                                    {h.precip}mm
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function getConditionText(data) {
    // Generate a short description based on metrics
    const parts = [];
    if (data.rainProb?.avg > 40) parts.push("Rain expected.");
    else if (data.cloudCover > 70) parts.push("Cloudy.");
    else if (data.cloudCover < 20) parts.push("Clear skies.");

    if (data.windSpeed > 20) parts.push("Breezy.");
    if (data.uvIndex > 8) parts.push("High UV.");

    if (parts.length === 0) return "Pleasant conditions.";
    return parts.join(" ");
}
