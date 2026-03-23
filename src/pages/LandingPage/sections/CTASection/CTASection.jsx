import React from 'react';
import styles from './CTASection.module.css';
import Section from '../../../../components/Section/Section';
import Button from '../../../../components/Button/Button';

const CTASection = () => {
  return (
    <Section 
      id="pricing"
      className={styles.ctaSection}
    >
      <div className={styles.ctaBox}>
        <div className={styles.backgroundEffects}>
          <div className={styles.glowTop}></div>
          <div className={styles.glowBottom}></div>
        </div>
        
        <div className={styles.content}>
          <h2 className={styles.title}>Ready to Make Your Cloud Safe?</h2>
          <p className={styles.description}>
            Start your free scan today and protect your business from attacks and data leaks.
          </p>
          <div className={styles.actions}>
            <Button variant="primary" size="large" onClick={() => window.location.href = '/register'}>Start Free Scan</Button>
            <Button variant="secondary" size="large">Contact Sales</Button>
          </div>
        </div>
      </div>
    </Section>
  );
};

export default CTASection;
