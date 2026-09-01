import { useMemo, useState } from 'react';
import { CalendarCheck, Check, ChevronLeft, ChevronRight, Clock3, Flame, QrCode, TrendingUp } from 'lucide-react';
import { Button, Card, CardTitle, Page, PageHeader, Pill, Stat } from '../subadmin/ui';

const sessions = [
  { date: 2, title: 'Upper Body Strength', time: '07:00 AM', trainer: 'Arjun', status: 'Attended' },
  { date: 5, title: 'Cardio & Mobility', time: '06:30 AM', trainer: 'Swetha', status: 'Attended' },
  { date: 8, title: 'Personal Training', time: '07:00 AM', trainer: 'Arjun', status: 'Missed' },
  { date: 12, title: 'Lower Body Strength', time: '07:00 AM', trainer: 'Arjun', status: 'Attended' },
  { date: 16, title: 'Personal Training', time: '06:30 AM', trainer: 'Swetha', status: 'Attended' },
  { date: 20, title: 'Functional Fitness', time: '07:00 AM', trainer: 'Arjun', status: 'Attended' },
  { date: 25, title: 'Personal Training', time: '07:00 AM', trainer: 'Arjun', status: 'Upcoming' },
  { date: 29, title: 'Mobility & Recovery', time: '06:30 AM', trainer: 'Swetha', status: 'Upcoming' },
];

const statusTone = { Attended: 'green', Missed: 'red', Upcoming: 'blue' };

const Attendance = () => {
  const [filter, setFilter] = useState('All sessions');
  const visible = useMemo(() => filter === 'All sessions' ? sessions : sessions.filter((session) => session.status === filter), [filter]);

  return <Page>
    <PageHeader eyebrow="Customer workspace" title="Session attendance" description="Track every gym and personal-training session in one place." actions={<Button><QrCode className="h-4 w-4" />Open check-in QR</Button>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Sessions this month" value="8" helper="6 completed · 2 upcoming" icon={CalendarCheck} />
      <Stat label="Attendance rate" value="83%" helper="+7% from last month" icon={TrendingUp} tone="blue" />
      <Stat label="Current streak" value="4 days" helper="Personal best: 11 days" icon={Flame} tone="amber" />
      <Stat label="Training time" value="7.5 hrs" helper="Across 6 completed sessions" icon={Clock3} tone="violet" />
    </div>
    <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <Card>
        <CardTitle title="August 2026" description="Your monthly activity" action={<div className="flex gap-1"><button className="rounded-lg p-2 hover:bg-gray-100" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button><button className="rounded-lg p-2 text-gray-300" aria-label="Next month" disabled><ChevronRight className="h-4 w-4" /></button></div>} />
        <div className="p-5">
          <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-400">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <span className="py-2" key={day}>{day}</span>)}</div>
          <div className="grid grid-cols-7 gap-1">{Array.from({ length: 37 }, (_, index) => {
            const day = index - 5;
            const session = sessions.find(item => item.date === day);
            return day < 1 || day > 31 ? <span key={index} /> : <div key={day} className={`relative flex aspect-square items-center justify-center rounded-xl text-sm ${day === 28 ? 'ring-2 ring-teal-500 ring-offset-1' : ''} ${session?.status === 'Attended' ? 'bg-emerald-50 font-semibold text-emerald-700' : session?.status === 'Missed' ? 'bg-red-50 font-semibold text-red-600' : session?.status === 'Upcoming' ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>{day}{session?.status === 'Attended' && <Check className="absolute bottom-1 right-1 h-3 w-3" />}</div>;
          })}</div>
          <div className="mt-5 flex flex-wrap gap-4 border-t border-gray-100 pt-4 text-xs text-gray-500">{[['bg-emerald-400','Attended'],['bg-red-400','Missed'],['bg-blue-400','Upcoming']].map(([color,label]) => <span className="flex items-center gap-2" key={label}><i className={`h-2 w-2 rounded-full ${color}`} />{label}</span>)}</div>
        </div>
      </Card>
      <Card>
        <CardTitle title="Session history" description={`${visible.length} sessions shown`} />
        <div className="flex flex-wrap gap-2 border-b border-gray-100 p-4">{['All sessions','Attended','Missed','Upcoming'].map(item => <button onClick={() => setFilter(item)} key={item} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === item ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{item}</button>)}</div>
        <div className="max-h-[430px] divide-y divide-gray-100 overflow-y-auto">{visible.map(session => <div className="flex items-center gap-4 p-4" key={`${session.date}-${session.title}`}><div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-gray-50"><span className="text-[10px] font-bold uppercase text-gray-400">Aug</span><span className="font-bold text-gray-900">{session.date}</span></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{session.title}</p><p className="mt-1 text-xs text-gray-500">{session.time} · with {session.trainer}</p></div><Pill tone={statusTone[session.status]}>{session.status}</Pill></div>)}</div>
      </Card>
    </div>
  </Page>;
};

export default Attendance;
