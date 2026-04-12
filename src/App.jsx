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

// ── Modal ──────────────────────────────────────────────────────────────────────
function Modal({ service, onClose, onSave }) {
  const [qty, setQty]           = useState('')
  const [price, setPrice]       = useState('')
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
function QuoteDoc({ clientName, items, quoteRef }) {
  const today    = new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })
  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const vat      = subtotal * VAT
  const total    = subtotal + vat

  return (
    <div ref={quoteRef} className="qdoc">
      {/* Header */}
      <div className="qdoc-header">
        <div className="qdoc-company">אפיק מערכות אלומיניום</div>
        <div className="qdoc-subtitle">הצעת מחיר</div>
      </div>

      {/* Meta */}
      <div className="qdoc-meta">
        <div><span className="qdoc-label">לקוח:</span> <span className="qdoc-val">{clientName || '—'}</span></div>
        <div><span className="qdoc-label">תאריך:</span> <span className="qdoc-val">{today}</span></div>
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

      {/* Footer / signature */}
      <div className="qdoc-footer">
        <div className="qdoc-note">הצעת מחיר זו תקפה ל-30 יום מתאריך הנ&quot;ל.</div>
        <div className="qdoc-sig">
          <div className="sig-line" />
          <div className="sig-name">אברהם פרי</div>
          <div className="sig-title">מנכ&quot;ל, אפיק מערכות אלומיניום</div>
        </div>
      </div>
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [clientName,    setClientName]    = useState('')
  const [items,         setItems]         = useState([])
  const [activeService, setActiveService] = useState(null)
  const [generating,    setGenerating]    = useState(false)
  const quoteRef = useRef(null)

  const addItem    = (item) => { setItems((prev) => [...prev, item]); setActiveService(null) }
  const removeItem = (idx)  => setItems((prev) => prev.filter((_, i) => i !== idx))

  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const vat      = subtotal * VAT
  const total    = subtotal + vat

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

      // multi-page support
      let remaining = imgH - pageH
      let offset    = 0
      while (remaining > 0) {
        offset -= pageH
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, offset, imgW, imgH)
        remaining -= pageH
      }

      pdf.save(`הצעת-מחיר-${clientName || 'לקוח'}.pdf`)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="app" dir="rtl">
      {/* ── App header ── */}
      <header className="app-header">
        <span className="header-icon">🏗️</span>
        <div>
          <h1>אפיק מערכות אלומיניום</h1>
          <p>מערכת הצעות מחיר</p>
        </div>
      </header>

      <div className="container">
        {/* Client name */}
        <div className="card">
          <label className="field-label" htmlFor="client">שם הלקוח</label>
          <input
            id="client"
            className="client-input"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="הכנס שם לקוח..."
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
        <QuoteDoc clientName={clientName} items={items} quoteRef={quoteRef} />
      </div>
    </div>
  )
}
