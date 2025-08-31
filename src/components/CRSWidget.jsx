import React from 'react';
import { ExternalLink } from 'lucide-react';
import './CRSWidget.css';

const CRSWidget = () => {
  return (
    <div className="crs-widget">
      <div className="crs-header">
        <div className="crs-icon">
          <ExternalLink size={20} />
        </div>
        <span className="crs-label">3M CODING</span>
      </div>

      {/* Embedded website */}
      <iframe
        src="https://3mhis.lccc.wy.edu/launchCRS.html"
        title="3M Coding System"
        width="100%"
        height="600px"
        style={{ border: "none", borderRadius: "8px" }}
      />
    </div>
  );
};

export default CRSWidget;
