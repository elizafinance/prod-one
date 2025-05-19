"use client";
import React from 'react';

// Minimal placeholder for SquadInvitationCard
const SquadInvitationCard: React.FC<{ [key: string]: any }> = (props) => {
  const { invite } = props;
  return (
    <div style={{ border: '1px dashed #ccc', padding: '10px', margin: '10px 0', textAlign: 'center' }}>
      <p style={{color: '#888', fontSize: '0.9em'}}>Squad Invitation Card Placeholder (ID: {invite?.invitationId})</p>
    </div>
  );
};
SquadInvitationCard.displayName = 'SquadInvitationCard';

export default SquadInvitationCard; 