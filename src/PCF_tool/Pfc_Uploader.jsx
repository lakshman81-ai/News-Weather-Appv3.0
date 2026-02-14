import React from 'react';

const Pfc_Uploader = ({ onFileSelect }) => {
    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) onFileSelect(file);
    };

    const handleInput = (e) => {
        const file = e.target.files[0];
        if (file) onFileSelect(file);
    };

    return (
        <div
            className="pfc-uploader"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
        >
            <div className="pfc-dropzone">
                <p>Drag & Drop CSV File Here</p>
                <p>or</p>
                <input type="file" accept=".csv" onChange={handleInput} />
            </div>
            <style>{`
                .pfc-uploader { border: 2px dashed #aaa; padding: 40px; text-align: center; border-radius: 8px; background: #fff; cursor: pointer; transition: all 0.2s; }
                .pfc-uploader:hover { border-color: #007bff; background: #f0f8ff; }
                .pfc-dropzone input { margin-top: 10px; }
            `}</style>
        </div>
    );
};

export default Pfc_Uploader;
