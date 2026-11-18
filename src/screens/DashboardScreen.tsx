import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronRight, Flag, Play, RefreshCw, Swords, Target, Timer, Trophy, UserRound, X, Zap } from 'lucide-react';
import BottomNav from '../components/ui/BottomNav';
import { useRunnerHistory } from '../hooks/useRunnerHistory';
import { formatRaceTime } from '../lib/runnerHistory';
import { nextWinMilestone } from '../lib/homeMilestones';
import '../styles/homeShowcase.css';

type DashboardProps = { displayName?: string | null; userId?: string | null };

const RECORD_DISTANCES = [50, 75, 100] as const;
const formatDate = (date: string) => {
  const parsed = new Date(date);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString('de-DE') : 'â€”';
};

export default function DashboardScreen({ displayName, userId }: DashboardProps) {
  const { races, totals, loading, error, refresh } = useRunnerHistory(userId);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const name = displayName?.trim() || (userId ? 'RUNNER' : 'GAST');
  const ready = Boolean(userId) && !loading && !error;
  const completed = races.find(race => race.completed) ?? null;
  const pendingCount = races.filter(race => !race.completed).length;
  const wins = ready ? totals.wins : null;
  const duels = ready ? totals.completedDuels : null;
  const milestone = nextWinMilestone(totals.wins);
  const bestTimes = {
    50: ready ? totals.best50Ms : null,
    75: ready ? totals.best75Ms : null,
    100: ready ¶»§q«^