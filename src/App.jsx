import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { RefreshCw, Link as LinkIcon, Settings, Sparkles } from 'lucide-react';
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
