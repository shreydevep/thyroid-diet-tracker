import React, { useState, useEffect } from 'react';
import { Activity, Apple, Zap, Search, CheckCircle2, ChevronLeft, ChevronRight, TrendingUp, Pin, PinOff, ChevronDown, ChevronUp, Calendar, Smile } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ActivityCalendar } from 'react-activity-calendar';
import ProductInspector from './ProductInspector';
import './Dashboard.css';

const DashboardCard = ({ id, title, icon, pinnedCards, collapsedCards, togglePin, toggleCollapse, children, extraStyles = {}, className = "" }) => {
  const isPinned = pinnedCards.includes(id);
  const isCollapsed = collapsedCards.includes(id);

  return (
    <div className={`card glass-panel ${isPinned ? 'pinned' : ''} ${isCollapsed ? 'collapsed' : ''} ${className}`} style={extraStyles}>
      <div className="card-header">
        <div className="card-title-group">
          {icon}
          <h3>{title}</h3>
        </div>
        <div className="card-actions">
          <button onClick={() => togglePin(id)} className={`card-action-btn ${isPinned ? 'active' : ''}`} title={isPinned ? "Unpin Card" : "Pin to Top"}>
            {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
          </button>
          <button onClick={() => toggleCollapse(id)} className="card-action-btn" title={isCollapsed ? "Expand" : "Collapse"}>
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>
      {!isCollapsed && (
        <div className="card-content">
          {children}
        </div>
      )}
    </div>
  );
};

const Dashboard = ({ allFoodLogs, dailyGoal, setDailyGoal, selectedDate, setSelectedDate }) => {
  const [checklist, setChecklist] = useState({ cosmetics: false, supplements: false });
  
  // Layout State
  const [pinnedCards, setPinnedCards] = useState(() => {
    const saved = localStorage.getItem('dashboardPinned');
    return saved ? JSON.parse(saved) : [];
  });
  const [collapsedCards, setCollapsedCards] = useState(() => {
    const saved = localStorage.getItem('dashboardCollapsed');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('dashboardPinned', JSON.stringify(pinnedCards));
  }, [pinnedCards]);

  useEffect(() => {
    localStorage.setItem('dashboardCollapsed', JSON.stringify(collapsedCards));
  }, [collapsedCards]);

  const togglePin = (id) => {
    setPinnedCards(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const toggleCollapse = (id) => {
    setCollapsedCards(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  // 1. Date Navigation Logic
  const uniqueDates = [...new Set(allFoodLogs.map(log => log.date).filter(d => d !== 'Unknown Date'))];
  uniqueDates.sort((a, b) => new Date(a) - new Date(b));

  const handlePrevDay = () => {
    const idx = uniqueDates.indexOf(selectedDate);
    if (idx > 0) setSelectedDate(uniqueDates[idx - 1]);
  };

  const handleNextDay = () => {
    const idx = uniqueDates.indexOf(selectedDate);
    if (idx < uniqueDates.length - 1) setSelectedDate(uniqueDates[idx + 1]);
  };

  const [dailyMood, setDailyMood] = useState({});

  useEffect(() => {
    const savedMood = localStorage.getItem('dailyMoodMap');
    if (savedMood) {
      try {
        setDailyMood(JSON.parse(savedMood));
      } catch (e) {
        console.error("Could not parse dailyMoodMap");
      }
    }
  }, []);

  const handleMoodSelect = (mood) => {
    const newMoodMap = { ...dailyMood, [selectedDate]: mood };
    setDailyMood(newMoodMap);
    localStorage.setItem('dailyMoodMap', JSON.stringify(newMoodMap));
  };

  // 2. Daily Tracking Logic
  const dailyLogs = allFoodLogs.filter(log => log.date === selectedDate);
  const iodineIntake = dailyLogs.reduce((sum, log) => sum + log.iodine, 0);
  
  let latestEnergy = null;
  let latestNotes = null;
  dailyLogs.forEach(log => {
    if (log.energy) latestEnergy = log.energy;
    if (log.notes) latestNotes = log.notes;
  });

  // Group and average energy scores by hour
  const hourlyEnergyMap = {};
  
  dailyLogs.forEach(log => {
    if (!log.energy) return;
    const timeStr = log.time && log.time !== 'Unknown Time' ? log.time : '';
    let hourKey = log.name; // Fallback to name if no valid time
    
    // Parse times like "8:30 AM" or "08:44 am" into "8 AM"
    const match = timeStr.match(/(\d+)(:\d+)?\s*(am|pm)/i);
    if (match) {
      let hour = parseInt(match[1], 10);
      const isPM = match[3].toLowerCase() === 'pm';
      
      // Standardize hour presentation
      if (hour === 0) hour = 12;
      hourKey = `${hour} ${isPM ? 'PM' : 'AM'}`;
    }
    
    if (!hourlyEnergyMap[hourKey]) {
      hourlyEnergyMap[hourKey] = {
        sum: 0,
        count: 0,
        notes: []
      };
    }
    hourlyEnergyMap[hourKey].sum += parseInt(log.energy, 10);
    hourlyEnergyMap[hourKey].count += 1;
    if (log.notes) {
      hourlyEnergyMap[hourKey].notes.push(log.notes);
    }
  });

  const energyData = Object.keys(hourlyEnergyMap).map(key => {
    const group = hourlyEnergyMap[key];
    const avgEnergy = Math.round(group.sum / group.count);
    return {
      name: key,
      energy: avgEnergy,
      notes: group.notes.join(' | ') || null
    };
  });

  const percentage = Math.min((iodineIntake / dailyGoal) * 100, 100);
  
  const greenCount = dailyLogs.filter(f => f.category === 'Green').length;
  const yellowCount = dailyLogs.filter(f => f.category === 'Yellow').length;
  const redCount = dailyLogs.filter(f => f.category === 'Red').length;
  const totalFoods = dailyLogs.length || 1; 

  // 3. Monthly Contributors Logic
  let topContributors = [];
  if (selectedDate && selectedDate !== 'Unknown Date') {
    const d = new Date(selectedDate);
    const month = d.getMonth();
    const year = d.getFullYear();

    const monthlyLogs = allFoodLogs.filter(log => {
      if (!log.date || log.date === 'Unknown Date') return false;
      const ld = new Date(log.date);
      return ld.getMonth() === month && ld.getFullYear() === year;
    });

    const aggregated = {};
    monthlyLogs.forEach(log => {
      const n = log.name.toLowerCase().trim();
      if (!aggregated[n]) {
        aggregated[n] = { name: log.name, totalIodine: 0 };
      }
      aggregated[n].totalIodine += log.iodine;
    });

    topContributors = Object.values(aggregated)
      .sort((a, b) => b.totalIodine - a.totalIodine)
      .slice(0, 4);
  }

  const toggleChecklist = (item) => {
    setChecklist(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const displayDate = selectedDate && selectedDate !== 'Unknown Date' 
    ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'No Date Selected';

  // 4. Trend Chart Data (Last 14 days)
  const chartData = uniqueDates.slice(-14).map(date => {
    const dayLogs = allFoodLogs.filter(log => log.date === date);
    const sum = dayLogs.reduce((acc, log) => acc + log.iodine, 0);
    const d = new Date(date);
    return {
      name: `${d.getMonth()+1}/${d.getDate()}`,
      iodine: sum
    };
  });

  // 5. Heatmap Data (Padded to 365 days)
  const iodinePerStandardDate = {};
  allFoodLogs.forEach(log => {
    if (!log.date || log.date === 'Unknown Date') return;
    const d = new Date(log.date);
    if (isNaN(d)) return;
    
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const stdDate = `${yyyy}-${mm}-${dd}`;
    
    if (!iodinePerStandardDate[stdDate]) {
      iodinePerStandardDate[stdDate] = 0;
    }
    iodinePerStandardDate[stdDate] += log.iodine;
  });

  const heatmapData = [];
  const today = new Date();
  
  for (let i = 365; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const stdDate = `${yyyy}-${mm}-${dd}`;
    
    const sum = iodinePerStandardDate[stdDate] || 0;
    
    let level = 0;
    if (sum > 0 && sum <= 50) level = 1;
    else if (sum > 50 && sum <= 100) level = 2;
    else if (sum > 100 && sum <= 200) level = 3;
    else if (sum > 200) level = 4;

    heatmapData.push({
      date: stdDate,
      count: sum,
      level: level
    });
  }

  const customTheme = {
    light: ['rgba(255,255,255,0.05)', '#10b981', '#facc15', '#f97316', '#ef4444'],
    dark: ['rgba(255,255,255,0.05)', '#10b981', '#facc15', '#f97316', '#ef4444'],
  };

  const cardProps = { pinnedCards, collapsedCards, togglePin, toggleCollapse };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-titles">
          <h1>Thyroid Reset Tracker</h1>
          <p>Monitor your daily iodine intake and track symptoms.</p>
        </div>
        <div className="phase-toggle glass-panel">
          <button 
            className={dailyGoal === 100 ? 'active reset' : ''} 
            onClick={() => setDailyGoal(100)}
          >
            Reset Phase
          </button>
          <button 
            className={dailyGoal === 200 ? 'active maintenance' : ''} 
            onClick={() => setDailyGoal(200)}
          >
            Maintenance
          </button>
        </div>
      </header>

      {/* Date Navigator */}
      <div className="date-navigator glass-panel">
        <button 
          onClick={handlePrevDay} 
          disabled={!uniqueDates.length || uniqueDates.indexOf(selectedDate) <= 0}
        >
          <ChevronLeft size={20} />
        </button>
        <div className="current-date">
          <span>{displayDate}</span>
        </div>
        <button 
          onClick={handleNextDay} 
          disabled={!uniqueDates.length || uniqueDates.indexOf(selectedDate) >= uniqueDates.length - 1}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="dashboard-grid">
        
        {/* Gauge Card */}
        <DashboardCard id="gauge" title="Daily Iodine" icon={<Activity className="icon" />} className="gauge-card" {...cardProps}>
          <div className="gauge-container">
            <svg viewBox="0 0 36 36" className="circular-chart">
              <path className="circle-bg"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path className={`circle ${percentage > 100 ? 'over-limit' : ''}`}
                strokeDasharray={`${percentage}, 100`}
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <text x="18" y="20.35" className="percentage">{iodineIntake} mcg</text>
            </svg>
          </div>
          <p className="gauge-subtitle">Target: &lt; {dailyGoal} mcg</p>
        </DashboardCard>

        {/* Energy Stabilization Curve Card */}
        <DashboardCard id="symptoms" title="Energy Stabilization" icon={<Zap className="icon" style={{color: '#f59e0b'}} />} className="energy-card" {...cardProps}>
          {energyData.length > 0 ? (
            <div style={{ height: '200px', width: '100%', marginTop: '10px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={energyData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 10]} ticks={[0, 5, 10]} stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: '#f59e0b', fontWeight: 'bold' }}
                      formatter={(value) => [`${value}/10`, 'Energy Score']}
                      labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '4px' }}
                    />
                    <Line type="monotone" dataKey="energy" name="Energy Score" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#1e293b' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {latestNotes && (
                <div className="recent-notes" style={{ marginTop: '12px' }}>
                  <strong>Latest Note:</strong> {latestNotes}
                </div>
              )}
            </div>
          ) : (
            <div className="energy-display" style={{ marginTop: '20px' }}>
              <p className="empty-state">No energy scores logged for this day.</p>
            </div>
          )}
        </DashboardCard>

        {/* Mood Tracker Card */}
        <DashboardCard id="mood" title="Daily Mood" icon={<Smile className="icon" style={{color: '#8b5cf6'}} />} className="mood-card" {...cardProps}>
          <p className="checklist-desc" style={{ marginBottom: '20px' }}>How are you feeling today?</p>
          <div className="mood-selector">
            {[
              { emoji: '😫', label: 'Terrible' },
              { emoji: '🙁', label: 'Bad' },
              { emoji: '😐', label: 'Okay' },
              { emoji: '🙂', label: 'Good' },
              { emoji: '🤩', label: 'Great' }
            ].map((m, i) => (
              <button 
                key={i} 
                className={`mood-btn ${dailyMood[selectedDate] === m.label ? 'active' : ''}`}
                onClick={() => handleMoodSelect(m.label)}
                title={m.label}
              >
                <span className="mood-emoji">{m.emoji}</span>
                <span className="mood-label">{m.label}</span>
              </button>
            ))}
          </div>
        </DashboardCard>

        {/* Hidden Iodine Checklist */}
        <DashboardCard id="checklist" title="Hidden Iodine Check" icon={<Search className="icon" style={{color: '#10b981'}} />} className="checklist-card" {...cardProps}>
          <p className="checklist-desc">Check your labels today to avoid hidden iodine.</p>
          <div className="checklist">
            <div 
              className={`check-item ${checklist.cosmetics ? 'checked' : ''}`}
              onClick={() => toggleChecklist('cosmetics')}
            >
              <CheckCircle2 size={18} />
              <span>Checked cosmetics & lotions</span>
            </div>
            <div 
              className={`check-item ${checklist.supplements ? 'checked' : ''}`}
              onClick={() => toggleChecklist('supplements')}
            >
              <CheckCircle2 size={18} />
              <span>Checked supplements & meds</span>
            </div>
          </div>
        </DashboardCard>
        
        {/* Monthly Top Contributors */}
        <DashboardCard id="contributors" title="Monthly Top Iodine Sources" icon={<TrendingUp className="icon" style={{color: '#ef4444'}} />} className="contributors-card" {...cardProps}>
          <p className="checklist-desc">Foods contributing the most iodine this month.</p>
          <div className="contributors-list">
            {topContributors.length === 0 && <p className="empty-state">No data for this month.</p>}
            {topContributors.map((item, i) => (
              <div key={i} className="contributor-item">
                <span className="contributor-name">{i + 1}. {item.name}</span>
                <span className="contributor-value">{item.totalIodine} mcg</span>
              </div>
            ))}
          </div>
        </DashboardCard>

        {/* Food Categories Card */}
        <DashboardCard id="categories" title={`Food Lights (${displayDate})`} icon={<Apple className="icon" />} className="categories-card" {...cardProps}>
          <div className="progress-bars">
            <div className="progress-item">
              <div className="progress-label">
                <span>Green (&lt;10 mcg)</span>
                <span>{greenCount}</span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar green" style={{width: `${(greenCount/totalFoods)*100}%`}}></div>
              </div>
            </div>
            
            <div className="progress-item">
              <div className="progress-label">
                <span>Yellow (10-50 mcg)</span>
                <span>{yellowCount}</span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar yellow" style={{width: `${(yellowCount/totalFoods)*100}%`}}></div>
              </div>
            </div>

            <div className="progress-item">
              <div className="progress-label">
                <span>Red (&gt;50 mcg)</span>
                <span>{redCount}</span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar red" style={{width: `${(redCount/totalFoods)*100}%`}}></div>
              </div>
            </div>
          </div>
        </DashboardCard>
        {/* Trend Chart Card */}
        {chartData.length > 0 && (
          <DashboardCard id="trend" title="Iodine Intake Trend (Last 14 Days)" icon={<TrendingUp className="icon" />} extraStyles={{ height: collapsedCards.includes('trend') ? 'auto' : '300px' }} {...cardProps}>
            <div style={{ width: '100%', height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--color-green-light)' }}
                  />
                  <ReferenceLine y={dailyGoal} label={{ position: 'top', value: `Goal (${dailyGoal})`, fill: 'var(--color-red-light)', fontSize: 12 }} stroke="var(--color-red-light)" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="iodine" stroke="var(--accent-primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--accent-primary)' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>
        )}

        <DashboardCard id="inspector" title="AI Product Inspector" icon={<Search className="icon" />} {...cardProps}>
          <ProductInspector />
        </DashboardCard>

        {/* Recent Logs List */}
        <DashboardCard id="recent-logs" title={`Meals for ${displayDate}`} className="recent-logs-card" {...cardProps}>
          <div className="logs-list">
            {dailyLogs.length === 0 && <p className="empty-state">No meals logged on this day.</p>}
            {dailyLogs.slice().reverse().map(log => (
              <div key={log.id} className="log-item" style={{ flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                  <div className={`status-dot ${log.category.toLowerCase()}`}></div>
                  <div className="log-details">
                    <span className="log-name">{log.name}</span>
                    <span className="log-time">{log.time}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {log.energy && (
                      <span style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                        ⚡ {log.energy}/10
                      </span>
                    )}
                    <div className="log-iodine">{log.iodine} mcg</div>
                  </div>
                </div>
                {log.notes && (
                  <div style={{ width: '100%', fontSize: '12px', color: 'var(--text-secondary)', paddingLeft: '26px', marginTop: '6px', fontStyle: 'italic' }}>
                    "{log.notes}"
                  </div>
                )}
              </div>
            ))}
          </div>
        </DashboardCard>

      </div>

      {/* Heatmap Card - Full Width */}
      {heatmapData.length > 0 && (
        <DashboardCard id="heatmap" title="Yearly Iodine Heatmap" icon={<Calendar className="icon" />} extraStyles={{ marginTop: '20px', overflowX: 'auto', width: '100%' }} {...cardProps}>
          <div style={{ minWidth: '800px', display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
            <ActivityCalendar 
              data={heatmapData} 
              theme={customTheme} 
              colorScheme="dark"
              blockSize={14}
              blockMargin={4}
              fontSize={14}
              labels={{
                legend: {
                  less: 'Good',
                  more: 'Bad',
                },
                totalCount: '{{count}} mcg total iodine logged',
              }}
              renderBlock={(block, activity) =>
                React.cloneElement(block, {
                  'data-tooltip-id': 'react-tooltip',
                  'data-tooltip-html': `${activity.count} mcg on ${activity.date}`,
                })
              }
            />
          </div>
        </DashboardCard>
      )}

    </div>
  );
};

export default Dashboard;
