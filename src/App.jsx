import { useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const VAT = 0.18

const SERVICES = [
  { id: 'pergola',   emoji: '🏗️', name: 'פרגולה אלומיניום', unit: 'מ"ר',    priceLabel: 'מחיר למ"ר' },
  { id: 'lighting',  emoji: '💡', name: 'תאורה',             unit: 'מטר',   priceLabel: 'מחיר למטר' },
  { id: 'partition', emoji: '🪟', name: 'גדר',               unit: 'מטר',   priceLabel: 'מחיר למטר' },
  { id: 'gate',      emoji: '🚪', name: 'שער',               unit: 'יחידות', priceLabel: 'מחיר ליחידה' },
  { id: 'shade',     emoji: '⛱️', name: 'מסכי זיפ',          unit: 'מ"ר',    priceLabel: 'מחיר למ"ר' },
  { id: 'sliding',   emoji: '🪟', name: 'סגירה חלונות הזזה', unit: 'מ"ר',    priceLabel: 'מחיר למ"ר' },
  { id: 'custom',    emoji: '➕', name: 'פריט נוסף',         unit: '',       priceLabel: '', isCustom: true },
]

const fmt = (n) =>
  Number(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── localStorage helpers ───────────────────────────────────────────────────────
function loadProposals() {
  try {
    return JSON.parse(localStorage.getItem('pergola_proposals') || '[]')
  } catch {
    return []
  }
}

function persistProposals(list) {
  localStorage.setItem('pergola_proposals', JSON.stringify(list))
}

// ── Modal ──────────────────────────────────────────────────────────────────────
function Modal({ service, onClose, onSave }) {
  const [qty, setQty]               = useState('')
  const [price, setPrice]           = useState('')
  const [customName, setCustomName] = useState('')
  const [customUnit, setCustomUnit] = useState('מ"ר')

  const unit  = service.isCustom ? customUnit : service.unit
  const total = qty && price ? parseFloat(qty) * parseFloat(price) : 0

  const handleSave = () => {
    if (!qty || !price || parseFloat(qty) <= 0 || parseFloat(price) <= 0) return
    if (service.isCustom && !customName.trim()) return
    onSave({
      name:         service.isCustom ? customName.trim() : service.name,
      quantity:     parseFloat(qty),
      unit,
      pricePerUnit: parseFloat(price),
      total:        parseFloat(qty) * parseFloat(price),
    })
  }

  const handleKey = (e) => { if (e.key === 'Enter') handleSave() }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-emoji">{service.emoji}</span>
          <h2>{service.name}</h2>
        </div>

        {service.isCustom && (
          <>
            <div className="field">
              <label>שם הפריט</label>
              <input
                autoFocus
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="לדוגמה: ברזנט, עמודים..."
                onKeyDown={handleKey}
              />
            </div>
            <div className="field">
              <label>יחידת מידה</label>
              <div className="unit-options">
                {['מ"ר', 'מטר', 'יחידות'].map((u) => (
                  <button
                    key={u}
                    className={`unit-btn${customUnit === u ? ' active' : ''}`}
                    onClick={() => setCustomUnit(u)}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="field">
          <label>כמות ({unit})</label>
          <input
            type="number"
            min="0"
            autoFocus={!service.isCustom}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
            onKeyDown={handleKey}
          />
        </div>

        <div className="field">
          <label>{service.isCustom ? 'מחיר ליחידה (₪)' : `${service.priceLabel} (₪)`}</label>
          <input
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            onKeyDown={handleKey}
          />
        </div>

        {total > 0 && (
          <div className="modal-preview-total">
            סה&quot;כ: <strong>₪{fmt(total)}</strong>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-primary" onClick={handleSave}>הוסף לרשימה ✓</button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  )
}

// ── Hidden quote document (captured by html2canvas) ────────────────────────────
function QuoteDoc({ clientName, clientAddress, items, quoteRef }) {
  const today    = new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })
  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const vat      = subtotal * VAT
  const total    = subtotal + vat

  return (
    <div ref={quoteRef} className="qdoc">
      {/* Header */}
      <div className="qdoc-header">
        <img src="/logo.jpg" alt="לוגו אפיק" className="qdoc-logo" />
        <div className="qdoc-header-text">
          <div className="qdoc-company">אפיק מערכות אלומיניום</div>
          <div className="qdoc-contact">
            <span>📍 אברהם בורמה שביט 1, ראשון לציון</span>
            <span>📞 052-2544844</span>
            <span>✉️ afikma2000@gmail.com</span>
            <span>🌐 afikaluminumsystem.com</span>
          </div>
        </div>
      </div>

      {/* Document title */}
      <div className="qdoc-doc-title">הצעת מחיר</div>

      {/* Meta */}
      <div className="qdoc-meta">
        <div><span className="qdoc-label">לקוח:</span> <span className="qdoc-val">{clientName || '—'}</span></div>
        {clientAddress && <div><span className="qdoc-label">כתובת:</span> <span className="qdoc-val">{clientAddress}</span></div>}
        <div><span className="qdoc-label">תאריך:</span> <span className="qdoc-val">{today}</span></div>
      </div>

      {/* Specifications */}
      <div className="qdoc-specs">
        <div className="qdoc-specs-title">מפרט טכני</div>
        <div className="qdoc-specs-row">מסגרת היקפית: דאבל T 140x80, עובי 2 מ&quot;מ</div>
        <div className="qdoc-specs-row">הצללות: 40x20, רווח 2 ס&quot;מ, עובי 1 מ&quot;מ</div>
        <div className="qdoc-specs-row">עמודים 100x100</div>
        <div className="qdoc-specs-row">סנטף: BH איכותי, חברת פלרם</div>
      </div>

      {/* Items table */}
      <table className="qdoc-table">
        <thead>
          <tr>
            <th>פריט</th>
            <th>כמות</th>
            <th>מחיר ליחידה</th>
            <th>סה&quot;כ</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className={i % 2 === 0 ? 'even' : ''}>
              <td>{item.name}</td>
              <td>{item.quantity} {item.unit}</td>
              <td>₪{fmt(item.pricePerUnit)}</td>
              <td>₪{fmt(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="qdoc-totals">
        <div className="qdoc-total-row">
          <span>סכום לפני מע&quot;מ:</span><span>₪{fmt(subtotal)}</span>
        </div>
        <div className="qdoc-total-row">
          <span>מע&quot;מ (18%):</span><span>₪{fmt(vat)}</span>
        </div>
        <div className="qdoc-total-row final">
          <span>סה&quot;כ לתשלום:</span><span>₪{fmt(total)}</span>
        </div>
      </div>

      {/* Notes */}
      <div className="qdoc-notes">
        <div>* המחירים כוללים הובלה, התקנה, אחריות מלאה ל-5 שנים.</div>
        <div>* אספקה: 30-45 ימי עסקים</div>
      </div>

      {/* Footer */}
      <div className="qdoc-footer">
        <div className="qdoc-sig">
          <div className="sig-name">אפיק מערכות אלומיניום</div>
        </div>
      </div>
    </div>
  )
}

// ── Proposal History page ──────────────────────────────────────────────────────
function ProposalHistory({ proposals, onEdit, onDelete, onBack }) {
  return (
    <div className="app" dir="rtl">
      <header className="app-header">
        <img src="/logo.jpg" alt="לוגו אפיק" className="header-logo" />
        <div style={{ flex: 1 }}>
          <h1>אפיק מערכות אלומיניום</h1>
          <p>הצעות קודמות</p>
        </div>
        <button className="nav-btn" onClick={onBack}>→ חזור לטופס</button>
      </header>

      <div className="container">
        {proposals.length === 0 ? (
          <div className="card history-empty">
            <div className="history-empty-icon">📋</div>
            <div>אין הצעות שמורות עדיין</div>
            <div className="history-empty-sub">הצעות נשמרות אוטומטית בעת יצוא PDF</div>
          </div>
        ) : (
          proposals.map((p) => (
            <div key={p.id} className="card history-card">
              <div className="history-card-info">
                <div className="history-client">{p.clientName || 'לקוח ללא שם'}</div>
                {p.clientAddress && (
                  <div className="history-address">📍 {p.clientAddress}</div>
                )}
                <div className="history-meta">
                  <span>{new Date(p.createdAt).toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  <span className="history-count">{p.items.length} פריטים</span>
                </div>
              </div>
              <div className="history-card-side">
                <div className="history-total">₪{fmt(p.total)}</div>
                <div className="history-actions">
                  <button className="btn-edit" onClick={() => onEdit(p)}>✏️ עריכה</button>
                  <button className="btn-delete" onClick={() => onDelete(p.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [view,          setView]          = useState('form')  // 'form' | 'history'
  const [clientName,    setClientName]    = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [items,         setItems]         = useState([])
  const [activeService, setActiveService] = useState(null)
  const [generating,    setGenerating]    = useState(false)
  const [editingId,     setEditingId]     = useState(null)
  const [proposals,     setProposals]     = useState([])
  const quoteRef = useRef(null)

  const addItem    = (item) => { setItems((prev) => [...prev, item]); setActiveService(null) }
  const removeItem = (idx)  => setItems((prev) => prev.filter((_, i) => i !== idx))

  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const vat      = subtotal * VAT
  const total    = subtotal + vat

  const handleViewHistory = () => {
    setProposals(loadProposals())
    setView('history')
  }

  const handleEdit = (proposal) => {
    setClientName(proposal.clientName)
    setClientAddress(proposal.clientAddress)
    setItems(proposal.items)
    setEditingId(proposal.id)
    setView('form')
  }

  const handleDelete = (id) => {
    if (!window.confirm('למחוק הצעה זו?')) return
    const updated = proposals.filter((p) => p.id !== id)
    setProposals(updated)
    persistProposals(updated)
  }

  const handleNewProposal = () => {
    setClientName('')
    setClientAddress('')
    setItems([])
    setEditingId(null)
  }

  const generatePDF = async () => {
    if (!quoteRef.current) return
    setGenerating(true)
    try {
      const canvas = await html2canvas(quoteRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      })

      const pdf    = new jsPDF('p', 'mm', 'a4')
      const pageW  = pdf.internal.pageSize.getWidth()
      const pageH  = pdf.internal.pageSize.getHeight()
      const imgW   = pageW
      const imgH   = (canvas.height * pageW) / canvas.width
      const imgData = canvas.toDataURL('image/png')

      pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH)

      let remaining = imgH - pageH
      let offset    = 0
      while (remaining > 0) {
        offset -= pageH
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, offset, imgW, imgH)
        remaining -= pageH
      }

      pdf.save(`הצעת-מחיר-${clientName || 'לקוח'}.pdf`)

      // Persist to localStorage
      const all = loadProposals()
      const now = new Date().toISOString()

      if (editingId) {
        const updated = all.map((p) =>
          p.id === editingId
            ? { ...p, clientName, clientAddress, items, subtotal, vat, total, updatedAt: now }
            : p
        )
        persistProposals(updated)
      } else {
        const newProposal = {
          id: Date.now().toString(),
          clientName,
          clientAddress,
          items,
          subtotal,
          vat,
          total,
          createdAt: now,
          updatedAt: now,
        }
        persistProposals([newProposal, ...all])
        setEditingId(newProposal.id)
      }
    } finally {
      setGenerating(false)
    }
  }

  // ── History view ─────────────────────────────────────────────────────────────
  if (view === 'history') {
    return (
      <ProposalHistory
        proposals={proposals}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onBack={() => setView('form')}
      />
    )
  }

  // ── Form view ─────────────────────────────────────────────────────────────────
  return (
    <div className="app" dir="rtl">
      {/* ── App header ── */}
      <header className="app-header">
        <img src="/logo.jpg" alt="לוגו אפיק" className="header-logo" />
        <div style={{ flex: 1 }}>
          <h1>אפיק מערכות אלומיניום</h1>
          <p>מערכת הצעות מחיר</p>
        </div>
        <button className="nav-btn" onClick={handleViewHistory}>📋 הצעות קודמות</button>
      </header>

      <div className="container">
        {/* Editing banner */}
        {editingId && (
          <div className="editing-banner">
            <span>✏️ עורך הצעה קיימת — שינויים יישמרו בעת יצוא PDF</span>
            <button onClick={handleNewProposal}>+ הצעה חדשה</button>
          </div>
        )}

        {/* Client info */}
        <div className="card">
          <label className="field-label" htmlFor="client">שם הלקוח</label>
          <input
            id="client"
            className="client-input"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="הכנס שם לקוח..."
          />
          <label className="field-label" htmlFor="address" style={{ marginTop: '14px' }}>כתובת הלקוח</label>
          <input
            id="address"
            className="client-input"
            value={clientAddress}
            onChange={(e) => setClientAddress(e.target.value)}
            placeholder="הכנס כתובת..."
          />
        </div>

        {/* Service grid */}
        <div className="card">
          <h2 className="section-title">בחר פריטים להצעה</h2>
          <div className="services-grid">
            {SERVICES.map((svc) => (
              <button
                key={svc.id}
                className="service-card"
                onClick={() => setActiveService(svc)}
              >
                <span className="svc-emoji">{svc.emoji}</span>
                <span className="svc-name">{svc.name}</span>
                {svc.unit && <span className="svc-unit">{svc.unit}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Selected items */}
        {items.length > 0 && (
          <div className="card">
            <h2 className="section-title">פריטים בהצעה</h2>

            <div className="items-list">
              {items.map((item, i) => (
                <div key={i} className="item-row">
                  <div className="item-info">
                    <span className="item-name">{item.name}</span>
                    <span className="item-detail">
                      {item.quantity} {item.unit} × ₪{fmt(item.pricePerUnit)}
                    </span>
                  </div>
                  <span className="item-total">₪{fmt(item.total)}</span>
                  <button className="remove-btn" onClick={() => removeItem(i)} title="הסר">✕</button>
                </div>
              ))}
            </div>

            <div className="summary">
              <div className="summary-row">
                <span>סכום לפני מע&quot;מ</span>
                <span>₪{fmt(subtotal)}</span>
              </div>
              <div className="summary-row">
                <span>מע&quot;מ 18%</span>
                <span>₪{fmt(vat)}</span>
              </div>
              <div className="summary-row summary-total">
                <span>סה&quot;כ לתשלום</span>
                <span>₪{fmt(total)}</span>
              </div>
            </div>

            <button
              className="generate-btn"
              onClick={generatePDF}
              disabled={generating}
            >
              {generating ? 'מייצר PDF...' : '📄 הפק הצעת מחיר PDF'}
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {activeService && (
        <Modal
          service={activeService}
          onClose={() => setActiveService(null)}
          onSave={addItem}
        />
      )}

      {/* Off-screen quote document for PDF rendering */}
      <div style={{ position: 'fixed', top: 0, left: '-9999px', width: '794px', pointerEvents: 'none' }}>
        <QuoteDoc clientName={clientName} clientAddress={clientAddress} items={items} quoteRef={quoteRef} />
      </div>
    </div>
  )
}
