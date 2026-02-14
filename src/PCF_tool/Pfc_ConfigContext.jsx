import React, { createContext, useContext, useState, useEffect } from 'react';

// Default Configuration matching the provided CSV sample
const DEFAULT_CONFIG = {
    // Column Header Mapping (CSV Header -> Internal Key)
    headerMap: {
        "Sequence": "sequence",
        "Type": "type",
        "Bore": "bore",
        "O/D": "od",
        "Wall Thickness": "wallThickness",
        "Material": "material",
        "East": "coordE",
        "North": "coordN",
        "Up": "coordU",
        "Pressure": "pressure",
        "Weight": "weight",
        "Radius": "radius",
        "Rigid": "rigidStatus"
    },
    // Component Type Mapping (CSV Type -> PCF Keyword)
    typeMap: {
        "BRAN": "PIPE", // Branch usually implies pipe segment end
        "FLAN": "FLANGE",
        "VALV": "VALVE",
        "TEE": "TEE",
        "ELBO": "BEND",
        "ANCI": "SUPPORT", // Ancillary mapped to Support
        "PIPE": "PIPE"
    },
    // Unit Settings
    units: {
        bore: "MM",
        coords: "MM",
        weight: "KGS"
    },
    // Parsing Options
    options: {
        stripUnits: true, // e.g., "400mm" -> 400
        defaultMaterial: "A106-B"
    }
};

const Pfc_ConfigContext = createContext();

export const Pfc_ConfigProvider = ({ children }) => {
    const [config, setConfig] = useState(() => {
        const stored = localStorage.getItem('pcf_tool_config');
        return stored ? JSON.parse(stored) : DEFAULT_CONFIG;
    });

    const [masterRatings, setMasterRatings] = useState({}); // Lookup table for Rating -> Weights
    const [processData, setProcessData] = useState({}); // Lookup table for LineNo -> Process Data

    // Persist config changes
    useEffect(() => {
        localStorage.setItem('pcf_tool_config', JSON.stringify(config));
    }, [config]);

    const updateHeaderMap = (key, value) => {
        setConfig(prev => ({
            ...prev,
            headerMap: { ...prev.headerMap, [key]: value }
        }));
    };

    const updateTypeMap = (key, value) => {
        setConfig(prev => ({
            ...prev,
            typeMap: { ...prev.typeMap, [key]: value }
        }));
    };

    const resetConfig = () => setConfig(DEFAULT_CONFIG);

    return (
        <Pfc_ConfigContext.Provider value={{
            config,
            setConfig,
            updateHeaderMap,
            updateTypeMap,
            resetConfig,
            masterRatings,
            setMasterRatings,
            processData,
            setProcessData
        }}>
            {children}
        </Pfc_ConfigContext.Provider>
    );
};

export const usePfcConfig = () => {
    const context = useContext(Pfc_ConfigContext);
    if (!context) {
        throw new Error('usePfcConfig must be used within a Pfc_ConfigProvider');
    }
    return context;
};
