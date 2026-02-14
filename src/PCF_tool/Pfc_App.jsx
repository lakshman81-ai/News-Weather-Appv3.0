import React from 'react';
import { Pfc_ConfigProvider } from './Pfc_ConfigContext';
import Pfc_Main from './Pfc_Main';

const Pfc_App = () => {
    return (
        <Pfc_ConfigProvider>
            <div className="pfc-app-wrapper">
                <Pfc_Main />
            </div>
            <style>{`
                .pfc-app-wrapper { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #f4f6f9; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
            `}</style>
        </Pfc_ConfigProvider>
    );
};

export default Pfc_App;
