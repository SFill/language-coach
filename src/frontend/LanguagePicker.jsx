import React from 'react';
import { useWordlist } from './wordlist/WordlistContext';
import styles from './LanguagePicker.module.css';

const LanguagePicker = () => {
  const { currentLanguage, changeLanguage } = useWordlist();

  const handleLanguageChange = (language) => {
    if (language !== currentLanguage) {
      changeLanguage(language);
    }
  };

  return (
    <div className={styles.languagePicker}>
      <button 
        className={`${styles.languageButton} ${currentLanguage === 'en' ? styles.active : ''}`}
        onClick={() => handleLanguageChange('en')}
        title="English"
      >
        EN
      </button>
      <button 
        className={`${styles.languageButton} ${currentLanguage === 'es' ? styles.active : ''}`}
        onClick={() => handleLanguageChange('es')}
        title="Spanish"
      >
        ES
      </button>
    </div>
  );
};

export default LanguagePicker;