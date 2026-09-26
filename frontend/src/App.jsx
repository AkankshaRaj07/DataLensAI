import { useState, useRef, useEffect } from 'react'
import Plot from 'react-plotly.js'
import ReactMarkdown from 'react-markdown'
import './index.css'

function App() {
  const [schemas, setSchemas] = useState(() => {
    const saved = localStorage.getItem('activeDatasets')
    return saved ? JSON.parse(saved) : []
  })
  const [history, setHistory] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [selectedDataset, setSelectedDataset] = useState(null)
  
  // Database Sessions
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState(null)

  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const allTraces = history.flatMap(h => h.trace || []).reverse()
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [history])

  useEffect(() => {
    localStorage.setItem('activeDatasets', JSON.stringify(schemas))
  }, [schemas])

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500)
    fetchSessions()
    return () => clearTimeout(timer)
  }, [])

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions')
      const data = await res.json()
      setSessions(data)
    } catch (e) {
      console.error(e)
    }
  }

  const loadSession = async (id) => {
    try {
      const res = await fetch(`/api/sessions/${id}/history`)
      const data = await res.json()
      setHistory(data)
      setSessionId(id)
      setSelectedDataset(null)
    } catch (e) {
      console.error(e)
    }
  }

  const createNewSession = () => {
    setSessionId(null)
    setHistory([])
    setSelectedDataset(null)
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (res.ok) {
        data.profile.filename = file.name
        setSchemas(prev => [...prev, data.profile])
        showToast('Dataset uploaded successfully!', 'success')
      } else {
        showToast(data.detail || 'Upload failed')
      }
    } catch (err) {
      showToast('Error uploading file')
    }
  }

  const [datasetPreview, setDatasetPreview] = useState(null)

  const handleSelectDataset = async (schema) => {
    setSelectedDataset(schema)
    setDatasetPreview(null)
    const tableName = schema.table_name || schema.filename.replace('.csv', '').replace(/ /g, '_').replace(/-/g, '_').toLowerCase()
    try {
      const res = await fetch(`/api/datasets/${tableName}/data`)
      const data = await res.json()
      if (res.ok) {
        setDatasetPreview(data.data)
      }
    } catch (e) {
      console.error('Failed to load data preview')
    }
  }

  const handleDeleteDataset = async (e, schema) => {
    e.stopPropagation() // Prevent triggering the select
    try {
      const res = await fetch(`/api/datasets/${schema.table_name || schema.filename.replace('.csv', '').replace(/ /g, '_').replace(/-/g, '_').toLowerCase()}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setSchemas(prev => prev.filter(s => s !== schema))
        if (selectedDataset === schema) setSelectedDataset(null)
        showToast('Dataset deleted', 'success')
      } else {
        showToast('Failed to delete dataset')
      }
    } catch (e) {
      showToast('Error deleting dataset')
    }
  }

  const handleSend = async () => {
    if (!input.trim()) return
    
    const userMsg = input
    setInput('')
    setSelectedDataset(null)
    setHistory(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const payload = {
        message: userMsg,
        table_schemas: schemas,
        history: history.map(h => ({ role: h.role, content: h.content })),
        session_id: sessionId
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      const data = await res.json()
      if (res.ok) {
        if (data.session_id && !sessionId) {
          setSessionId(data.session_id)
          fetchSessions()
        }
        
        let chartData = null
        if (data.trace) {
          const chartCall = data.trace.find(t => t.tool === 'generate_chart_tool')
          if (chartCall && chartCall.tool_result && !chartCall.tool_result.error) {
            try {
              chartData = typeof chartCall.tool_result === 'string' 
                ? JSON.parse(chartCall.tool_result) 
                : chartCall.tool_result
            } catch (e) {
              console.error("Failed to parse chart data:", e)
            }
          }
        }
        
        setHistory(prev => [...prev, {
          role: 'assistant',
          content: data.answer,
          trace: data.trace,
          chart: chartData
        }])
      } else {
        console.error('API Error:', data.detail)
        setHistory(prev => [...prev, { role: 'assistant', content: "I'm sorry, but I encountered an internal system error while processing your request. Please try asking again." }])
      }
    } catch (err) {
      console.error('Connection Error:', err)
      setHistory(prev => [...prev, { role: 'assistant', content: "I'm sorry, but I couldn't reach the server. Please check your network connection and try again." }])
    }
    setLoading(false)
  }

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased flex w-full min-h-screen">
      {showSplash && (
        <div className={`fixed inset-0 z-[100] bg-gradient-to-br from-gray-900 via-gray-800 to-black flex flex-col items-center justify-center transition-opacity duration-1000 ${showSplash ? 'opacity-100' : 'opacity-0'}`}>
          <div className="relative flex items-center justify-center">
             <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse"></div>
             <div className="flex flex-col items-center gap-6 z-10 animate-in zoom-in duration-700">
                <div className="w-24 h-24 bg-gradient-to-tr from-primary to-tertiary rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/30 rotate-12 transition-transform hover:rotate-0">
                  <span className="material-symbols-outlined text-[48px] text-white -rotate-12">troubleshoot</span>
                </div>
                <h1 className="font-headline-lg text-4xl text-white font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Data Lens AI</h1>
             </div>
          </div>
          <p className="mt-8 text-gray-400 font-label-mono-sm tracking-widest uppercase animate-pulse">Initializing Production Engine...</p>
        </div>
      )}
      


      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-72 bg-inverse-surface text-inverse-on-surface z-50 flex flex-col justify-between select-none border-r border-surface-variant/20 shadow-xl">
        <div className="flex flex-col h-full">
          <div className="h-16 px-6 flex items-center justify-between border-b border-surface-variant/10">
            <div className="flex items-center gap-3 cursor-pointer" onClick={createNewSession}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-tertiary flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-[18px] text-white">troubleshoot</span>
              </div>
              <span className="font-headline-sm text-lg text-inverse-on-surface tracking-tight font-semibold">Data Lens AI</span>
            </div>
            <button onClick={createNewSession} className="w-8 h-8 rounded-full bg-surface-variant/10 hover:bg-surface-variant/30 flex items-center justify-center transition-colors" title="New Chat">
              <span className="material-symbols-outlined text-[18px]">edit_square</span>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
            <div className="px-6 py-5">
              <button onClick={() => fileInputRef.current?.click()} className="w-full h-10 px-4 rounded-xl bg-primary hover:bg-primary-container text-on-primary transition-all flex items-center justify-center gap-2 group shadow-md hover:shadow-lg">
                <span className="material-symbols-outlined text-[20px]">cloud_upload</span>
                <span className="font-body-sm font-semibold tracking-wide">Upload Dataset</span>
              </button>
              <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleUpload} />
            </div>

            {schemas.length > 0 && (
              <div className="mb-6">
                <div className="px-6 pb-2 flex items-center justify-between text-outline-variant">
                  <span className="font-label-mono-sm uppercase tracking-wider text-[10px] font-bold">Active Datasets</span>
                </div>
                <div className="px-4 space-y-1">
                  {schemas.map((schema, i) => (
                    <div key={i} onClick={() => handleSelectDataset(schema)} className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer group transition-all ${selectedDataset === schema ? 'bg-primary/20 border border-primary/30' : 'hover:bg-surface-variant/10 border border-transparent'}`}>
                      <div className="flex items-center gap-3 truncate">
                        <span className="material-symbols-outlined text-primary-fixed text-[18px]">table_chart</span>
                        <div className="flex flex-col min-w-0">
                          <span className="font-body-sm text-sm text-inverse-on-surface truncate font-medium">{schema.filename || 'dataset.csv'}</span>
                          <span className="font-label-mono-sm text-[10px] text-outline-variant">{schema.row_count} rows</span>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => handleDeleteDataset(e, schema)} 
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all shrink-0"
                        title="Delete Dataset"
                      >
                        <span className="material-symbols-outlined text-[16px] block">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-6 pt-2 pb-2 flex items-center justify-between text-outline-variant">
                <span className="font-label-mono-sm uppercase tracking-wider text-[10px] font-bold">Past Conversations</span>
              </div>
              <div className="px-4 pb-4 space-y-1 overflow-y-auto">
                {sessions.length === 0 && <p className="px-2 text-outline-variant text-xs italic">No past conversations</p>}
                {sessions.map((s, i) => (
                  <div key={i} onClick={() => loadSession(s.id)} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${sessionId === s.id ? 'bg-surface-variant/20 border border-surface-variant/30' : 'hover:bg-surface-variant/10 border border-transparent'}`}>
                    <span className="material-symbols-outlined text-outline-variant text-[16px]">chat_bubble</span>
                    <span className="font-body-sm text-sm text-inverse-on-surface truncate flex-1">{s.title}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </aside>

      {/* Right Sidebar for Logs */}
      {allTraces.length > 0 && (
        <aside className="fixed right-0 top-0 h-full w-80 bg-inverse-surface text-inverse-on-surface z-40 flex flex-col border-l border-surface-variant/20 shadow-xl">
          <div className="px-6 py-4 border-b border-surface-variant/10 flex items-center justify-between">
            <span className="font-headline-sm text-sm tracking-tight font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              Live Engine Logs
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">
            {allTraces.map((trace, i) => (
              <div key={i} className="bg-surface-variant/10 p-3 rounded-xl border border-surface-variant/20 hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-1.5 text-primary-fixed mb-2">
                  <span className="material-symbols-outlined text-[16px]">terminal</span>
                  <span className="font-label-mono-sm text-[11px] font-bold tracking-wide uppercase">{trace.tool ? trace.tool.replace('_tool', '') : 'engine'}</span>
                </div>
                <pre className="text-[11px] text-gray-400 whitespace-pre-wrap overflow-x-auto leading-relaxed">{JSON.stringify(trace.input, null, 2)}</pre>
              </div>
            ))}
          </div>
        </aside>
      )}

      <div className={`pl-72 flex-1 flex flex-col w-full h-screen bg-surface-container-lowest transition-all ${allTraces.length > 0 ? 'pr-80' : 'pr-0'}`}>
        <main className="relative flex-1 px-margin flex flex-col overflow-hidden pt-8 pb-4 mt-0">
          {/* Custom Toast Notification */}
          {toast && (
            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[150] animate-in slide-in-from-top-4 fade-in duration-300">
              <div className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.4)] ${
                toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
              }`}>
                <span className="material-symbols-outlined text-[18px]">
                  {toast.type === 'success' ? 'check_circle' : 'error'}
                </span>
                <span className="font-body-sm font-semibold tracking-wide whitespace-nowrap">{toast.message}</span>
              </div>
            </div>
          )}

          <div className={`flex-1 overflow-y-auto flex flex-col gap-8 w-full mx-auto pb-32 ${selectedDataset ? 'max-w-full px-8' : 'max-w-4xl px-4'}`}>
            
            {selectedDataset ? (
              <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-8">
                <button onClick={() => setSelectedDataset(null)} className="self-start flex items-center gap-2 px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl transition-all font-body-sm font-semibold shadow-sm hover:shadow-md">
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  Return to Chat
                </button>
                <div className="bg-surface border border-surface-container rounded-3xl p-8 shadow-xl">
                  <div className="flex items-start justify-between mb-8">
                    <div>
                      <h2 className="font-headline-lg text-3xl text-on-surface font-bold tracking-tight mb-2">{selectedDataset.filename || 'Dataset'}</h2>
                      <p className="font-body-md text-on-surface-variant flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">format_list_numbered</span>
                        {selectedDataset.row_count} total rows
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[24px]">table_chart</span>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto border border-surface-container rounded-2xl shadow-sm custom-scrollbar pb-2">
                    {datasetPreview ? (
                      <table className="w-full text-left text-body-sm whitespace-nowrap">
                        <thead className="bg-surface-container text-on-surface uppercase font-label-mono-sm text-[11px] tracking-wider font-bold sticky top-0">
                          <tr>
                            {selectedDataset.columns.map((col, idx) => (
                              <th key={idx} className="px-6 py-4 border-b border-surface-container-high">{col.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-container bg-surface-container-lowest">
                          {datasetPreview.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-surface-variant/5 transition-colors">
                              {selectedDataset.columns.map((col, colIdx) => (
                                <td key={colIdx} className="px-6 py-3 text-on-surface-variant max-w-xs truncate" title={String(row[col.name])}>
                                  {String(row[col.name])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-12 flex flex-col items-center justify-center text-outline-variant animate-pulse">
                        <span className="material-symbols-outlined text-[32px] mb-2">hourglass_empty</span>
                        <span className="font-body-sm">Loading dataset preview...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {history.length === 0 && (
                  <div className="m-auto text-center text-outline-variant max-w-lg animate-in fade-in zoom-in-95 duration-700">
                    <div className="w-20 h-20 mx-auto bg-surface-container rounded-3xl flex items-center justify-center mb-6 shadow-inner rotate-12 hover:rotate-0 transition-transform">
                       <span className="material-symbols-outlined text-[36px] text-primary">troubleshoot</span>
                    </div>
                    <h3 className="font-headline-md text-2xl text-on-surface mb-3 font-bold">Welcome to Data Lens AI</h3>
                    <p className="font-body-md text-on-surface-variant leading-relaxed">Upload a CSV dataset from the sidebar to begin your production-grade analysis session. The AI engine supports SQL, Pandas, and interactive Plotly charting.</p>
                  </div>
                )}

            {history.map((msg, i) => (
              msg.role === 'user' ? (
                <div key={i} className="flex justify-end w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-start gap-3 max-w-2xl">
                    <div className="flex flex-col items-end">
                      <div className="bg-primary text-on-primary px-6 py-4 rounded-3xl rounded-tr-sm shadow-md">
                        <p className="font-body-md text-[15px] leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0 shadow-sm border border-surface-container">
                      <span className="material-symbols-outlined text-[20px] text-on-surface">person</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-4 w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-tertiary text-white flex items-center justify-center shrink-0 shadow-md border border-primary/20">
                    <span className="material-symbols-outlined text-[20px]">troubleshoot</span>
                  </div>
                  <div className="flex-1 flex flex-col gap-4 bg-surface px-8 py-6 rounded-3xl shadow-sm border border-surface-container">
                    
                    <div className="flex items-center gap-2 pb-2 border-b border-surface-container/50">
                      <span className="font-headline-sm text-base text-on-surface font-bold tracking-tight">Data Lens Analyst</span>
                    </div>
                    
                    <div className="font-body-md text-[15px] text-on-surface leading-relaxed prose prose-sm max-w-none prose-p:my-2 prose-headings:mb-3 prose-headings:mt-6 prose-li:my-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    
                    {msg.chart && (
                       <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-inner border border-surface-container mt-2">
                         <Plot
                            data={msg.chart.data}
                            layout={{
                              ...msg.chart.layout, 
                              autosize: true, 
                              paper_bgcolor: 'transparent', 
                              plot_bgcolor: 'transparent', 
                              font: {color: '#475569', size: 10},
                              margin: { t: 50, r: 20, b: 60, l: 40 },
                              xaxis: { ...msg.chart.layout?.xaxis, automargin: true, tickangle: 0, tickfont: { size: 8 } },
                              yaxis: { ...msg.chart.layout?.yaxis, automargin: true },
                              showlegend: false
                            }}
                            useResizeHandler={true}
                            style={{width: '100%', height: '320px'}}
                            config={{displayModeBar: false}}
                          />
                       </div>
                    )}
                  </div>
                </div>
              )
            ))}

            {loading && (
              <div className="flex items-start gap-4 w-full animate-in fade-in duration-300">
                <div className="w-10 h-10 rounded-full bg-surface-container text-on-surface flex items-center justify-center shrink-0 shadow-sm border border-surface-container animate-pulse">
                  <span className="material-symbols-outlined text-[20px]">neurology</span>
                </div>
                <div className="flex-1 flex flex-col gap-4 bg-surface px-6 py-5 rounded-3xl shadow-sm border border-surface-container max-w-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full font-label-mono-sm text-[11px] font-bold tracking-wider">
                      <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                      PROCESSING
                    </div>
                    <span className="font-body-sm text-[13px] text-on-surface-variant animate-pulse">
                      Running Data Engine...
                    </span>
                  </div>
                </div>
              </div>
            )}
            </>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </main>
      </div>

      {/* FIXED BOTTOM FLOATING INPUT DOCK */}
      <div className={`fixed bottom-8 left-72 px-8 z-30 pointer-events-none transition-all ${allTraces.length > 0 ? 'right-80' : 'right-0'}`}>
        <div className="max-w-3xl mx-auto w-full bg-surface-container-lowest/80 backdrop-blur-xl p-2.5 rounded-[2rem] shadow-2xl flex items-center gap-3 border border-surface-container pointer-events-auto transition-transform hover:-translate-y-1 duration-300">
          <input 
            className="flex-1 bg-transparent text-on-surface placeholder:text-outline focus:outline-none font-body-md text-[15px] py-3 px-5" 
            placeholder="Ask Data Lens AI about your dataset..." 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button onClick={handleSend} disabled={loading} className="w-12 h-12 rounded-full bg-primary hover:bg-primary-container text-on-primary flex items-center justify-center transition-all shadow-md shrink-0 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100">
            <span className="material-symbols-outlined text-[20px] ml-0.5">arrow_upward</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
