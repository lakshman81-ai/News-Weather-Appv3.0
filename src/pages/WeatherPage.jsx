import React, { useState, useEffect } from 'react';
import WeatherStickyHeader from '../components/WeatherStickyHeader';
import DetailedWeatherCard from '../components/DetailedWeatherCard';
import { useWeather } from '../context/WeatherContext';
import { useSettings } from '../context/SettingsContext';
import { useMediaQuery } from '../hooks/useMediaQuery';

/**
 * Weather Page
 * Dedicated page for detailed weather forecast with sticky header
 */
function WeatherPage() {
    const { weatherData, loading, error, refreshWeather } = useWeather();
    const { settings } = useSettings();
    const { isDesktop } = useMediaQuery();

    // Use real data, if loading show spinner or skeletal
    const displayData = weatherData;
    const cities = (settings.weather?.cities || ['chennai', 'trichy', 'muscat']).map(c => c.toLowerCase());

    // Lift active city state up
    const [activeCity, setActiveCity] = useState(() => {
        return localStorage.getItem('dw_active_city') || 'chennai';
    });

    useEffect(() => {
        localStorage.setItem('dw_active_city', activeCity);
    }, [activeCity]);

    const handleRefresh = () => {
        refreshWeather(true);
    };

    // Loading State
    if (loading && !weatherData) {
        return (
            <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <div className="loading">
                    <div className="loading__spinner"></div>
                    <span>Loading Forecast...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container" style={{ padding: 0 }}>
            {/* Sticky Header replaces standard Header */}
            {displayData && (
                <WeatherStickyHeader
                    weatherData={displayData}
                    activeCity={activeCity} // Pass active city
                    cities={cities}
                    onRefresh={handleRefresh}
                    loading={loading}
                    isDesktop={isDesktop}
                />
            )}

            <main className="main-content" style={{ padding: 0, marginTop: 0 }}>
                {error && (
                    <div className="topline" style={{ borderLeftColor: 'var(--accent-danger)', margin: '16px' }}>
                        <div className="topline__label" style={{ color: 'var(--accent-danger)' }}>Error</div>
                        <div className="topline__text">Failed to update weather. Showing cached data.</div>
                    </div>
                )}

                {/* Only render WeatherCard if data is available */}
                {displayData ? (
                    <DetailedWeatherCard
                        weatherData={displayData}
                        activeCity={activeCity} // Controlled by parent
                        setActiveCity={setActiveCity} // Controlled by parent
                    />
                ) : (
                    <div className="empty-state">
                        <div className="empty-state__icon">☁️</div>
                        <p>Weather data unavailable.</p>
                        <button onClick={handleRefresh} className="btn btn--secondary mt-md">Retry</button>
                    </div>
                )}
            </main>
        </div>
    );
}

export default WeatherPage;
