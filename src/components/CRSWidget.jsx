

import React from 'react';
import { ExternalLink } from 'lucide-react';
import './CRSWidget.css';

const CRSWidget = ({ courseCategory }) => {
  // Only show widget for IP-DRG category students
  if (courseCategory !== 'IP-DRG') {
    return null;
  }

  const handleClick = () => {
    window.open('https://3mhis.lccc.wy.edu/launchCRS.html', '_blank');
  };

  return (
    <div className="crs-widget" onClick={handleClick}>
      <div className="crs-icon">
        <ExternalLink size={20} />
      </div>
      <span className="crs-label">3M Software</span>
    </div>
  );
};

export default CRSWidget;