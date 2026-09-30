import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ArrowRight, ArrowUpRight, Bot, Check, ChevronRight, Clock3, History, LoaderCircle, Search, ShieldCheck, Sparkles, X } from 'lucide-react';

const workflow = ['Understanding your requirements', 'Searching public web sources', 'Extracting source-backed products', 'Comparing price and specifications', 'Writing recommendations'];
const suggestions = ['Laptop for AI development under ₹70,000', 'Wireless gaming headphones under ₹10,000', 'Phone with a great camera under ₹30,000', 'Running shoes for daily training under ₹8,000'];
const formatPrice = (price, currency = 'INR') => {
  if (price == null) return 'Price unavailable';
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 }).format(price); }
  catch { return `${currency || ''} ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(price)}`.trim(); }
};

export default function App() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const resultRef = useRef(null);

  async function loadHistory() {
    try { const { data } = await axios.get('http://localhost:5000/api/search/history'); setHistory(data.history || []); }
    catch { setHistory([]); }
  }
  useEffect(() => { loadHistory(); }, []);

  async function handleSearch(event) {
    event?.preventDefault();
    const clean = query.trim();
    if (!clean || loading) return;
    setLoading(true); setError(''); setResult(null); setActiveStep(0);
    const timer = setInterval(() => setActiveStep((step) => Math.min(step + 1, workflow.length - 1)), 1700);
    try {
      const { data } = await axios.post('/api/search', { query: clean });
      setResult(data); setActiveStep(workflow.length);
      await loadHistory();
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not reach the shopping agent. Check that the server is running and try again.');
      setActiveStep(-1);
    } finally { clearInterval(timer); setLoading(false); }
  }

  async function openSavedSearch(id) {
    setError(''); setLoading(true); setHistoryOpen(false);
    try { const { data } = await axios.get(`/api/search/${id}`); setResult(data); setQuery(data.query); setActiveStep(workflow.length); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    catch (requestError) { setError(requestError.response?.data?.error?.message || 'Could not load this saved search.'); }
    finally { setLoading(false); }
  }

  async function deleteSearch(event, id) {
    event.stopPropagation();
    try { await axios.delete(`/api/search/${id}`); setHistory((items) => items.filter((item) => item.id !== id)); if (result?.searchId === id) setResult(null); }
    catch (requestError) { setError(requestError.response?.data?.error?.message || 'Could not delete this saved search.'); }
  }

  return <div className="min-h-screen bg-paper text-ink">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Scout home"><span className="brand-mark"><Sparkles size={17} /></span><span>scout<span className="brand-period">.</span></span></a>
      <div className="header-caption"><span className="live-dot" /> YOUR PERSONAL SHOPPING RESEARCHER</div>
      <button className="history-trigger" onClick={() => setHistoryOpen(true)}><History size={17} /><span>History</span>{history.length > 0 && <span className="history-count">{history.length}</span>}</button>
    </header>

    <main id="top" className="main-shell">
      <section className="hero">
        <div className="hero-kicker"><span>LESS SCROLLING. BETTER PICKS.</span><span className="kicker-line" /></div>
        <h1>Find the right thing.<br /><em>Know why it fits.</em></h1>
        <p className="hero-copy">Tell Scout what you need. It searches real product listings, checks the details, and brings back a shortlist you can trust.</p>
        <form className="search-card" onSubmit={handleSearch}>
          <div className="search-input-wrap"><Search size={20} className="search-icon" /><textarea rows="2" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What are you looking for? Try “a laptop for AI development under ₹70,000”" aria-label="Shopping request" disabled={loading} /></div>
          <div className="search-card-footer"><span><ShieldCheck size={15} /> Recommendations are grounded in public sources</span><button type="submit" disabled={!query.trim() || loading}>{loading ? <><LoaderCircle className="spin" size={17} /> Searching</> : <>Find my picks <ArrowRight size={17} /></>}</button></div>
        </form>
        <div className="suggestions"><span className="suggest-label">TRY ASKING</span>{suggestions.map((suggestion) => <button key={suggestion} onClick={() => setQuery(suggestion)} disabled={loading}>{suggestion}</button>)}</div>
      </section>

      {error && <div role="alert" className="error-banner"><span><X size={17} />{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={17} /></button></div>}

      {loading && <section className="activity-card"><div className="activity-heading"><span className="activity-icon"><Bot size={19} /></span><div><strong>Scout is on it</strong><p>Working through your request now.</p></div><span className="activity-pulse" /></div><div className="activity-steps">{workflow.map((step, index) => <div className={`activity-step ${index < activeStep ? 'done' : index === activeStep ? 'current' : ''}`} key={step}><span className="step-check">{index < activeStep ? <Check size={13} /> : index === activeStep ? <LoaderCircle size={13} className="spin" /> : index + 1}</span>{step}</div>)}</div></section>}

      {!result && !loading && <section className="trust-strip"><div><span className="trust-icon"><Search size={18} /></span><p><strong>Real listings</strong><br />Public web search</p></div><div><span className="trust-icon"><ShieldCheck size={18} /></span><p><strong>Grounded details</strong><br />Unknowns stay unknown</p></div><div><span className="trust-icon"><Sparkles size={18} /></span><p><strong>Clear reasoning</strong><br />See how each pick scored</p></div></section>}

      {result && <section ref={resultRef} className="results-section">
        <div className="results-heading"><div><div className="section-eyebrow"><span className="eyebrow-dot" /> YOUR SHOPPING BRIEF</div><h2>Here’s what we found.</h2><p className="results-query">“{result.query}”</p></div><div className="results-timestamp"><Clock3 size={14} />{result.createdAt ? new Date(result.createdAt).toLocaleString() : 'Saved search'}</div></div>

        <div className="brief-card"><div className="brief-title"><span><Sparkles size={16} /></span><div><strong>Requirements detected</strong><small>What Scout understood from your request</small></div></div><div className="brief-grid"><div><label>CATEGORY</label><strong>{result.requirements?.category || 'Not specified'}</strong></div><div><label>BUDGET</label><strong>{result.requirements?.budget?.max ? `${formatPrice(result.requirements.budget.max, result.requirements.budget.currency || 'INR')} max` : 'No limit specified'}</strong></div><div><label>USE CASE</label><strong>{result.requirements?.useCase || 'General use'}</strong></div></div>
          {!!result.requirements?.explicitRequirements?.length && <div className="requirement-tags"><span>YOU ASKED FOR</span>{result.requirements.explicitRequirements.map((item, index) => <i key={index}>{item}</i>)}</div>}
          {!!result.requirements?.inferredPreferences?.length && <div className="requirement-tags inferred"><span>INFERRED PREFERENCES</span>{result.requirements.inferredPreferences.map((item, index) => <i key={index}>{item}</i>)}</div>}
        </div>

        <div className="recommendation-header"><div><div className="section-eyebrow"><span className="eyebrow-dot" /> THE SHORTLIST</div><h2>Recommended for you <span className="count-pill">{result.recommendations?.length || 0}</span></h2></div><span className="price-note">Prices shown as listed by the source</span></div>
        {result.summary && <p className="summary-note">{result.summary}</p>}
        {result.recommendations?.length ? <div className="product-grid">{result.recommendations.map((product, index) => <ProductCard product={product} index={index} key={`${product.url}-${index}`} />)}</div> : <div className="empty-results"><span><Search size={20} /></span><div><strong>No verifiable matches this time</strong><p>Scout found no products with both a matching category and a source backed price within your budget. Try adjusting the budget or search terms.</p></div></div>}

        <div className="agent-proof"><div className="proof-heading"><span className="proof-icon"><Bot size={18} /></span><div><strong>How Scout worked</strong><p>A real search and comparison, step by step</p></div><span className="complete-label"><Check size={13} /> COMPLETE</span></div><div className="proof-timeline">{(result.agentSteps || workflow.map((step) => step)).map((step, index) => <div key={`${index}-${step}`}><span><Check size={12} /></span><p>{step}</p></div>)}</div><div className="query-chips">{(result.searchQueries || []).map((item) => <span key={item}><Search size={12} />{item}</span>)}</div></div>

        <div className="source-footnote"><ShieldCheck size={16} /><p>Product details and prices come from the linked search result snippets. Listings can change; check the store page for current availability and final pricing.</p></div>
      </section>}

      <footer className="page-footer"><span>SCOUT <i>·</i> A MORE THOUGHTFUL WAY TO SHOP</span><span>Powered by Gemini + live web search</span></footer>
    </main>

    {historyOpen && <div className="drawer-backdrop" onClick={() => setHistoryOpen(false)}><aside className="history-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><span className="drawer-icon"><History size={17} /></span><div><strong>Search history</strong><small>Your recent research</small></div></div><button onClick={() => setHistoryOpen(false)} aria-label="Close search history"><X size={19} /></button></div><div className="history-list">{history.length ? history.map((item) => <div className="history-item" key={item.id} role="button" tabIndex={0} onClick={() => openSavedSearch(item.id)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) openSavedSearch(item.id); }}><span className="history-item-icon"><Search size={15} /></span><span className="history-item-copy"><strong>{item.query}</strong><small>{item.productCount} products · {new Date(item.createdAt).toLocaleDateString()}</small></span><button className="delete-history" aria-label="Delete search" onClick={(event) => deleteSearch(event, item.id)}><X size={14} /></button><ChevronRight className="history-chevron" size={15} /></div>) : <div className="history-empty"><span><Clock3 size={20} /></span><strong>No saved searches yet</strong><p>Your searches will show up here so you can revisit them.</p></div>}</div><div className="drawer-foot"><ShieldCheck size={14} /> Stored privately in your local MongoDB</div></aside></div>}
  </div>;
}

function ProductCard({ product, index }) {
  const specs = Object.entries(product.specifications || {}).filter(([, value]) => value).slice(0, 5);
  return <article className={`product-card ${index === 0 ? 'top-pick' : ''}`}>
    <div className="product-topline"><span className="product-rank">{index === 0 ? <><Sparkles size={12} /> BEST MATCH</> : `PICK 0${index + 1}`}</span><span className="score-badge"><span className="score-ring">{product.score}</span><span>match</span></span></div>
    <h3>{product.name}</h3><div className="product-brand">{product.brand || product.source}</div><div className="product-price">{formatPrice(product.price, product.currency)}</div>
    <div className="spec-list">{specs.length ? specs.map(([key, value]) => <div key={key}><span>{key.replace(/[A-Z]/g, (letter) => ` ${letter}`).toUpperCase()}</span><strong>{value}</strong></div>) : <div className="spec-unknown">Specifications were not included in the search snippet.</div>}</div>
    <div className="why-box"><span className="why-mark"><Sparkles size={13} /></span><p>{product.whyRecommended}</p></div>
    {!!product.missingRequirements?.length && <p className="unknown-note">Not verified: {product.missingRequirements.slice(0, 2).join(' · ')}</p>}
    <div className="product-source"><span><span className="source-dot" />{product.source}</span><a href={product.url} target="_blank" rel="noreferrer">View product <ArrowUpRight size={15} /></a></div>
  </article>;
}
