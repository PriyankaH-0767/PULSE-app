import fs from "fs";
import path from "path";
import { DatabaseState, Task, Habit, ScheduleBlock, UrgentAlert, HabitNudge, AgentRun, EnergyProfile } from "../src/types";
import { 
  firestoreDb, 
  isConfigured, 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  deleteDoc,
  OperationType,
  handleFirestoreError
} from "./firebase";

const DB_FILE = path.join(process.cwd(), "data", "db.json");

const DEFAULT_STATE: DatabaseState = {
  tasks: [
    {
      id: "t1",
      title: "Review Life Saver Agent system instructions",
      deadline: new Date(new Date().setHours(18, 0, 0, 0)).toISOString(), // 6:00 PM today
      priority: "High",
      estimatedMinutes: 45,
      status: "pending",
      alarmTriggered: false,
      subtasks: [
        { step: "Check function definitions", estimatedMinutes: 15, done: false },
        { step: "Verify tool call execution loops", estimatedMinutes: 30, done: false }
      ],
      source: "manual"
    },
    {
      id: "t2",
      title: "Finalize quarter roadmap slides",
      deadline: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString(), // Tomorrow
      priority: "Medium",
      estimatedMinutes: 90,
      status: "pending",
      alarmTriggered: false,
      subtasks: [],
      source: "manual"
    },
    {
      id: "t3",
      title: "Schedule dry-run with product leads",
      deadline: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString(), // In 2 days
      priority: "Low",
      estimatedMinutes: 20,
      status: "pending",
      alarmTriggered: false,
      subtasks: [],
      source: "manual"
    }
  ],
  habits: [
    {
      id: "h1",
      name: "Check Calendar & Deadlines",
      currentStreak: 5,
      lastLoggedDate: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split("T")[0] // Yesterday
    },
    {
      id: "h2",
      name: "Organize Daily Focus List",
      currentStreak: 3,
      lastLoggedDate: null // Not logged today
    },
    {
      id: "h3",
      name: "Read 15 Pages of Book",
      currentStreak: 12,
      lastLoggedDate: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split("T")[0] // Yesterday
    }
  ],
  scheduleBlocks: [],
  urgentAlerts: [],
  habitNudges: [],
  agentRuns: [],
  energyProfile: "steady"
};

export class FileDatabase {
  private state: DatabaseState;

  constructor() {
    this.state = this.load();
    // Start asynchronous Firestore sync
    this.syncFromFirestore().catch(err => {
      console.error("[Firebase] Initialization sync error:", err);
    });
  }

