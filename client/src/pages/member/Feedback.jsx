import { useState } from 'react';
import { CheckCircle2, MessageSquareText, Send, Star, UserRound } from 'lucide-react';
import { Button, Card, CardTitle, Page, PageHeader, Pill } from '../subadmin/ui';
import useSuspended from '../../hooks/useSuspended';

const pastFeedback = [
  { title: 'PT session with Arjun', date: '20 Aug 2026', rating: 5, text: 'Great session. The form corrections were really helpful.', reply: 'Thanks, Priya! Great progress this week.' },
  { title: 'Gym facilities', date: '10 Aug 2026', rating: 4, text: 'Clean and well maintained. More evening mats would help.' },
];

const Feedback = () => {
  const suspended = useSuspended();
  const [category, setCategory] = useState('Trainer & PT session');
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    if (!rating || !message.trim()) return;
    setSubmitted(true);
    setRating(0);
    setMessage('');
  };

  return <Page>
    <PageHeader eyebrow="Customer workspace" title="Feedback" description="Share your experience and help your gym team make every session better." actions={<Pill tone="green"><MessageSquareText className="mr-1 h-3.5 w-3.5" />Replies within 24 hours</Pill>} />
    {submitted && <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"><CheckCircle2 className="h-5 w-5" />Thank you! Your feedback has been sent to the gym team.<button onClick={() => setSubmitted(false)} className="ml-auto text-xs font-bold">Dismiss</button></div>}
    <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
      <Card>
        <CardTitle title="Tell us how we did" description="Your feedback is visible only to you and the gym team." />
        <div className="space-y-6 p-5 sm:p-6">
          <div><p className="mb-2 text-sm font-semibold text-gray-700">What is this about?</p><div className="grid gap-2 sm:grid-cols-3">{['Trainer & PT session','Gym facilities','App experience'].map(item => <button onClick={() => setCategory(item)} className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${category === item ? 'border-teal-600 bg-teal-50 text-teal-700 ring-2 ring-teal-100' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`} key={item}>{item}</button>)}</div></div>
          <div><p className="text-sm font-semibold text-gray-700">How was your experience?</p><div className="mt-3 flex items-center gap-2">{[1,2,3,4,5].map(value => <button key={value} onMouseEnter={() => setHovered(value)} onMouseLeave={() => setHovered(0)} onClick={() => setRating(value)} aria-label={`${value} stars`}><Star className={`h-9 w-9 transition ${(hovered || rating) >= value ? 'fill-amber-400 text-amber-400' : 'text-gray-200 hover:text-amber-300'}`} /></button>)}<span className="ml-2 text-sm font-medium text-gray-500">{rating ? ['','Poor','Fair','Good','Very good','Excellent'][rating] : 'Select a rating'}</span></div></div>
          <label className="block"><span className="text-sm font-semibold text-gray-700">Your comments</span><span className="float-right text-xs text-gray-400">{message.length}/500</span><textarea value={message} maxLength={500} onChange={event => setMessage(event.target.value)} placeholder="What went well? What could we improve?" className="mt-2 h-36 w-full resize-none rounded-xl border border-gray-200 p-3.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100" /></label>
          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-gray-400">Please avoid sharing payment or medical information.</p><Button disabled={!rating || !message.trim() || suspended} onClick={submit}><Send className="h-4 w-4" />Submit feedback</Button></div>
        </div>
      </Card>
      <Card>
        <CardTitle title="Your recent feedback" description="Updates and responses from your gym" />
        <div className="divide-y divide-gray-100">{pastFeedback.map(item => <article className="p-5" key={item.date}><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-gray-900">{item.title}</h3><p className="mt-1 text-xs text-gray-400">{item.date}</p></div><div className="flex">{Array.from({length: 5}, (_, index) => <Star key={index} className={`h-4 w-4 ${index < item.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />)}</div></div><p className="mt-3 text-sm leading-6 text-gray-600">“{item.text}”</p>{item.reply && <div className="mt-4 flex gap-3 rounded-xl bg-teal-50 p-3"><div className="rounded-lg bg-white p-2 text-teal-700 shadow-sm"><UserRound className="h-4 w-4" /></div><div><p className="text-xs font-bold text-teal-800">Trainer reply</p><p className="mt-1 text-xs leading-5 text-teal-700">{item.reply}</p></div></div>}</article>)}</div>
      </Card>
    </div>
  </Page>;
};

export default Feedback;
