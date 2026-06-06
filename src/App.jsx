import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { RefreshCw, Link as LinkIcon, Settings, Sparkles, Activity } from 'lucide-react';
import './App.css';
import Dashboard from './components/Dashboard';

function App() {
  const [csvUrl, setCsvUrl] = useState(localStorage.getItem('sheetCsvUrl') || '');
  const [isUrlExpanded, setIsUrlExpanded] = useState(!localStorage.getItem('sheetCsvUrl'));
  const [dailyGoal, setDailyGoal] = useState(100);
  const [foodLogs, setFoodLogs] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [dailyMood, setDailyMood] = useState({});

  useEffect(() => {
    const savedMood = localStorage.getItem('dailyMoodMap');
    if (savedMood) {
      try {
        const parsed = JSON.parse(savedMood);
        setDailyMood(parsed || {});
      } catch (e) {
        console.error("Could not parse dailyMoodMap");
        setDailyMood({});
      }
    }
  }, []);

  const handleMoodSelect = (mood) => {
    if (!selectedDate || selectedDate === 'Unknown Date') return;
    const newMoodMap = { ...dailyMood, [selectedDate]: mood };
    setDailyMood(newMoodMap);
    localStorage.setItem('dailyMoodMap', JSON.stringify(newMoodMap));
  };

  const handleHealthExportUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLoading(true);
    
    setTimeout(() => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target.result;
        const meals = [];
        const correlationRegex = /<Correlation\s+type="HKCorrelationTypeIdentifierFood".*?<\/Correlation>/gs;
        let match;
        
        while ((match = correlationRegex.exec(text)) !== null) {
          const block = match[0];
          
          const nameMatch = block.match(/<MetadataEntry\s+key="HKFoodType"\s+value="([^"]+)"/);
          const foodName = nameMatch ? nameMatch[1] : 'Apple Health Meal';
          
          const dateMatch = block.match(/creationDate="([^"]+)"/);
          let logDate = new Date();
          if (dateMatch) {
             logDate = new Date(dateMatch[1]);
          }
          
          const energyMatch = block.match(/<Record\s+type="HKQuantityTypeIdentifierDietaryEnergyConsumed".*?value="([^"]+)"/);
          const proteinMatch = block.match(/<Record\s+type="HKQuantityTypeIdentifierDietaryProtein".*?value="([^"]+)"/);
          const carbsMatch = block.match(/<Record\s+type="HKQuantityTypeIdentifierDietaryCarbohydrates".*?value="([^"]+)"/);
          const fatMatch = block.match(/<Record\s+type="HKQuantityTypeIdentifierDietaryFatTotal".*?value="([^"]+)"/);
          
          const timeStr = logDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          const dateStr = logDate.toLocaleDateString('en-US'); 
          
          meals.push({
            id: 'hk_' + Math.random().toString(36).substr(2, 9),
            name: foodName,
            category: 'HealthKit',
            iodine: 0,
            time: timeStr,
            date: dateStr,
            energy: null,
            calories: energyMatch ? parseFloat(energyMatch[1]) : 0,
            protein: proteinMatch ? parseFloat(proteinMatch[1]) : 0,
            carbs: carbsMatch ? parseFloat(carbsMatch[1]) : 0,
            fats: fatMatch ? parseFloat(fatMatch[1]) : 0,
            notes: 'Apple Health Sync'
          });
        }
        
        if (meals.length > 0) {
          setFoodLogs(prev => {
            const combined = [...prev, ...meals];
            const uniqueDates = [...new Set(combined.map(l => l.date).filter(d => d !== 'Unknown Date'))];
            uniqueDates.sort((a, b) => new Date(a) - new Date(b));
            if (uniqueDates.length > 0) {
              setSelectedDate(uniqueDates[uniqueDates.length - 1]);
            }
            return combined;
          });
          alert(`Successfully imported ${meals.length} meals from Apple Health!`);
        } else {
          alert('No meals found in Apple Health export! Make sure HealthifyMe is syncing nutritional data to Apple Health.');
        }
        setIsLoading(false);
      };
      reader.readAsText(file);
    }, 100);
  };

  const fetchSheetData = () => {
    if (!csvUrl) return;
    
    // Auto-convert standard Google Sheets share links into CSV export links
    let finalUrl = csvUrl;
    if (csvUrl.includes('/edit?usp=sharing') || csvUrl.includes('/edit')) {
      finalUrl = csvUrl.replace(/\/edit.*$/, '/export?format=csv');
    } else if (csvUrl.includes('/pubhtml')) {
      finalUrl = csvUrl.replace(/\/pubhtml.*$/, '/pub?output=csv');
    }
    
    setIsLoading(true);
    setError(null);
    localStorage.setItem('sheetCsvUrl', csvUrl);

    Papa.parse(finalUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setIsLoading(false);
        if (results.errors.length > 0) {
          setError("Failed to parse CSV. Make sure it's published to the web.");
          return;
        }

        const parsedLogs = results.data.map((row, index) => {
          const iodine = parseInt(row['Iodine Amount (mcg)'] || row['Iodine'] || 0, 10);
          const rawDate = row['Date'] || 'Unknown Date';
          
          return {
            id: index,
            name: row['Item Name'] || row['Food Name'] || row['Food'] || 'Unknown',
            category: row['Category'] || 'Green',
            iodine: isNaN(iodine) ? 0 : iodine,
            time: row['Time'] || 'Unknown Time',
            date: rawDate,
            energy: row['Energy Score'] || row['Energy (1-10)'] || row['Energy'] || null,
            notes: row['Notes'] || ''
          };
        });

        // Extract unique dates and sort them
        const uniqueDates = [...new Set(parsedLogs.map(log => log.date).filter(d => d !== 'Unknown Date'))];
        // Sort dates chronologically if possible (assuming standard formats like YYYY-MM-DD or MM/DD/YYYY)
        uniqueDates.sort((a, b) => new Date(a) - new Date(b));

        setFoodLogs(parsedLogs);
        
        // Set selected date to the most recent one
        if (uniqueDates.length > 0) {
           setSelectedDate(uniqueDates[uniqueDates.length - 1]);
        }
      },
      error: (err) => {
        setIsLoading(false);
        setError("Network error fetching the sheet. Is the URL correct and public?");
      }
    });
  };

  useEffect(() => {
    if (csvUrl) {
      fetchSheetData();
    }
  }, []);

  return (
    <div className="app-layout">
      <div className="settings-bar glass-panel" style={{ justifyContent: isUrlExpanded ? 'flex-start' : 'flex-end' }}>
        {isUrlExpanded ? (
          <>
            <LinkIcon size={20} color="var(--text-secondary)" />
            <input 
              type="text" 
              placeholder="Paste your Google Sheet link here..." 
              value={csvUrl}
              onChange={(e) => setCsvUrl(e.target.value)}
            />
            <button onClick={() => { fetchSheetData(); setIsUrlExpanded(false); }} disabled={isLoading || !csvUrl}>
              <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
              {isLoading ? 'Syncing...' : 'Save & Sync'}
            </button>
            <input type="file" id="health-export-upload" accept=".xml" style={{ display: 'none' }} onChange={handleHealthExportUpload} />
            <button 
              onClick={() => document.getElementById('health-export-upload').click()}
              style={{ background: '#eab308', color: '#0f172a', border: 'none', marginLeft: 'auto', fontWeight: 'bold', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
              disabled={isLoading}
              title="Upload Apple Health export.xml"
            >
              <Activity size={16} /> Import Health Data
            </button>
          </>
        ) : (
          <>
            <a 
              href="https://gemini.google.com/gem/6ecdba04a076" 
              target="_blank" 
              rel="noreferrer"
              className="gemini-btn"
            >
              <Sparkles size={16} color="#a855f7" /> Open Gemini Gem
            </a>

            {selectedDate && selectedDate !== 'Unknown Date' && (
              <div className="mood-selector top-bar-mood">
                {[
                  { emoji: '😫', label: 'Terrible' },
                  { emoji: '🙁', label: 'Bad' },
                  { emoji: '😐', label: 'Okay' },
                  { emoji: '🙂', label: 'Good' },
                  { emoji: '🤩', label: 'Great' }
                ].map((m, i) => (
                  <button 
                    key={i} 
                    className={`mood-btn ${(dailyMood || {})[selectedDate] === m.label ? 'active' : ''}`}
                    onClick={() => handleMoodSelect(m.label)}
                    title={m.label}
                  >
                    <span className="mood-emoji">{m.emoji}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="settings-actions">
              <input type="file" id="health-export-upload" accept=".xml" style={{ display: 'none' }} onChange={handleHealthExportUpload} />
              <button 
                onClick={() => document.getElementById('health-export-upload').click()}
                style={{ background: '#eab308', color: '#0f172a', border: 'none', fontWeight: 'bold', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                disabled={isLoading}
                title="Upload Apple Health export.xml"
              >
                <Activity size={16} /> Import Health Data
              </button>
              <button 
                onClick={() => setIsUrlExpanded(true)} 
                style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <Settings size={16} /> Edit Link
              </button>
              <button onClick={fetchSheetData} disabled={isLoading || !csvUrl}>
                <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
                {isLoading ? 'Syncing...' : 'Sync Data'}
              </button>
            </div>
          </>
        )}
      </div>
      
      {error && (
        <div style={{ color: '#ef4444', padding: '0 20px' }}>{error}</div>
      )}

      <div className="dashboard-section">
        <Dashboard 
          allFoodLogs={foodLogs} 
          dailyGoal={dailyGoal}
          setDailyGoal={setDailyGoal}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />
      </div>
    </div>
  );
}

export default App;