  private load(): DatabaseState {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_STATE, null, 2), "utf-8");
        return JSON.parse(JSON.stringify(DEFAULT_STATE));
      }
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (!parsed.energyProfile) {
        parsed.energyProfile = "steady";
      }
      return parsed;
    } catch (e) {
      console.error("Failed to load database file, using fallback state:", e);
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  }

  public saveLocalOnly(): void {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to save local database file:", e);
    }
  }

  public save(): void {
    this.saveLocalOnly();
    // Write full sync to Firestore in background
    this.syncToFirestoreAll().catch(err => {
      console.error("[Firebase] Async save to Firestore failed:", err);
    });
  }

  // --- Firestore Integration CRUD Syncing ---

  public async syncFromFirestore(): Promise<void> {
    if (!isConfigured || !firestoreDb) {
      console.log("[Firebase] Firestore is not initialized or configured yet.");
      return;
    }
    try {
      console.log("[Firebase] Starting database synchronization from Firestore...");
      
      // Fetch tasks
      let tasksSnap;
      try {
        tasksSnap = await getDocs(collection(firestoreDb, "tasks"));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, "tasks");
        return;
      }
      const tasks: Task[] = [];
      tasksSnap.forEach(docSnap => {
        tasks.push(docSnap.data() as Task);
      });

      // Fetch habits
      let habitsSnap;
      try {
        habitsSnap = await getDocs(collection(firestoreDb, "habits"));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, "habits");
        return;
      }
      const habits: Habit[] = [];
      habitsSnap.forEach(docSnap => {
        habits.push(docSnap.data() as Habit);
      });

      // Fetch scheduleBlocks
      let scheduleBlocksSnap;
      try {
        scheduleBlocksSnap = await getDocs(collection(firestoreDb, "scheduleBlocks"));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, "scheduleBlocks");
        return;
      }
      const scheduleBlocks: ScheduleBlock[] = [];
      scheduleBlocksSnap.forEach(docSnap => {
        scheduleBlocks.push(docSnap.data() as ScheduleBlock);
      });

      // Fetch urgentAlerts
      let urgentAlertsSnap;
      try {
        urgentAlertsSnap = await getDocs(collection(firestoreDb, "urgentAlerts"));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, "urgentAlerts");
        return;
      }
      const urgentAlerts: UrgentAlert[] = [];
      urgentAlertsSnap.forEach(docSnap => {
        urgentAlerts.push(docSnap.data() as UrgentAlert);
      });

      // Fetch habitNudges
      let habitNudgesSnap;
      try {
        habitNudgesSnap = await getDocs(collection(firestoreDb, "habitNudges"));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, "habitNudges");
        return;
      }
      const habitNudges: HabitNudge[] = [];
      habitNudgesSnap.forEach(docSnap => {
        habitNudges.push(docSnap.data() as HabitNudge);
      });

      // Fetch agentRuns
      let agentRunsSnap;
      try {
        agentRunsSnap = await getDocs(collection(firestoreDb, "agentRuns"));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, "agentRuns");
        return;
      }
      const agentRuns: AgentRun[] = [];
      agentRunsSnap.forEach(docSnap => {
        agentRuns.push(docSnap.data() as AgentRun);
      });

      // Sort agentRuns by timestamp descending
      agentRuns.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Fetch energy profile from settings doc if exists
      let energyProfile: EnergyProfile = "steady";
      try {
        const profileSnap = await getDoc(doc(firestoreDb, "settings", "profile"));
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          if (profileData && profileData.energyProfile) {
            energyProfile = profileData.energyProfile;
          }
        }
      } catch (err) {
        console.error("[Firebase] Failed to fetch settings/profile from Firestore:", err);
      }

      // If there is data in firestore, merge/overwrite local
      if (tasks.length > 0 || habits.length > 0) {
        this.state = {
          tasks,
          habits,
          scheduleBlocks,
          urgentAlerts,
          habitNudges,
          agentRuns,
          energyProfile
        };
        this.saveLocalOnly();
        console.log(`[Firebase] Database synchronized successfully: ${tasks.length} tasks, ${habits.length} habits loaded from Cloud.`);
      } else {
        console.log("[Firebase] Firestore database is empty. Seeding with default data...");
        await this.syncToFirestoreAll();
      }
    } catch (err) {
      console.error("[Firebase] Synchronisation failed:", err);
    }
  }

  public async syncToFirestoreAll(): Promise<void> {
    if (!isConfigured || !firestoreDb) return;
    try {
      for (const t of this.state.tasks) {
        try {
          await setDoc(doc(firestoreDb, "tasks", t.id), t);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `tasks/${t.id}`);
        }
      }
      for (const h of this.state.habits) {
        try {
          await setDoc(doc(firestoreDb, "habits", h.id), h);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `habits/${h.id}`);
        }
      }
      for (const b of this.state.scheduleBlocks) {
        try {
          await setDoc(doc(firestoreDb, "scheduleBlocks", b.id), b);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `scheduleBlocks/${b.id}`);
        }
      }
      for (const a of this.state.urgentAlerts) {
        try {
          await setDoc(doc(firestoreDb, "urgentAlerts", a.id), a);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `urgentAlerts/${a.id}`);
        }
      }
      for (const n of this.state.habitNudges) {
        try {
          await setDoc(doc(firestoreDb, "habitNudges", n.id), n);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `habitNudges/${n.id}`);
        }
      }
      for (const r of this.state.agentRuns) {
        try {
          await setDoc(doc(firestoreDb, "agentRuns", r.id), r);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `agentRuns/${r.id}`);
        }
      }
      try {
        await setDoc(doc(firestoreDb, "settings", "profile"), { energyProfile: this.state.energyProfile });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, "settings/profile");
      }
    } catch (err) {
      console.error("[Firebase] Full seed/save to Firestore failed:", err);
    }
  }

  public async deleteDocFromFirestore(collectionName: string, id: string): Promise<void> {
    if (!isConfigured || !firestoreDb) return;
    try {
      await deleteDoc(doc(firestoreDb, collectionName, id));
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
      } catch (wrappedErr) {
        console.error(`[Firebase] Failed to delete document ${id} from collection ${collectionName}:`, wrappedErr);
      }
    }
  }

  public async clearCollectionInFirestore(collectionName: string): Promise<void> {
    if (!isConfigured || !firestoreDb) return;
    try {
      let snap;
      try {
        snap = await getDocs(collection(firestoreDb, collectionName));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, collectionName);
        return;
      }
      for (const docSnap of snap.docs) {
        try {
          await deleteDoc(doc(firestoreDb, collectionName, docSnap.id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${docSnap.id}`);
        }
      }
    } catch (err) {
      console.error(`[Firebase] Failed to clear collection ${collectionName}:`, err);
    }
  }

  // --- End of Firestore Logic ---

  public getState(): DatabaseState {
    return this.state;
  }

  public reset(): DatabaseState {
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    // Set deadlines dynamically to current dates so they are realistic
    this.state.tasks[0].deadline = new Date(new Date().setHours(18, 0, 0, 0)).toISOString();
    this.state.tasks[1].deadline = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString();
    this.state.tasks[2].deadline = new Date(new Date().setDate(new Date().getDate() + 2)).toISOString();
    this.state.habits[0].lastLoggedDate = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split("T")[0];
    this.state.habits[1].lastLoggedDate = null;
    this.state.habits[2].lastLoggedDate = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split("T")[0];
    
    // Clear Firestore collection
    if (isConfigured && firestoreDb) {
      this.clearCollectionInFirestore("tasks").catch(e => {});
      this.clearCollectionInFirestore("habits").catch(e => {});
      this.clearCollectionInFirestore("scheduleBlocks").catch(e => {});
      this.clearCollectionInFirestore("urgentAlerts").catch(e => {});
      this.clearCollectionInFirestore("habitNudges").catch(e => {});
      this.clearCollectionInFirestore("agentRuns").catch(e => {});
    }

    this.save();
    return this.state;
  }

  // Tasks CRUD
  public addTask(task: Omit<Task, "id">): Task {
    const newTask: Task = {
      alarmTriggered: false,
      ...task,
      id: "task_" + Math.random().toString(36).substring(2, 9)
    };
    this.state.tasks.push(newTask);
    this.save();
    return newTask;
  }

  public updateTask(id: string, updates: Partial<Task>): Task | null {
    const index = this.state.tasks.findIndex(t => t.id === id);
    if (index === -1) return null;
    this.state.tasks[index] = { ...this.state.tasks[index], ...updates };
    this.save();
    return this.state.tasks[index];
  }

  public deleteTask(id: string): boolean {
    const lengthBefore = this.state.tasks.length;
    this.state.tasks = this.state.tasks.filter(t => t.id !== id);
    if (this.state.tasks.length !== lengthBefore) {
      this.deleteDocFromFirestore("tasks", id).catch(e => {});
      this.save();
      return true;
    }
    return false;
  }

  // Habits CRUD
  public addHabit(habit: Omit<Habit, "id" | "currentStreak" | "lastLoggedDate">): Habit {
    const newHabit: Habit = {
      id: "habit_" + Math.random().toString(36).substring(2, 9),
      name: habit.name,
      currentStreak: 0,
      lastLoggedDate: null
    };
    this.state.habits.push(newHabit);
    this.save();
    return newHabit;
  }

  public logHabit(id: string): Habit | null {
    const index = this.state.habits.findIndex(h => h.id === id);
    if (index === -1) return null;
    const habit = this.state.habits[index];
    const todayStr = new Date().toISOString().split("T")[0];

    if (habit.lastLoggedDate === todayStr) {
      return habit;
    }

    const yesterdayStr = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split("T")[0];
    let newStreak = habit.currentStreak;
    if (habit.lastLoggedDate === yesterdayStr || habit.lastLoggedDate === null || habit.currentStreak === 0) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }

    this.state.habits[index] = {
      ...habit,
      currentStreak: newStreak,
      lastLoggedDate: todayStr
    };
    this.save();
    return this.state.habits[index];
  }

  public deleteHabit(id: string): boolean {
    const lengthBefore = this.state.habits.length;
    this.state.habits = this.state.habits.filter(h => h.id !== id);
    if (this.state.habits.length !== lengthBefore) {
      this.deleteDocFromFirestore("habits", id).catch(e => {});
      this.save();
      return true;
    }
    return false;
  }

  // Schedule, Alerts, Nudges updates
  public addScheduleBlock(block: Omit<ScheduleBlock, "id">): ScheduleBlock {
    const newBlock: ScheduleBlock = {
      ...block,
      id: "sched_" + Math.random().toString(36).substring(2, 9)
    };
    this.state.scheduleBlocks.push(newBlock);
    this.save();
    return newBlock;
  }

  public clearSchedule(): void {
    this.state.scheduleBlocks = [];
    this.clearCollectionInFirestore("scheduleBlocks").catch(e => {});
    this.saveLocalOnly(); // save locally, clear firestore directly
  }

  public addUrgentAlert(alert: Omit<UrgentAlert, "id">): UrgentAlert {
    const newAlert: UrgentAlert = {
      ...alert,
      id: "alert_" + Math.random().toString(36).substring(2, 9)
    };
    this.state.urgentAlerts.push(newAlert);
    this.save();
    return newAlert;
  }

  public clearUrgentAlerts(): void {
    this.state.urgentAlerts = [];
    this.clearCollectionInFirestore("urgentAlerts").catch(e => {});
    this.saveLocalOnly();
  }

  public addHabitNudge(nudge: Omit<HabitNudge, "id">): HabitNudge {
    const newNudge: HabitNudge = {
      ...nudge,
      id: "nudge_" + Math.random().toString(36).substring(2, 9)
    };
    this.state.habitNudges.push(newNudge);
    this.save();
    return newNudge;
  }

  public clearHabitNudges(): void {
    this.state.habitNudges = [];
    this.clearCollectionInFirestore("habitNudges").catch(e => {});
    this.saveLocalOnly();
  }

  public addAgentRun(run: AgentRun): void {
    this.state.agentRuns.unshift(run);
    if (this.state.agentRuns.length > 10) {
      // delete old from Firestore
      const oldRun = this.state.agentRuns[this.state.agentRuns.length - 1];
      this.deleteDocFromFirestore("agentRuns", oldRun.id).catch(e => {});
      this.state.agentRuns = this.state.agentRuns.slice(0, 10);
    }
    this.save();
  }

  public updateEnergyProfile(profile: EnergyProfile): DatabaseState {
    this.state.energyProfile = profile;
    this.save();
    return this.state;
  }
}

export const db = new FileDatabase();
