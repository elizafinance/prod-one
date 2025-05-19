"use client";
import React from 'react';

// Minimal placeholder for Stepper
const Stepper: React.FC<{ [key: string]: any }> = (props) => {
  return (
    <div style={{ border: '1px dashed #ccc', padding: '10px', margin: '10px 0', textAlign: 'center' }}>
      <p style={{color: '#888', fontSize: '0.9em'}}>Stepper Placeholder</p>
      {/* You can add basic prop logging here if needed for debugging during development */}
      {/* <pre style={{fontSize: '0.7em', textAlign: 'left'}}>{JSON.stringify(Object.keys(props), null, 2)}</pre> */}
    </div>
  );
};
Stepper.displayName = 'Stepper';

export default Stepper; 