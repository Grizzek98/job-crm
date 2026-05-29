import { createContext, useContext, useState, useRef, useEffect } from "react";

const FocusContext = createContext(null);

export function FocusProvider({ children, settings }) {
  // YouTube player
  const [currentVideo, setCurrentVideo] = useState(null); // { id, title, url }

  // Pomodoro timer
  const [timerVisible, setTimerVisible] = useState(false);
  const [timerPhase, setTimerPhase] = useState("work"); // 'work' | 'break'
  const [timerRunning, setTimerRunning] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);

  const workMin = settings?.pomodoro_work_min ?? 25;
  const breakMin = settings?.pomodoro_break_min ?? 5;

  const [timerSecondsLeft, setTimerSecondsLeft] = useState(workMin * 60);
  const intervalRef = useRef(null);
  const onPhaseEndRef = useRef(null);

  // Keep onPhaseEnd ref up to date
  useEffect(() => {
    onPhaseEndRef.current = onPhaseEnd;
  });

  // Reset timer when work/break duration changes from settings
  useEffect(() => {
    if (!timerRunning) {
      setTimerSecondsLeft(timerPhase === "work" ? workMin * 60 : breakMin * 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workMin, breakMin]);

  function onPhaseEnd() {
    // Do NOT stop the timer — auto-advance to the next phase.
    // Changing timerPhase triggers the interval useEffect to restart for the new phase.
    if (timerPhase === "work") {
      setPomodoroCount((c) => c + 1);
      setTimerPhase("break");
      setTimerSecondsLeft(breakMin * 60);
    } else {
      setTimerPhase("work");
      setTimerSecondsLeft(workMin * 60);
    }
  }

  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        setTimerSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            onPhaseEndRef.current?.();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
    // timerPhase in deps so the interval restarts automatically when phase changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerRunning, timerPhase]);

  function startPause() {
    setTimerRunning((r) => !r);
  }

  function resetTimer() {
    setTimerRunning(false);
    setTimerSecondsLeft(timerPhase === "work" ? workMin * 60 : breakMin * 60);
  }

  function toggleTimer() {
    setTimerVisible((v) => {
      if (v) {
        // Hiding: pause and reset so it's fresh next time
        setTimerRunning(false);
        setTimerPhase("work");
        setTimerSecondsLeft(workMin * 60);
      }
      return !v;
    });
  }

  return (
    <FocusContext.Provider
      value={{
        currentVideo,
        setCurrentVideo,
        timerVisible,
        toggleTimer,
        timerPhase,
        timerRunning,
        timerSecondsLeft,
        pomodoroCount,
        startPause,
        resetTimer,
        workMin,
        breakMin,
      }}
    >
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error("useFocus must be used within FocusProvider");
  return ctx;
}
