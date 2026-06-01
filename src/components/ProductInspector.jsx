import React, { useState } from 'react';
import { Search, AlertTriangle, CheckCircle, Package, Copy, ClipboardPaste } from 'lucide-react';
import './ProductInspector.css';

const ProductInspector = () => {
  const [query, setQuery] = useState('');
  const [promptGenerated, setPromptGenerated] = useState(false);
  const [pastedData, setPastedData] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copySuccess, setCopySuccess] = useState('');

  const generatePromptText = () => {
    return `You are an expert on the Thyroid Reset Diet and product ingredients.
I am searching for a product (food or cosmetic) named: "${query}".

Using your knowledge, identify the product. 
1. Determine if it is a "food" or "cosmetic".
2. Provide a generic or common list of ingredients for this product.
3. Analyze the ingredients for hidden iodine derivatives (specifically: carrageenan, agar, algin, alginate, kelp, seaweed, bladderwrack, iodine, iodized salt, pvp-iodine, sea salt).
4. If it's a food, estimate its nutritional macros per serving.
5. Estimate the total Iodine in micrograms (mcg) per serving.
6. Categorize it into: Green (under 10 mcg), Yellow (10-50 mcg), or Red (over 50 mcg).

Return your response STRICTLY as a JSON object with this exact structure (no markdown blocks, just raw JSON):
{
  "name": "Full Product Name",
  "brand": "Likely Brand Name",
  "type": "food or cosmetic",
  "ingredients": "Comma separated list of typical ingredients",
  "flagged": ["list", "of", "any", "found", "iodine", "derivatives"],
  "totalIodineMcg": 45,
  "category": "Yellow",
  "nutrients": {
    "energy_value": 150,
    "energy_unit": "kcal",
    "proteins_100g": 5,
    "carbohydrates_100g": 20,
    "fat_100g": 8
  }
}

If you cannot identify the product at all, return JSON with name as "Unknown Product".`;
  };

  const handleGenerate = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setPromptGenerated(true);
    setResult(null);
    setError(null);
    setPastedData('');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatePromptText());
    setCopySuccess('Copied!');
    setTimeout(() => setCopySuccess(''), 2000);
  };

  const parsePastedData = () => {
    if (!pastedData.trim()) return;
    setError(null);
    setResult(null);

    try {
      // Clean up markdown formatting if Gemini includes it
      let cleanJson = pastedData.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const parsedData = JSON.parse(cleanJson);
      
      if (parsedData.name === "Unknown Product") {
        setError("Gemini could not confidently identify that product. Please try being more specific.");
        return;
      }

      setResult({
        name: parsedData.name || query,
        brand: parsedData.brand || '',
        image: '', 
        ingredients: parsedData.ingredients || 'No ingredient list available.',
        flagged: parsedData.flagged || [],
        type: parsedData.type || 'unknown',
        totalIodineMcg: parsedData.totalIodineMcg || 0,
        category: parsedData.category || 'Green',
        nutrients: parsedData.nutrients || {}
      });

    } catch (err) {
      console.error("Parse Error:", err);
      setError(`Failed to parse the text. Ensure you copied the exact JSON response from Gemini. Error: ${err.message}`);
    }
  };

  const handleReset = () => {
    setQuery('');
    setPromptGenerated(false);
    setPastedData('');
    setResult(null);
    setError(null);
  };

  const copySheetRow = async () => {
    if (!result) return;
    
    const d = new Date();
    const dateStr = d.toLocaleDateString('en-US'); // e.g., 10/27/2023
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); // e.g., 08:30 AM
    
    // Format: Date, Time, Item Name, Category, Iodine Amount (mcg), Energy Score, Notes
    const rowString = `${dateStr}, ${timeStr}, ${result.name}, ${result.category}, ${result.totalIodineMcg}, , "Logged via AI Inspector"`;
    
    try {
      await navigator.clipboard.writeText(rowString);
      setCopySuccess('Row Copied! Paste into Google Sheet.');
      setTimeout(() => setCopySuccess(''), 3000);
    } catch (err) {
      setError('Failed to copy row to clipboard');
    }
  };

  return (
    <div className="product-inspector-content">
      <p className="inspector-desc">Generate an optimized prompt for your Gemini browser window to instantly analyze ingredients for hidden iodine.</p>
      
      {!promptGenerated ? (
        <form onSubmit={handleGenerate} className="inspector-search">
          <input 
            type="text" 
            placeholder="e.g. Almond Breeze Vanilla, CeraVe Lotion..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" disabled={!query.trim()}>
            Generate Prompt
          </button>
        </form>
      ) : (
        <div className="workflow-steps">
          <div className="step-box">
            <div className="step-header">
              <span className="step-number">1</span>
              <h4>Copy this Prompt</h4>
              <button className="copy-btn" onClick={handleCopy}>
                <Copy size={14} /> {copySuccess || 'Copy'}
              </button>
            </div>
            <pre className="prompt-display">{generatePromptText()}</pre>
          </div>

          <div className="step-box">
            <div className="step-header">
              <span className="step-number">2</span>
              <h4>Paste Gemini's Reply</h4>
            </div>
            <textarea 
              className="paste-area" 
              placeholder="Paste the raw JSON response from Gemini here..."
              value={pastedData}
              onChange={(e) => setPastedData(e.target.value)}
            />
            <div className="action-buttons">
              <button className="parse-btn" onClick={parsePastedData} disabled={!pastedData.trim()}>
                <ClipboardPaste size={16} style={{marginRight: '6px'}} /> Analyze Data
              </button>
              <button className="reset-btn" onClick={handleReset}>Start Over</button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="inspector-error">{error}</div>}

      {result && (
        <div className="inspector-result">
          <div className="result-header">
            <div className="product-placeholder"><Package size={32} /></div>
            <div className="product-info">
              <h4>{result.name}</h4>
              <span className="product-brand">{result.brand}</span>
              <span className="product-type">{result.type.toUpperCase()}</span>
            </div>
          </div>

          <div className={`verdict ${result.flagged.length > 0 ? 'warning' : 'safe'}`}>
            {result.flagged.length > 0 ? (
              <>
                <AlertTriangle size={20} />
                <div>
                  <strong>WARNING: Contains potential hidden iodine!</strong>
                  <p>Found: {result.flagged.join(', ')}</p>
                </div>
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                <div>
                  <strong>Safe!</strong>
                  <p>No obvious iodine derivatives detected in the ingredients.</p>
                </div>
              </>
            )}
          </div>

          {result.type === 'food' && Object.keys(result.nutrients).length > 0 && (
            <div className="nutrients-grid">
              <div className="nutrient">
                <span className="n-value">{result.nutrients.energy_value || 0} {result.nutrients.energy_unit || 'kcal'}</span>
                <span className="n-label">Energy</span>
              </div>
              <div className="nutrient">
                <span className="n-value">{result.nutrients.proteins_100g || 0}g</span>
                <span className="n-label">Protein</span>
              </div>
              <div className="nutrient">
                <span className="n-value">{result.nutrients.carbohydrates_100g || 0}g</span>
                <span className="n-label">Carbs</span>
              </div>
              <div className="nutrient">
                <span className="n-value">{result.nutrients.fat_100g || 0}g</span>
                <span className="n-label">Fat</span>
              </div>
            </div>
          )}

          <div className="ingredients-list">
            <strong>Ingredients:</strong>
            <p>{result.ingredients}</p>
          </div>

          {/* Sync Button */}
          <div className="sync-section" style={{marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)'}}>
            <button 
              className="sync-btn" 
              onClick={copySheetRow}
              style={{
                width: '100%', 
                padding: '12px', 
                background: 'var(--accent-primary)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                fontWeight: 'bold', 
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Copy size={16} /> {copySuccess ? copySuccess : 'Log Meal to Google Sheet (Copy Row)'}
            </button>
            <p style={{fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '8px'}}>
              Clicking this will copy a perfectly formatted CSV row to your clipboard. Switch to your Google Sheet and paste it at the bottom to sync it with your dashboard!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductInspector;
