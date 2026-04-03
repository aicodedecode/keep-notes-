/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Menu, 
  Grid, 
  List, 
  Settings, 
  Bell, 
  Archive, 
  Trash2, 
  Lightbulb, 
  CheckSquare, 
  Calendar as CalendarIcon, 
  Plus, 
  Pin, 
  MoreVertical, 
  Palette, 
  X, 
  Check, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  User as UserIcon,
  BookOpen,
  Star,
  History,
  Tag,
  FileText,
  Bookmark
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  Timestamp,
  User
} from './firebase';
import { cn } from './lib/utils';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday
} from 'date-fns';

// Types
type NoteType = 'note' | 'todo' | 'event';
type UPSCView = 'GS1' | 'GS2' | 'GS3' | 'GS4' | 'Optional' | 'Essay' | 'Prelims';

interface TodoItem {
  text: string;
  completed: boolean;
}

interface UPSCData {
  paper?: UPSCView;
  subject?: string;
  topic?: string;
  isImportant?: boolean;
  lastRevised?: Timestamp | null;
}

interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  color: string;
  isPinned: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  type: NoteType;
  tasks?: TodoItem[];
  dueDate?: Timestamp | null;
  upscData?: UPSCData;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const COLORS = [
  { name: 'Default', value: 'bg-white dark:bg-zinc-900' },
  { name: 'Red', value: 'bg-red-100 dark:bg-red-900/30' },
  { name: 'Orange', value: 'bg-orange-100 dark:bg-orange-900/30' },
  { name: 'Yellow', value: 'bg-yellow-100 dark:bg-yellow-900/30' },
  { name: 'Green', value: 'bg-green-100 dark:bg-green-900/30' },
  { name: 'Teal', value: 'bg-teal-100 dark:bg-teal-900/30' },
  { name: 'Blue', value: 'bg-blue-100 dark:bg-blue-900/30' },
  { name: 'Dark Blue', value: 'bg-indigo-100 dark:bg-indigo-900/30' },
  { name: 'Purple', value: 'bg-purple-100 dark:bg-purple-900/30' },
  { name: 'Pink', value: 'bg-pink-100 dark:bg-pink-900/30' },
  { name: 'Brown', value: 'bg-amber-100 dark:bg-amber-900/30' },
  { name: 'Grey', value: 'bg-gray-100 dark:bg-gray-800/30' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [view, setView] = useState<'notes' | 'calendar' | 'todo' | 'archive' | 'trash' | UPSCView>('notes');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isListView, setIsListView] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Notes Listener
  useEffect(() => {
    if (!user) {
      setNotes([]);
      return;
    }

    const q = query(collection(db, 'notes'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Note[];
      setNotes(notesData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
    });

    return unsubscribe;
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = () => signOut(auth);

  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      const matchesSearch = (note.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (note.content || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (note.upscData?.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (note.upscData?.topic || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      if (view === 'notes') return !note.isArchived && !note.isTrashed && matchesSearch;
      if (view === 'archive') return note.isArchived && !note.isTrashed && matchesSearch;
      if (view === 'trash') return note.isTrashed && matchesSearch;
      if (view === 'todo') return note.type === 'todo' && !note.isTrashed && matchesSearch;
      if (view === 'calendar') return note.dueDate && !note.isTrashed && matchesSearch;
      
      const upscViews: string[] = ['GS1', 'GS2', 'GS3', 'GS4', 'Optional', 'Essay', 'Prelims'];
      if (upscViews.includes(view)) {
        return note.upscData?.paper === view && !note.isTrashed && matchesSearch;
      }

      return matchesSearch;
    });
  }, [notes, view, searchQuery]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="h-8 w-8 border-4 border-yellow-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center space-y-6"
        >
          <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-2xl">
            <Lightbulb className="h-12 w-12 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">KeepPro UPSC</h1>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-sm">
            Advanced study notes for UPSC aspirants. Syllabus mapping, GS paper categorization, and revision tracking.
          </p>
          <button 
            onClick={handleLogin}
            className="flex items-center space-x-2 px-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="Google" />
            <span className="font-medium">Sign in with Google</span>
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden">
      <Sidebar 
        isOpen={isSidebarOpen} 
        view={view} 
        setView={setView} 
      />

      <div className="flex-1 flex flex-col min-w-0 relative">
        <Header 
          user={user}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isListView={isListView}
          setIsListView={setIsListView}
          handleLogout={handleLogout}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {view === 'notes' && <NoteCreator user={user} />}
            
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-200">
                {view === 'notes' ? 'All Notes' : view}
              </h2>
            </div>

            {view === 'calendar' ? (
              <CalendarView notes={notes} user={user} />
            ) : (
              <NoteGrid 
                notes={filteredNotes} 
                isListView={isListView} 
                onNoteClick={setSelectedNote}
              />
            )}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {selectedNote && (
          <NoteModal 
            note={selectedNote} 
            onClose={() => setSelectedNote(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Sidebar({ isOpen, view, setView }: { isOpen: boolean, view: string, setView: (v: any) => void }) {
  const mainItems = [
    { id: 'notes', icon: Lightbulb, label: 'Notes' },
    { id: 'todo', icon: CheckSquare, label: 'To-do' },
    { id: 'calendar', icon: CalendarIcon, label: 'Calendar' },
  ];

  const upscItems = [
    { id: 'GS1', icon: BookOpen, label: 'GS 1 (History/Geo)' },
    { id: 'GS2', icon: BookOpen, label: 'GS 2 (Polity/IR)' },
    { id: 'GS3', icon: BookOpen, label: 'GS 3 (Economy/Sci)' },
    { id: 'GS4', icon: BookOpen, label: 'GS 4 (Ethics)' },
    { id: 'Prelims', icon: Star, label: 'Prelims Special' },
    { id: 'Optional', icon: Tag, label: 'Optional' },
    { id: 'Essay', icon: History, label: 'Essay' },
  ];

  const systemItems = [
    { id: 'archive', icon: Archive, label: 'Archive' },
    { id: 'trash', icon: Trash2, label: 'Trash' },
  ];

  const renderItem = (item: any) => (
    <button
      key={item.id}
      onClick={() => setView(item.id)}
      className={cn(
        "flex items-center w-full px-6 py-2.5 transition-colors group relative",
        view === item.id 
          ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" 
          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
      )}
    >
      <item.icon className={cn("h-5 w-5 shrink-0", view === item.id ? "text-yellow-600 dark:text-yellow-400" : "")} />
      {isOpen && (
        <span className="ml-6 font-medium whitespace-nowrap overflow-hidden text-sm">
          {item.label}
        </span>
      )}
      {view === item.id && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500 rounded-r-full" />
      )}
    </button>
  );

  return (
    <motion.div 
      initial={false}
      animate={{ width: isOpen ? 280 : 80 }}
      className="hidden md:flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-20"
    >
      <div className="flex-1 py-4 overflow-y-auto custom-scrollbar">
        <div className="space-y-1">
          {mainItems.map(renderItem)}
        </div>
        
        {isOpen && <div className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-4">UPSC Papers</div>}
        <div className="space-y-1">
          {upscItems.map(renderItem)}
        </div>

        {isOpen && <div className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-4">System</div>}
        <div className="space-y-1">
          {systemItems.map(renderItem)}
        </div>
      </div>
    </motion.div>
  );
}

function Header({ user, isSidebarOpen, setIsSidebarOpen, searchQuery, setSearchQuery, isListView, setIsListView, handleLogout }: any) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <header className="h-16 flex items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-30">
      <div className="flex items-center space-x-4">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center space-x-2">
          <Lightbulb className="h-8 w-8 text-yellow-500" />
          <span className="text-xl font-semibold hidden sm:inline-block">KeepPro UPSC</span>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-4">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-zinc-600 dark:group-focus-within:text-zinc-300 transition-colors" />
          <input 
            type="text"
            placeholder="Search notes, subjects, or topics"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-lg py-2.5 pl-12 pr-4 focus:ring-2 focus:ring-yellow-500/50 focus:bg-white dark:focus:bg-zinc-800 transition-all outline-none"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button 
          onClick={() => setIsListView(!isListView)}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors hidden sm:flex"
        >
          {isListView ? <Grid className="h-5 w-5" /> : <List className="h-5 w-5" />}
        </button>
        
        <div className="relative">
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="h-9 w-9 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-800 hover:ring-2 hover:ring-yellow-500/50 transition-all"
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName} referrerPolicy="no-referrer" />
            ) : (
              <div className="h-full w-full bg-yellow-500 flex items-center justify-center text-white font-bold">
                {user.displayName?.[0] || 'U'}
              </div>
            )}
          </button>

          <AnimatePresence>
            {isProfileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 p-4"
                >
                  <div className="flex flex-col items-center text-center pb-4 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="h-16 w-16 rounded-full overflow-hidden mb-3 border-2 border-yellow-500">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName} referrerPolicy="no-referrer" />
                      ) : (
                        <div className="h-full w-full bg-yellow-500 flex items-center justify-center text-white text-2xl font-bold">
                          {user.displayName?.[0] || 'U'}
                        </div>
                      )}
                    </div>
                    <p className="font-semibold">{user.displayName}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{user.email}</p>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-4 py-3 mt-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                    <span className="font-medium">Sign out</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

function NoteCreator({ user }: { user: User }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<NoteType>('note');
  const [tasks, setTasks] = useState<TodoItem[]>([]);
  const [color, setColor] = useState(COLORS[0].value);
  const [dueDate, setDueDate] = useState<string>('');
  
  // UPSC Fields
  const [paper, setPaper] = useState<UPSCView | ''>('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [isImportant, setIsImportant] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (title || content || tasks.length > 0) {
          handleSave();
        } else {
          setIsExpanded(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [title, content, tasks, type, color, dueDate, paper, subject, topic, isImportant]);

  const handleSave = async () => {
    if (!title && !content && tasks.length === 0) {
      setIsExpanded(false);
      return;
    }

    try {
      await addDoc(collection(db, 'notes'), {
        userId: user.uid,
        title,
        content,
        type,
        tasks,
        color,
        dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate)) : null,
        upscData: {
          paper: paper || null,
          subject,
          topic,
          isImportant,
          lastRevised: serverTimestamp()
        },
        isPinned: false,
        isArchived: false,
        isTrashed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTitle(''); setContent(''); setTasks([]); setType('note'); setColor(COLORS[0].value); 
      setDueDate(''); setPaper(''); setSubject(''); setTopic(''); setIsImportant(false);
      setIsExpanded(false);
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const addTask = () => setTasks([...tasks, { text: '', completed: false }]);
  const updateTask = (index: number, text: string) => {
    const newTasks = [...tasks];
    newTasks[index].text = text;
    setTasks(newTasks);
  };
  const toggleTask = (index: number) => {
    const newTasks = [...tasks];
    newTasks[index].completed = !newTasks[index].completed;
    setTasks(newTasks);
  };

  return (
    <div ref={containerRef} className="max-w-2xl mx-auto">
      <motion.div 
        layout
        className={cn(
          "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden transition-all",
          isExpanded ? color : ""
        )}
      >
        {!isExpanded ? (
          <div 
            onClick={() => setIsExpanded(true)}
            className="flex items-center justify-between px-4 py-4 cursor-text text-zinc-500"
          >
            <span className="font-medium">Start a UPSC study note...</span>
            <div className="flex items-center space-x-2">
              <button onClick={(e) => { e.stopPropagation(); setIsExpanded(true); setType('todo'); addTask(); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"><CheckSquare className="h-5 w-5" /></button>
              <button onClick={(e) => { e.stopPropagation(); setIsExpanded(true); setType('event'); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"><CalendarIcon className="h-5 w-5" /></button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <input 
                type="text"
                placeholder="Topic Title (e.g. Morley-Minto Reforms)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent border-none text-xl font-bold outline-none placeholder:text-zinc-400"
                autoFocus
              />
              <button 
                onClick={() => setIsImportant(!isImportant)}
                className={cn("p-2 rounded-full transition-colors", isImportant ? "text-yellow-500 bg-yellow-500/10" : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800")}
              >
                <Star className={cn("h-5 w-5", isImportant && "fill-current")} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <select 
                value={paper} 
                onChange={(e) => setPaper(e.target.value as any)}
                className="bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg px-3 py-1.5 text-xs font-bold outline-none"
              >
                <option value="">Select Paper</option>
                <option value="GS1">GS 1</option>
                <option value="GS2">GS 2</option>
                <option value="GS3">GS 3</option>
                <option value="GS4">GS 4</option>
                <option value="Prelims">Prelims</option>
                <option value="Optional">Optional</option>
                <option value="Essay">Essay</option>
              </select>
              <input 
                type="text"
                placeholder="Subject (e.g. Modern History)"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg px-3 py-1.5 text-xs outline-none flex-1"
              />
              <input 
                type="text"
                placeholder="Topic (e.g. Constitutional Dev)"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg px-3 py-1.5 text-xs outline-none flex-1"
              />
            </div>

            {type === 'todo' ? (
              <div className="space-y-2">
                {tasks.map((task, i) => (
                  <div key={i} className="flex items-center space-x-2 group">
                    <button onClick={() => toggleTask(i)}>
                      {task.completed ? <CheckSquare className="h-5 w-5 text-yellow-500" /> : <div className="h-5 w-5 border-2 border-zinc-300 dark:border-zinc-700 rounded" />}
                    </button>
                    <input 
                      type="text"
                      value={task.text}
                      onChange={(e) => updateTask(i, e.target.value)}
                      placeholder="List item"
                      className={cn(
                        "flex-1 bg-transparent border-none outline-none",
                        task.completed && "line-through text-zinc-500"
                      )}
                    />
                  </div>
                ))}
                <button 
                  onClick={addTask}
                  className="flex items-center space-x-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 py-1"
                >
                  <Plus className="h-4 w-4" />
                  <span>List item</span>
                </button>
              </div>
            ) : (
              <textarea 
                placeholder="Detailed study notes, analysis, and key points..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-transparent border-none outline-none resize-none min-h-[150px] placeholder:text-zinc-400 leading-relaxed"
              />
            )}

            {type === 'event' && (
              <div className="flex items-center space-x-2 p-2 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg">
                <CalendarIcon className="h-4 w-4 text-zinc-500" />
                <input 
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-black/5 dark:border-white/5">
              <div className="flex items-center space-x-1">
                <ColorPicker color={color} onChange={setColor} />
                <button onClick={() => setType('note')} className={cn("p-2 rounded-full", type === 'note' && "bg-black/5")}><Lightbulb className="h-5 w-5" /></button>
                <button onClick={() => setType('todo')} className={cn("p-2 rounded-full", type === 'todo' && "bg-black/5")}><CheckSquare className="h-5 w-5" /></button>
                <button onClick={() => setType('event')} className={cn("p-2 rounded-full", type === 'event' && "bg-black/5")}><CalendarIcon className="h-5 w-5" /></button>
              </div>
              <div className="flex items-center space-x-3">
                <button onClick={() => setIsExpanded(false)} className="px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-800">Cancel</button>
                <button 
                  onClick={handleSave}
                  className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg transition-all shadow-lg shadow-yellow-500/20"
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function NoteGrid({ notes, isListView, onNoteClick }: { notes: Note[], isListView: boolean, onNoteClick: (n: Note) => void }) {
  const pinnedNotes = notes.filter(n => n.isPinned);
  const otherNotes = notes.filter(n => !n.isPinned);

  return (
    <div className="space-y-8">
      {pinnedNotes.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-2">Pinned</h3>
          <div className={cn(
            "grid gap-4",
            isListView ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          )}>
            {pinnedNotes.map(note => (
              <NoteCard key={note.id} note={note} onClick={() => onNoteClick(note)} />
            ))}
          </div>
        </div>
      )}

      {otherNotes.length > 0 && (
        <div className="space-y-4">
          {pinnedNotes.length > 0 && <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-2">Others</h3>}
          <div className={cn(
            "grid gap-4",
            isListView ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          )}>
            {otherNotes.map(note => (
              <NoteCard key={note.id} note={note} onClick={() => onNoteClick(note)} />
            ))}
          </div>
        </div>
      )}

      {notes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400 space-y-4">
          <Lightbulb className="h-24 w-24 opacity-20" />
          <p className="text-xl font-medium">Notes you add appear here</p>
        </div>
      )}
    </div>
  );
}

function NoteCard({ note, onClick }: { note: Note, onClick: () => void }) {
  const handleAction = async (e: React.MouseEvent, action: string) => {
    e.stopPropagation();
    try {
      const noteRef = doc(db, 'notes', note.id);
      if (action === 'pin') await updateDoc(noteRef, { isPinned: !note.isPinned });
      if (action === 'archive') await updateDoc(noteRef, { isArchived: !note.isArchived });
      if (action === 'trash') await updateDoc(noteRef, { isTrashed: !note.isTrashed });
      if (action === 'delete') await deleteDoc(noteRef);
      if (action === 'restore') await updateDoc(noteRef, { isTrashed: false });
    } catch (error) {
      console.error('Action failed:', error);
    }
  };

  return (
    <motion.div 
      layout
      onClick={onClick}
      className={cn(
        "group relative p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:shadow-xl transition-all cursor-default overflow-hidden",
        note.color,
        note.upscData?.isImportant && "ring-2 ring-yellow-500/50"
      )}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {note.upscData?.paper && (
              <span className="px-2 py-0.5 bg-yellow-500 text-white text-[10px] font-black rounded uppercase">
                {note.upscData.paper}
              </span>
            )}
            {note.upscData?.isImportant && <Star className="h-4 w-4 text-yellow-500 fill-current" />}
          </div>
          <h4 className="font-bold text-lg leading-tight">{note.title}</h4>
        </div>
        <button 
          onClick={(e) => handleAction(e, 'pin')}
          className={cn(
            "p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-opacity",
            note.isPinned ? "opacity-100 text-yellow-600" : "opacity-0 group-hover:opacity-100 text-zinc-400"
          )}
        >
          <Pin className={cn("h-4 w-4", note.isPinned && "fill-current")} />
        </button>
      </div>

      {note.upscData?.subject && (
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
          {note.upscData.subject} {note.upscData.topic ? `• ${note.upscData.topic}` : ''}
        </p>
      )}

      {note.type === 'todo' && note.tasks ? (
        <div className="space-y-1 mb-4">
          {note.tasks.slice(0, 5).map((task, i) => (
            <div key={i} className="flex items-center space-x-2 text-sm">
              {task.completed ? <CheckSquare className="h-4 w-4 text-yellow-500" /> : <div className="h-4 w-4 border border-zinc-400 rounded" />}
              <span className={cn(task.completed && "line-through text-zinc-500")}>{task.text}</span>
            </div>
          ))}
          {note.tasks.length > 5 && <p className="text-xs text-zinc-500">+{note.tasks.length - 5} more items</p>}
        </div>
      ) : (
        <p className="text-zinc-600 dark:text-zinc-300 text-sm line-clamp-4 mb-4 whitespace-pre-wrap leading-relaxed">
          {note.content}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {note.dueDate && (
          <div className="inline-flex items-center space-x-1.5 px-2 py-1 bg-black/5 dark:bg-white/5 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <CalendarIcon className="h-3 w-3" />
            <span>{format(note.dueDate.toDate(), 'MMM d')}</span>
          </div>
        )}
        {note.upscData?.lastRevised && (
          <div className="inline-flex items-center space-x-1.5 px-2 py-1 bg-black/5 dark:bg-white/5 rounded-full text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <History className="h-3 w-3" />
            <span>Rev: {format(note.upscData.lastRevised.toDate(), 'MMM d')}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {note.isTrashed ? (
          <>
            <button onClick={(e) => handleAction(e, 'delete')} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full text-red-500" title="Delete forever">
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={(e) => handleAction(e, 'restore')} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full" title="Restore">
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <button onClick={(e) => handleAction(e, 'archive')} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full" title="Archive">
              <Archive className="h-4 w-4" />
            </button>
            <button onClick={(e) => handleAction(e, 'trash')} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full" title="Trash">
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

function NoteModal({ note, onClose }: { note: Note, onClose: () => void }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tasks, setTasks] = useState<TodoItem[]>(note.tasks || []);
  const [color, setColor] = useState(note.color);
  const [dueDate, setDueDate] = useState(note.dueDate ? format(note.dueDate.toDate(), "yyyy-MM-dd'T'HH:mm") : '');
  
  // UPSC Fields
  const [paper, setPaper] = useState<UPSCView | ''>(note.upscData?.paper || '');
  const [subject, setSubject] = useState(note.upscData?.subject || '');
  const [topic, setTopic] = useState(note.upscData?.topic || '');
  const [isImportant, setIsImportant] = useState(note.upscData?.isImportant || false);

  const handleUpdate = async () => {
    try {
      await updateDoc(doc(db, 'notes', note.id), {
        title,
        content,
        tasks,
        color,
        dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate)) : null,
        upscData: {
          paper: paper || null,
          subject,
          topic,
          isImportant,
          lastRevised: serverTimestamp()
        },
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  const addTask = () => setTasks([...tasks, { text: '', completed: false }]);
  const updateTask = (index: number, text: string) => {
    const newTasks = [...tasks];
    newTasks[index].text = text;
    setTasks(newTasks);
  };
  const toggleTask = (index: number) => {
    const newTasks = [...tasks];
    newTasks[index].completed = !newTasks[index].completed;
    setTasks(newTasks);
  };
  const removeTask = (index: number) => setTasks(tasks.filter((_, i) => i !== index));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className={cn(
          "relative w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden",
          color
        )}
      >
        <div className="p-8 space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between">
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full bg-transparent border-none text-3xl font-bold outline-none placeholder:text-zinc-400"
            />
            <button 
              onClick={() => setIsImportant(!isImportant)}
              className={cn("p-2 rounded-full transition-colors", isImportant ? "text-yellow-500 bg-yellow-500/10" : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800")}
            >
              <Star className={cn("h-6 w-6", isImportant && "fill-current")} />
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center space-x-2 bg-black/5 dark:bg-white/5 px-3 py-1.5 rounded-lg">
              <BookOpen className="h-4 w-4 text-zinc-500" />
              <select 
                value={paper} 
                onChange={(e) => setPaper(e.target.value as any)}
                className="bg-transparent border-none text-sm font-bold outline-none"
              >
                <option value="">No Paper</option>
                <option value="GS1">GS 1</option>
                <option value="GS2">GS 2</option>
                <option value="GS3">GS 3</option>
                <option value="GS4">GS 4</option>
                <option value="Prelims">Prelims</option>
                <option value="Optional">Optional</option>
                <option value="Essay">Essay</option>
              </select>
            </div>
            <div className="flex items-center space-x-2 bg-black/5 dark:bg-white/5 px-3 py-1.5 rounded-lg flex-1">
              <Tag className="h-4 w-4 text-zinc-500" />
              <input 
                type="text"
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="bg-transparent border-none text-sm outline-none w-full"
              />
            </div>
            <div className="flex items-center space-x-2 bg-black/5 dark:bg-white/5 px-3 py-1.5 rounded-lg flex-1">
              <Bookmark className="h-4 w-4 text-zinc-500" />
              <input 
                type="text"
                placeholder="Topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="bg-transparent border-none text-sm outline-none w-full"
              />
            </div>
          </div>

          {note.type === 'todo' ? (
            <div className="space-y-3">
              {tasks.map((task, i) => (
                <div key={i} className="flex items-center space-x-3 group">
                  <button onClick={() => toggleTask(i)}>
                    {task.completed ? <CheckSquare className="h-5 w-5 text-yellow-500" /> : <div className="h-5 w-5 border-2 border-zinc-300 dark:border-zinc-700 rounded" />}
                  </button>
                  <input 
                    type="text"
                    value={task.text}
                    onChange={(e) => updateTask(i, e.target.value)}
                    className={cn(
                      "flex-1 bg-transparent border-none outline-none text-lg",
                      task.completed && "line-through text-zinc-500"
                    )}
                  />
                  <button onClick={() => removeTask(i)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded">
                    <X className="h-4 w-4 text-zinc-400" />
                  </button>
                </div>
              ))}
              <button 
                onClick={addTask}
                className="flex items-center space-x-3 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 py-2"
              >
                <Plus className="h-5 w-5" />
                <span className="text-lg">List item</span>
              </button>
            </div>
          ) : (
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Detailed study notes..."
              className="w-full bg-transparent border-none outline-none resize-none min-h-[300px] text-lg placeholder:text-zinc-400 leading-relaxed"
            />
          )}

          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-black/5 dark:border-white/5">
            <div className="flex items-center space-x-2 p-2 bg-black/5 dark:bg-white/5 rounded-lg">
              <CalendarIcon className="h-4 w-4 text-zinc-500" />
              <input 
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-transparent border-none outline-none text-sm"
              />
            </div>
            <ColorPicker color={color} onChange={setColor} />
            <div className="flex items-center space-x-2 text-xs text-zinc-500">
              <History className="h-4 w-4" />
              <span>Last Revised: {note.upscData?.lastRevised ? format(note.upscData.lastRevised.toDate(), 'MMM d, yyyy') : 'Never'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <p className="text-xs text-zinc-500">
              Created {format(note.createdAt.toDate(), 'MMM d, yyyy')}
            </p>
            <div className="flex items-center space-x-3">
              <button 
                onClick={onClose}
                className="px-6 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdate}
                className="px-10 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl transition-all shadow-xl shadow-yellow-500/20"
              >
                Update Note
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ColorPicker({ color, onChange }: { color: string, onChange: (c: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full"
      >
        <Palette className="h-5 w-5" />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 grid grid-cols-4 gap-1"
            >
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => { onChange(c.value); setIsOpen(false); }}
                  className={cn(
                    "h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-700 transition-transform hover:scale-110",
                    c.value,
                    color === c.value && "ring-2 ring-yellow-500 ring-offset-2 dark:ring-offset-zinc-800"
                  )}
                  title={c.name}
                />
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function CalendarView({ notes, user }: { notes: Note[], user: User }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getNotesForDay = (day: Date) => {
    return notes.filter(note => note.dueDate && isSameDay(note.dueDate.toDate(), day));
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
      <div className="p-6 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-2xl font-bold">{format(currentDate, 'MMMM yyyy')}</h2>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button 
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg font-medium"
          >
            Today
          </button>
          <button 
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-3 text-center text-xs font-bold text-zinc-500 uppercase tracking-widest">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {calendarDays.map((day, i) => {
          const dayNotes = getNotesForDay(day);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isTodayDay = isToday(day);
          const isSelected = selectedDay && isSameDay(day, selectedDay);

          return (
            <div 
              key={i}
              onClick={() => setSelectedDay(day)}
              className={cn(
                "min-h-[120px] p-2 border-r border-b border-zinc-100 dark:border-zinc-800 transition-colors cursor-pointer",
                !isCurrentMonth && "bg-zinc-50/50 dark:bg-zinc-950/50",
                isSelected && "bg-yellow-50/50 dark:bg-yellow-900/10"
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={cn(
                  "h-7 w-7 flex items-center justify-center rounded-full text-sm font-medium",
                  isTodayDay ? "bg-yellow-500 text-white" : isCurrentMonth ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"
                )}>
                  {format(day, 'd')}
                </span>
              </div>
              <div className="space-y-1">
                {dayNotes.slice(0, 3).map(note => (
                  <div 
                    key={note.id}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-medium truncate border border-black/5 dark:border-white/5",
                      note.color
                    )}
                  >
                    {note.title || 'Untitled'}
                  </div>
                ))}
                {dayNotes.length > 3 && (
                  <p className="text-[10px] text-zinc-500 font-bold pl-1">
                    +{dayNotes.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
