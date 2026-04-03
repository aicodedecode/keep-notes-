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
  Archive, 
  Trash2, 
  Lightbulb, 
  CheckSquare, 
  Calendar as CalendarIcon, 
  Plus, 
  Pin, 
  Palette, 
  X, 
  Check,
  Trash,
  ChevronLeft, 
  ChevronRight,
  LogOut,
  History,
  Tag,
  Settings,
  Clock,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactQuill from 'react-quill-new';
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

interface TodoItem {
  text: string;
  completed: boolean;
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
  labels?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const COLORS = [
  { name: 'Default', value: 'bg-white dark:bg-zinc-900' },
  { name: 'Red', value: 'bg-red-50/80 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
  { name: 'Orange', value: 'bg-orange-50/80 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
  { name: 'Yellow', value: 'bg-yellow-50/80 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' },
  { name: 'Green', value: 'bg-green-50/80 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
  { name: 'Teal', value: 'bg-teal-50/80 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800' },
  { name: 'Blue', value: 'bg-blue-50/80 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
  { name: 'Indigo', value: 'bg-indigo-50/80 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' },
  { name: 'Purple', value: 'bg-purple-50/80 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
  { name: 'Pink', value: 'bg-pink-50/80 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800' },
  { name: 'Brown', value: 'bg-amber-50/80 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
  { name: 'Grey', value: 'bg-gray-50/80 dark:bg-gray-800/20 border-gray-200 dark:border-gray-700' },
  // Premium Gradients
  { name: 'Sunset', value: 'bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-orange-200 dark:border-red-800' },
  { name: 'Ocean', value: 'bg-gradient-to-br from-blue-50 to-teal-50 dark:from-blue-900/20 dark:to-teal-900/20 border-blue-200 dark:border-teal-800' },
  { name: 'Lavender', value: 'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-pink-800' },
  { name: 'Forest', value: 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-emerald-800' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [view, setView] = useState<'notes' | 'calendar' | 'todo' | 'archive' | 'trash' | 'stats'>('notes');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isListView, setIsListView] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('theme') as any) || 'system';
  });

  // Theme effect
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.toggle('dark', systemTheme === 'dark');
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

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
    setLoginError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Login failed:', error);
      if (error.code === 'auth/unauthorized-domain') {
        setLoginError(`Domain not authorized. Please add "${window.location.hostname}" to your Firebase Console > Auth > Settings > Authorized Domains.`);
      } else if (error.code === 'auth/popup-closed-by-user') {
        setLoginError('Sign-in popup was closed before completion.');
      } else {
        setLoginError(error.message || 'An unexpected error occurred during sign-in.');
      }
    }
  };

  const handleLogout = () => signOut(auth);

  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      const matchesSearch = (note.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (note.content || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                           note.labels?.some(l => l.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (view === 'notes') return !note.isArchived && !note.isTrashed && matchesSearch;
      if (view === 'archive') return note.isArchived && !note.isTrashed && matchesSearch;
      if (view === 'trash') return note.isTrashed && matchesSearch;
      if (view === 'todo') return note.type === 'todo' && !note.isTrashed && matchesSearch;
      if (view === 'calendar') return note.dueDate && !note.isTrashed && matchesSearch;
      if (view.startsWith('label:')) {
        const label = view.split(':')[1];
        return note.labels?.includes(label) && !note.isTrashed && matchesSearch;
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
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">KeepPro</h1>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-sm">
            A premium note-taking experience. Organize your thoughts, tasks, and schedule with ease.
          </p>
          <button 
            onClick={handleLogin}
            className="flex items-center space-x-2 px-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="Google" />
            <span className="font-medium">Sign in with Google</span>
          </button>

          {loginError && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl max-w-md"
            >
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                {loginError}
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden">
      <Sidebar 
        isOpen={isSidebarOpen} 
        view={view} 
        setView={(v) => {
          setView(v);
          if (window.innerWidth < 768) setIsSidebarOpen(false);
        }} 
        onClose={() => setIsSidebarOpen(false)}
        notes={notes}
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
          theme={theme}
          setTheme={setTheme}
        />

        <main className="flex-1 overflow-y-auto p-3 md:p-8">
          <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
            {view === 'notes' && (
              <div className="space-y-6">
                <div className="px-1">
                  <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                    Welcome back, {user.displayName?.split(' ')[0]}!
                  </h1>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                    Here's what's happening with your notes today.
                  </p>
                </div>
                <NoteCreator user={user} />
              </div>
            )}
            
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xl md:text-2xl font-bold text-zinc-800 dark:text-zinc-200 capitalize">
                {view.startsWith('label:') ? `Label: ${view.split(':')[1]}` : (view === 'notes' ? 'All Notes' : view)}
              </h2>
            </div>

            {view === 'calendar' ? (
              <CalendarView notes={notes} onNoteClick={setSelectedNote} />
            ) : view === 'stats' ? (
              <StatsView notes={notes} />
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

function Sidebar({ isOpen, view, setView, onClose, notes }: { isOpen: boolean, view: string, setView: (v: any) => void, onClose: () => void, notes: Note[] }) {
  const mainItems = [
    { id: 'notes', icon: Lightbulb, label: 'Notes' },
    { id: 'todo', icon: CheckSquare, label: 'To-do' },
    { id: 'calendar', icon: CalendarIcon, label: 'Calendar' },
  ];

  const systemItems = [
    { id: 'archive', icon: Archive, label: 'Archive' },
    { id: 'trash', icon: Trash2, label: 'Trash' },
    { id: 'stats', icon: History, label: 'Statistics' },
  ];

  const labels = useMemo(() => {
    const allLabels = new Set<string>();
    notes.forEach(note => {
      note.labels?.forEach(label => allLabels.add(label));
    });
    return Array.from(allLabels).sort();
  }, [notes]);

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
      {(isOpen || window.innerWidth < 768) && (
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
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      <motion.div 
        initial={false}
        animate={{ 
          width: isOpen ? 280 : (window.innerWidth < 768 ? 0 : 80),
          x: isOpen ? 0 : (window.innerWidth < 768 ? -280 : 0)
        }}
        className={cn(
          "fixed md:relative inset-y-0 left-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-50 transition-all",
          !isOpen && "md:w-20"
        )}
      >
        <div className="flex items-center justify-between p-4 md:hidden">
          <div className="flex items-center space-x-2">
            <Lightbulb className="h-8 w-8 text-yellow-500" />
            <span className="text-xl font-semibold">KeepPro</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 py-4 overflow-y-auto custom-scrollbar">
          <div className="space-y-1">
            {mainItems.map(renderItem)}
          </div>
          
          {labels.length > 0 && (
            <>
              {(isOpen || window.innerWidth < 768) && <div className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-4">Labels</div>}
              <div className="space-y-1">
                {labels.map(label => (
                  <button
                    key={label}
                    onClick={() => setView(`label:${label}`)}
                    className={cn(
                      "flex items-center w-full px-6 py-2.5 transition-colors group relative",
                      view === `label:${label}` 
                        ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" 
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    )}
                  >
                    <Tag className={cn("h-5 w-5 shrink-0", view === `label:${label}` ? "text-yellow-600 dark:text-yellow-400" : "")} />
                    {(isOpen || window.innerWidth < 768) && (
                      <span className="ml-6 font-medium whitespace-nowrap overflow-hidden text-sm">
                        {label}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
          
          {(isOpen || window.innerWidth < 768) && <div className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-4">System</div>}
          <div className="space-y-1">
            {systemItems.map(renderItem)}
          </div>
        </div>
      </motion.div>
    </>
  );
}

function Header({ user, isSidebarOpen, setIsSidebarOpen, searchQuery, setSearchQuery, isListView, setIsListView, handleLogout, theme, setTheme }: any) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <header className="h-16 flex items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-30">
      <div className="flex items-center space-x-4 shrink-0">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center space-x-2">
          <Lightbulb className="h-8 w-8 text-yellow-500" />
          <span className="text-xl font-semibold hidden lg:inline-block">KeepPro</span>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-1 md:mx-4">
        <div className="relative group">
          <Search className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 md:h-5 md:w-5 text-zinc-400 group-focus-within:text-zinc-600 dark:group-focus-within:text-zinc-300 transition-colors" />
          <input 
            type="text"
            placeholder="Search notes, labels, or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-lg py-1.5 md:py-2 pl-7 md:pl-12 pr-3 md:pr-4 focus:ring-2 focus:ring-yellow-500/50 focus:bg-white dark:focus:bg-zinc-800 transition-all outline-none text-xs md:text-base"
          />
        </div>
      </div>

      <div className="flex items-center space-x-1 md:space-x-2 shrink-0">
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full text-zinc-500 transition-colors"
          title="Toggle theme"
        >
          {theme === 'dark' ? <Lightbulb className="h-5 w-5" /> : <Settings className="h-5 w-5" />}
        </button>

        <button 
          onClick={() => setIsListView(!isListView)}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full text-zinc-500 transition-colors hidden sm:flex"
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
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);

  const quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ],
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (title || (content && content !== '<p><br></p>') || tasks.length > 0 || labels.length > 0) {
          handleSave();
        } else {
          setIsExpanded(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [title, content, tasks, type, color, dueDate, labels]);

  const handleSave = async () => {
    if (!title && (!content || content === '<p><br></p>') && tasks.length === 0 && labels.length === 0) {
      setIsExpanded(false);
      return;
    }

    try {
      await addDoc(collection(db, 'notes'), {
        userId: user.uid,
        title,
        content: content === '<p><br></p>' ? '' : content,
        type,
        tasks,
        color,
        dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate)) : null,
        labels,
        isPinned: false,
        isArchived: false,
        isTrashed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTitle(''); setContent(''); setTasks([]); setType('note'); setColor(COLORS[0].value); 
      setDueDate(''); setLabels([]); setLabelInput('');
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

  const addLabel = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && labelInput.trim()) {
      e.preventDefault();
      if (!labels.includes(labelInput.trim())) {
        setLabels([...labels, labelInput.trim()]);
      }
      setLabelInput('');
    }
  };

  const removeLabel = (label: string) => setLabels(labels.filter(l => l !== label));

  return (
    <div ref={containerRef} className="max-w-2xl mx-auto">
      <motion.div 
        layout
        className={cn(
          "bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden transition-all",
          isExpanded ? color : ""
        )}
      >
        {!isExpanded ? (
          <div 
            onClick={() => setIsExpanded(true)}
            className="flex items-center justify-between px-4 py-4 cursor-text text-zinc-500"
          >
            <span className="font-medium">
              Take a note...
            </span>
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
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent border-none text-xl font-bold outline-none placeholder:text-zinc-400"
                autoFocus
              />
            </div>

            {labels.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {labels.map(label => (
                  <span key={label} className="inline-flex items-center space-x-1 px-2 py-1 bg-black/5 dark:bg-white/5 rounded-full text-xs font-medium group/label">
                    <span>{label}</span>
                    <button onClick={() => removeLabel(label)} className="hover:text-red-500"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}

            {type === 'todo' ? (
              <div className="space-y-2">
                {tasks.map((task, i) => (
                  <div key={i} className="flex items-center space-x-2 group bg-black/5 dark:bg-white/5 p-2 rounded-lg">
                    <button onClick={() => toggleTask(i)} className="shrink-0">
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
                  className="flex items-center space-x-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 py-1 px-2"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">Add item</span>
                </button>
              </div>
            ) : (
              <div className="rich-text-editor">
                <ReactQuill 
                  theme="snow" 
                  value={content} 
                  onChange={setContent}
                  modules={quillModules}
                  placeholder="Note content..."
                />
              </div>
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
                <div className="relative group/label-input">
                  <button className="p-2 rounded-full hover:bg-black/5"><Tag className="h-5 w-5" /></button>
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover/label-input:block bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 shadow-xl z-50 w-48">
                    <input 
                      type="text"
                      placeholder="Add label..."
                      value={labelInput}
                      onChange={(e) => setLabelInput(e.target.value)}
                      onKeyDown={addLabel}
                      className="w-full bg-transparent border-none outline-none text-sm"
                    />
                  </div>
                </div>
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
  const [isDeleting, setIsDeleting] = useState(false);
  const handleAction = async (e: React.MouseEvent, action: string) => {
    e.stopPropagation();
    try {
      const noteRef = doc(db, 'notes', note.id);
      if (action === 'pin') await updateDoc(noteRef, { isPinned: !note.isPinned });
      if (action === 'archive') await updateDoc(noteRef, { isArchived: !note.isArchived });
      if (action === 'trash') await updateDoc(noteRef, { isTrashed: !note.isTrashed });
      if (action === 'delete') {
        await deleteDoc(noteRef);
        setIsDeleting(false);
      }
      if (action === 'restore') await updateDoc(noteRef, { isTrashed: false });
      if (action === 'duplicate') {
        const { id, ...noteData } = note;
        await addDoc(collection(db, 'notes'), {
          ...noteData,
          title: `${note.title} (Copy)`,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      if (action === 'copy') {
        const text = note.type === 'todo' 
          ? note.tasks?.map(t => `${t.completed ? '✓' : '○'} ${t.text}`).join('\n')
          : note.content.replace(/<[^>]*>/g, '');
        await navigator.clipboard.writeText(`${note.title}\n\n${text}`);
      }
    } catch (error) {
      console.error('Action failed:', error);
    }
  };

  return (
    <motion.div 
      layout
      onClick={onClick}
      className={cn(
        "group relative p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:shadow-2xl transition-all cursor-default overflow-hidden backdrop-blur-sm",
        note.color
      )}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
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

      {note.type === 'todo' && note.tasks ? (
        <div className="space-y-1.5 mb-4">
          {note.tasks.slice(0, 5).map((task, i) => (
            <div key={i} className="flex items-center space-x-2 text-sm">
              {task.completed ? <CheckSquare className="h-4 w-4 text-yellow-500" /> : <div className="h-4 w-4 border border-zinc-400 rounded" />}
              <span className={cn("truncate", task.completed && "line-through text-zinc-500")}>{task.text}</span>
            </div>
          ))}
          {note.tasks.length > 5 && <p className="text-xs text-zinc-500 font-medium pl-6">+{note.tasks.length - 5} more items</p>}
        </div>
      ) : (
        <div 
          className="text-zinc-600 dark:text-zinc-300 text-sm line-clamp-4 mb-4 markdown-body"
          dangerouslySetInnerHTML={{ __html: note.content }}
        />
      )}

      {note.labels && note.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {note.labels.map(label => (
            <span key={label} className="px-2 py-0.5 bg-black/5 dark:bg-white/5 rounded text-[10px] font-medium text-zinc-500">
              {label}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {note.dueDate && (
          <div className="inline-flex items-center space-x-1.5 px-2 py-1 bg-black/5 dark:bg-white/5 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <CalendarIcon className="h-3 w-3" />
            <span>{format(note.dueDate.toDate(), 'MMM d')}</span>
          </div>
        )}
        <div className="inline-flex items-center space-x-1.5 px-2 py-1 text-[10px] font-medium text-zinc-400">
          <Clock className="h-3 w-3" />
          <span>{note.updatedAt ? format(note.updatedAt.toDate(), 'MMM d, h:mm a') : 'Just now'}</span>
        </div>
      </div>

      <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isDeleting ? (
          <div className="flex items-center bg-red-50 dark:bg-red-900/20 rounded-lg px-2 py-1 animate-in fade-in slide-in-from-right-2">
            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 mr-2 uppercase">Permanently?</span>
            <button 
              onClick={(e) => handleAction(e, 'delete')}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded text-red-600"
              title="Confirm Delete"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsDeleting(false); }}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500"
              title="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : note.isTrashed ? (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsDeleting(true); }} 
              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full text-red-500 transition-colors" 
              title="Delete permanently"
            >
              <Trash className="h-4 w-4" />
            </button>
            <button onClick={(e) => handleAction(e, 'restore')} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full" title="Restore">
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <button 
              onClick={(e) => handleAction(e, 'copy')}
              className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full text-zinc-500"
              title="Copy to clipboard"
            >
              <FileText className="h-4 w-4" />
            </button>
            <button 
              onClick={(e) => handleAction(e, 'duplicate')}
              className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full text-zinc-500"
              title="Duplicate"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button onClick={(e) => handleAction(e, 'archive')} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full" title="Archive">
              <Archive className="h-4 w-4" />
            </button>
            <button onClick={(e) => handleAction(e, 'trash')} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full" title="Delete">
              <Trash2 className="h-4 w-4" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsDeleting(true); }} 
              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full text-red-500/50 hover:text-red-500 transition-colors" 
              title="Delete permanently"
            >
              <Trash className="h-4 w-4" />
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
  const [labels, setLabels] = useState<string[]>(note.labels || []);
  const [labelInput, setLabelInput] = useState('');
  
  const quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ],
  };

  const handleUpdate = async () => {
    try {
      await updateDoc(doc(db, 'notes', note.id), {
        title,
        content: content === '<p><br></p>' ? '' : content,
        tasks,
        color,
        dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate)) : null,
        labels,
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

  const addLabel = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && labelInput.trim()) {
      e.preventDefault();
      if (!labels.includes(labelInput.trim())) {
        setLabels([...labels, labelInput.trim()]);
      }
      setLabelInput('');
    }
  };

  const removeLabel = (label: string) => setLabels(labels.filter(l => l !== label));

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
          "relative w-full max-w-3xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl rounded-3xl shadow-2xl overflow-hidden",
          color
        )}
      >
        <div className="p-6 md:p-8 space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between">
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full bg-transparent border-none text-2xl md:text-3xl font-bold outline-none placeholder:text-zinc-400"
            />
          </div>

          {labels.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {labels.map(label => (
                <span key={label} className="inline-flex items-center space-x-2 px-3 py-1.5 bg-black/5 dark:bg-white/5 rounded-full text-sm font-medium group/label">
                  <span>{label}</span>
                  <button onClick={() => removeLabel(label)} className="hover:text-red-500"><X className="h-4 w-4" /></button>
                </span>
              ))}
            </div>
          )}

          {note.type === 'todo' ? (
            <div className="space-y-3">
              {tasks.map((task, i) => (
                <div key={i} className="flex items-center space-x-3 group bg-black/5 dark:bg-white/5 p-3 rounded-xl">
                  <button onClick={() => toggleTask(i)} className="shrink-0">
                    {task.completed ? <CheckSquare className="h-6 w-6 text-yellow-500" /> : <div className="h-6 w-6 border-2 border-zinc-300 dark:border-zinc-700 rounded" />}
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
                  <button onClick={() => removeTask(i)} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all">
                    <X className="h-5 w-5 text-zinc-400" />
                  </button>
                </div>
              ))}
              <button 
                onClick={addTask}
                className="flex items-center space-x-3 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 py-3 px-4 bg-black/5 dark:bg-white/5 rounded-xl w-full"
              >
                <Plus className="h-5 w-5" />
                <span className="text-lg font-medium">Add another item</span>
              </button>
            </div>
          ) : (
            <div className="rich-text-editor">
              <ReactQuill 
                theme="snow" 
                value={content} 
                onChange={setContent}
                modules={quillModules}
                placeholder="Note content..."
              />
            </div>
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
            <div className="relative group/label-input">
              <button className="p-2 rounded-full hover:bg-black/5"><Tag className="h-5 w-5" /></button>
              <div className="absolute bottom-full left-0 mb-2 hidden group-hover/label-input:block bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 shadow-xl z-50 w-48">
                <input 
                  type="text"
                  placeholder="Add label..."
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={addLabel}
                  className="w-full bg-transparent border-none outline-none text-sm"
                />
              </div>
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

function StatsView({ notes }: { notes: Note[] }) {
  const stats = useMemo(() => {
    const total = notes.length;
    const pinned = notes.filter(n => n.isPinned).length;
    const archived = notes.filter(n => n.isArchived).length;
    const trashed = notes.filter(n => n.isTrashed).length;
    const active = notes.filter(n => !n.isArchived && !n.isTrashed).length;
    
    const types = {
      note: notes.filter(n => n.type === 'note').length,
      todo: notes.filter(n => n.type === 'todo').length,
      event: notes.filter(n => n.type === 'event').length,
    };

    const labelCounts: Record<string, number> = {};
    notes.forEach(n => {
      n.labels?.forEach(l => {
        labelCounts[l] = (labelCounts[l] || 0) + 1;
      });
    });

    return { total, pinned, archived, trashed, active, types, labelCounts };
  }, [notes]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Notes', value: stats.active, icon: Lightbulb, color: 'text-yellow-500' },
          { label: 'Pinned', value: stats.pinned, icon: Pin, color: 'text-blue-500' },
          { label: 'Archived', value: stats.archived, icon: Archive, color: 'text-zinc-500' },
          { label: 'Trashed', value: stats.trashed, icon: Trash2, color: 'text-red-500' },
        ].map((item, i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800", item.color)}>
                <item.icon className="h-6 w-6" />
              </div>
              <span className="text-3xl font-bold">{item.value}</span>
            </div>
            <p className="text-sm font-medium text-zinc-500">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="text-lg font-bold mb-6">Note Types</h3>
          <div className="space-y-4">
            {Object.entries(stats.types).map(([type, count]) => (
              <div key={type} className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span className="capitalize">{type}s</span>
                  <span>{count}</span>
                </div>
                <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / stats.total) * 100}%` }}
                    className="h-full bg-yellow-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="text-lg font-bold mb-6">Top Labels</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.labelCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([label, count]) => (
                <div key={label} className="flex items-center space-x-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                  <Tag className="h-4 w-4 text-zinc-500" />
                  <span className="font-bold">{label}</span>
                  <span className="text-xs text-zinc-500 bg-white dark:bg-zinc-900 px-1.5 py-0.5 rounded-md">{count}</span>
                </div>
              ))}
            {Object.keys(stats.labelCounts).length === 0 && (
              <p className="text-zinc-500 italic">No labels yet</p>
            )}
          </div>
        </div>
      </div>
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

function CalendarView({ notes, onNoteClick }: { notes: Note[], onNoteClick: (note: Note) => void }) {
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

  const selectedDayNotes = selectedDay ? getNotesForDay(selectedDay) : [];

  return (
    <div className="space-y-8">
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
                  "min-h-[70px] md:min-h-[120px] p-1 md:p-2 border-r border-b border-zinc-100 dark:border-zinc-800 transition-all cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50",
                  !isCurrentMonth && "bg-zinc-50/50 dark:bg-zinc-950/50 opacity-40",
                  isSelected && "bg-yellow-50/50 dark:bg-yellow-900/10 ring-2 ring-inset ring-yellow-500/50 z-10"
                )}
              >
                <div className="flex justify-between items-start mb-1 md:mb-2">
                  <span className={cn(
                    "h-6 w-6 md:h-7 md:w-7 flex items-center justify-center rounded-full text-xs md:text-sm font-bold",
                    isTodayDay ? "bg-yellow-500 text-white" : "text-zinc-700 dark:text-zinc-300"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {dayNotes.length > 0 && (
                    <span className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-yellow-500 animate-pulse" />
                  )}
                </div>
                <div className="hidden md:block space-y-1">
                  {dayNotes.slice(0, 2).map(note => (
                    <div 
                      key={note.id}
                      className={cn(
                        "text-[10px] p-1 rounded truncate font-bold",
                        note.color || "bg-zinc-100 dark:bg-zinc-800"
                      )}
                    >
                      {note.title || 'Untitled'}
                    </div>
                  ))}
                  {dayNotes.length > 2 && (
                    <div className="text-[10px] text-zinc-400 font-bold pl-1">+{dayNotes.length - 2} more</div>
                  )}
                </div>
                {/* Mobile indicator for notes */}
                <div className="md:hidden flex justify-center mt-1">
                  {dayNotes.length > 0 && (
                    <div className="flex -space-x-1">
                      {dayNotes.slice(0, 3).map((note, idx) => (
                        <div key={idx} className={cn("h-1.5 w-1.5 rounded-full border border-white dark:border-zinc-900", note.color || "bg-zinc-400")} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedDay && (
          <motion.div
            key={selectedDay.toISOString()}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">
                Tasks for {format(selectedDay, 'MMMM d, yyyy')}
              </h3>
              <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs font-bold text-zinc-500">
                {selectedDayNotes.length} {selectedDayNotes.length === 1 ? 'Task' : 'Tasks'}
              </span>
            </div>

            {selectedDayNotes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedDayNotes.map(note => (
                  <NoteCard key={note.id} note={note} onClick={() => onNoteClick(note)} />
                ))}
              </div>
            ) : (
              <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center">
                <CalendarIcon className="h-12 w-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
                <p className="text-zinc-500 font-medium">No tasks scheduled for this day</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
