import React from 'react';
import ReverseContext from './ReverseContext';
import WordLists from './WordLists';
import WordListsManager from './WordListManager';
import './WordListPage.css';

const WordListPage = () => {
  return (
    <div className="page">
      <div className='word-list-page-container'>
        <ReverseContext />
        <WordLists />
        <WordListsManager />
      </div>

    </div>
  );
};

export default WordListPage;
