import { useState } from 'react';
import S from './strings.js';
import { Tabs } from './ui.jsx';
import Board from './Board.jsx';
import NewJob from './NewJob.jsx';
import { Dues, DayClose } from './DuesClose.jsx';

// The Wash day-to-day screens, shown as tabs next to the manifest-driven owner panel (see main.jsx). `panel` is the owner panel element.
export default function WashApp({ api, role, panel }) {
  const [tab, setTab] = useState('board'); const [boardKey, setBoardKey] = useState(0);
  const items = [['board', S.tabs.board], ['newJob', S.tabs.newJob], ['dues', S.tabs.dues], ['close', S.tabs.close], ['panel', S.tabs.panel]];
  return (
    <div>
      <Tabs items={items} value={tab} onChange={setTab} />
      {tab === 'board' && <Board key={boardKey} api={api} role={role} />}
      {tab === 'newJob' && <NewJob api={api} onCreated={() => setBoardKey((k) => k + 1)} />}
      {tab === 'dues' && <Dues api={api} />}
      {tab === 'close' && <DayClose api={api} />}
      {tab === 'panel' && panel}
    </div>
  );
}
