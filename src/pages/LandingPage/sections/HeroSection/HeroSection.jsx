import React from 'react';
import styles from './HeroSection.module.css';
import Button from '../../../../components/Button/Button';

const HeroSection = () => {
  return (
    <section className={styles.hero}>
      <div className={styles.heroBackground}>
        {/* Glow effects for premium feel */}
        <div className={styles.glowBlob1}></div>
        <div className={styles.glowBlob2}></div>
      </div>
      
      <div className={`container ${styles.container}`}>
        <div className={styles.content}>
          <div className={styles.badge}>Cloud Security Intelligence</div>
          <h1 className={styles.title}>
            Find Vulnerabilities and
            <br />
            <span className="text-gradient">Get Recommendations.</span>
          </h1>
          <p className={styles.subtitle}>
            We scan your cloud to find hidden security risks and provide clear recommendations to fix them instantly.
          </p>
          <div className={styles.ctaGroup}>
            <Button variant="primary" size="large" onClick={() => window.location.href = '/register'}>Start Free Scan</Button>
            <Button variant="secondary" size="large">View Demo</Button>
          </div>
          
          <div className={styles.trustMarks}>
            <p>COMPREHENSIVE COVERAGE across multi-cloud environments</p>
            <div className={styles.badges}>
              <span className={styles.trustBadge}>AWS</span>
              <span className={styles.trustBadge}>GCP</span>
              <span className={styles.trustBadge}>Azure</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
