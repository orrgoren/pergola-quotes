import { useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const VAT = 0.18

const SERVICES = [
  { id: 'pergola',   emoji: '🏗️', name: 'פרגולה אלומיניום', unit: 'מ"ר',    priceLabel: 'מחיר למ"ר' },
  { id: 'lighting',  emoji: '💡', name: 'תאורה',             unit: 'מטר',   priceLabel: 'מחיר למטר' },
  { id: 'partition', emoji: '🪟', name: 'גדר',               unit: 'מטר',   priceLabel: 'מחיר למטר' },
  { id: 'gate',      emoji: '🚪', name: 'שער',               unit: 'יחידות', priceLabel: 'מחיר ליחידה' },
  { id: 'shade',     emoji: '⛱️', name: 'מסכי זיפ',          unit: '',       priceLabel: 'מחיר סופי', isShade: true },
  { id: 'sliding',   emoji: '🪟', name: 'סגירה חלונות הזזה', unit: 'מ"ר',    priceLabel: 'מחיר למ"ר' },
  { id: 'gutter',     emoji: '🌧️', name: 'מרזב אלומיניום',       unit: 'מטר',    priceLabel: 'מחיר למטר' },
  { id: 'screen',     emoji: '🪟', name: 'רשת הזזה',             unit: 'יחידות', priceLabel: 'מחיר ליחידה' },
  { id: 'demolition', emoji: '🔨', name: 'פירוק פרגולה קיימת',  units: ['יחידות', 'מ"ר'], priceLabel: 'מחיר' },
  { id: 'crane',      emoji: '🏗️', name: 'מנוף',                 unit: 'יחידות', priceLabel: 'מחיר ליחידה' },
  { id: 'custom',    emoji: '➕', name: 'פריט נוסף',         unit: '',       priceLabel: '', isCustom: true },
  { id: 'discount',  emoji: '🏷️', name: 'הנחה',              unit: '',       priceLabel: '', isDiscount: true },
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
const CENTAF_COLORS    = ['שקוף', 'אפור בהיר']
const LIGHT_COLORS     = ['3000K צהוב', '4000K אור ביניים', '6000K אור לבן']
const PARTITION_TYPES  = ['הייטק', 'הייטק זוויתי']
const GATE_OPERATIONS   = ['כניסה', 'חשמלי', 'חניה']
const SHADE_OPERATIONS  = ['חשמלי', 'ידני', 'קבוע']
const SLIDING_PROFILES  = ['7000', '9000']

function Modal({ service, onClose, onSave, initialItem = null }) {
  const [qty, setQty]                 = useState(initialItem ? String(initialItem.quantity)     : '')
  const [price, setPrice]             = useState(initialItem ? String(initialItem.pricePerUnit) : '')
  const [customName, setCustomName]   = useState(initialItem && service.isCustom  ? initialItem.name : '')
  const [customUnit, setCustomUnit]   = useState(initialItem?.unit ?? (service.units?.[0] ?? 'מ"ר'))
  const [centafColor, setCentafColor] = useState(initialItem?.centafColor         ?? CENTAF_COLORS[0])
  const [zone, setZone]               = useState(initialItem && service.id === 'pergola' ? initialItem.name.slice(service.name.length).trim() : '')
  const [lightColor, setLightColor]       = useState(initialItem?.lightColor      ?? LIGHT_COLORS[0])
  const [partitionType, setPartitionType] = useState(initialItem?.partitionType ?? PARTITION_TYPES[0])
  const [gateStyle,      setGateStyle]      = useState(initialItem?.gateStyle      ?? PARTITION_TYPES[0])
  const [gateOperation,  setGateOperation]  = useState(initialItem?.gateOperation  ?? GATE_OPERATIONS[0])
  const [slidingProfile,   setSlidingProfile]   = useState(initialItem?.slidingProfile   ?? SLIDING_PROFILES[0])
  const [partitionColor,   setPartitionColor]   = useState(initialItem?.partitionColor   ?? '')
  const [partitionProfile, setPartitionProfile] = useState(initialItem?.partitionProfile ?? '')
  const [gateColor,      setGateColor]      = useState(initialItem?.gateColor      ?? '')
  const [discountAmt, setDiscountAmt] = useState(initialItem && service.isDiscount ? String(initialItem.pricePerUnit) : '')
  const [shadeDimensions, setShadeDimensions] = useState(initialItem?.shadeDimensions ?? '')
  const [shadeColor,      setShadeColor]      = useState(initialItem?.shadeColor      ?? '')
  const [shadeOperation,  setShadeOperation]  = useState(initialItem?.shadeOperation  ?? SHADE_OPERATIONS[0])

  const unit  = (service.isCustom || service.units) ? customUnit : service.unit
  const total = qty && price ? parseFloat(qty) * parseFloat(price) : 0

  const handleSave = () => {
    if (service.isDiscount) {
      const amount = parseFloat(discountAmt)
      if (!discountAmt || isNaN(amount) || amount <= 0) return
      onSave({ name: 'הנחה', quantity: 1, unit: '', pricePerUnit: amount, total: amount, isDiscount: true, serviceId: 'discount' })
      return
    }
    if (service.isShade) {
      const priceVal = parseFloat(price)
      if (price === '' || isNaN(priceVal) || priceVal <= 0) return
      onSave({
        name: service.name,
        quantity: 1,
        unit: shadeDimensions.trim(),
        pricePerUnit: priceVal,
        total: priceVal,
        shadeOperation,
        ...(shadeColor.trim() && { shadeColor: shadeColor.trim() }),
        serviceId: 'shade',
      })
      return
    }
    const qtyVal   = parseFloat(qty)
    const priceVal = parseFloat(price)
    if (!qty || qtyVal <= 0 || price === '' || isNaN(priceVal)) return
    if (priceVal < 0) return
    if (!service.isCustom && priceVal <= 0) return
    if (service.isCustom && !customName.trim()) return
    onSave({
      name:         service.isCustom ? customName.trim() : service.id === 'pergola' && zone.trim() ? `${service.name} ${zone.trim()}` : service.name,
      quantity:     parseFloat(qty),
      unit,
      pricePerUnit: parseFloat(price),
      total:        parseFloat(qty) * parseFloat(price),
      ...(service.id === 'pergola'    && { centafColor }),
      ...(service.id === 'lighting'  && { lightColor }),
      ...(service.id === 'partition' && { partitionType, ...(partitionColor.trim() && { partitionColor: partitionColor.trim() }), ...(partitionProfile.trim() && { partitionProfile: partitionProfile.trim() }) }),
      ...(service.id === 'gate'      && { gateStyle, gateOperation, ...(gateColor.trim() && { gateColor: gateColor.trim() }) }),
      ...(service.id === 'sliding'   && { slidingProfile }),
      serviceId: service.id,
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

        {service.isDiscount ? (
          <div className="field">
            <label>סכום הנחה (₪)</label>
            <input
              type="number"
              min="0"
              autoFocus
              value={discountAmt}
              onChange={(e) => setDiscountAmt(e.target.value)}
              placeholder="0"
              onKeyDown={handleKey}
            />
          </div>
        ) : (
          <>
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

            {service.units && !service.isCustom && (
              <div className="field">
                <label>יחידת מידה</label>
                <div className="unit-options">
                  {service.units.map((u) => (
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
            )}

            {service.isShade && (
              <>
                <div className="field">
                  <label>סוג תפעול</label>
                  <div className="unit-options">
                    {SHADE_OPERATIONS.map((o) => (
                      <button
                        key={o}
                        className={`unit-btn${shadeOperation === o ? ' active' : ''}`}
                        onClick={() => setShadeOperation(o)}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>מידות (אופציונלי)</label>
                  <input
                    autoFocus
                    value={shadeDimensions}
                    onChange={(e) => setShadeDimensions(e.target.value)}
                    placeholder='לדוגמה: 200x250'
                    onKeyDown={handleKey}
                  />
                </div>
                <div className="field">
                  <label>צבע (אופציונלי)</label>
                  <input
                    value={shadeColor}
                    onChange={(e) => setShadeColor(e.target.value)}
                    placeholder='לדוגמה: אנתרציט, לבן...'
                    onKeyDown={handleKey}
                  />
                </div>
              </>
            )}

            {service.id === 'pergola' && (
              <>
                <div className="field">
                  <label>צבע סנטף</label>
                  <div className="unit-options">
                    {CENTAF_COLORS.map((c) => (
                      <button
                        key={c}
                        className={`unit-btn${centafColor === c ? ' active' : ''}`}
                        onClick={() => setCentafColor(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>איזור</label>
                  <input
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    placeholder="לדוגמה: קדמית, אחורית..."
                    onKeyDown={handleKey}
                  />
                </div>
              </>
            )}

            {service.id === 'lighting' && (
              <div className="field">
                <label>צבע אור</label>
                <div className="unit-options">
                  {LIGHT_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`unit-btn${lightColor === c ? ' active' : ''}`}
                      onClick={() => setLightColor(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {service.id === 'partition' && (
              <>
                <div className="field">
                  <label>סוג גדר</label>
                  <div className="unit-options">
                    {PARTITION_TYPES.map((t) => (
                      <button
                        key={t}
                        className={`unit-btn${partitionType === t ? ' active' : ''}`}
                        onClick={() => setPartitionType(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>צבע (אופציונלי)</label>
                  <input
                    value={partitionColor}
                    onChange={(e) => setPartitionColor(e.target.value)}
                    placeholder="לדוגמה: אנתרציט, לבן..."
                    onKeyDown={handleKey}
                  />
                </div>
                <div className="field">
                  <label>סוג פרופיל (אופציונלי)</label>
                  <input
                    value={partitionProfile}
                    onChange={(e) => setPartitionProfile(e.target.value)}
                    placeholder="לדוגמה: 40x40, 60x40..."
                    onKeyDown={handleKey}
                  />
                </div>
              </>
            )}

            {service.id === 'gate' && (
              <>
                <div className="field">
                  <label>סוג שער</label>
                  <div className="unit-options">
                    {PARTITION_TYPES.map((t) => (
                      <button
                        key={t}
                        className={`unit-btn${gateStyle === t ? ' active' : ''}`}
                        onClick={() => setGateStyle(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>סוג פתיחה</label>
                  <div className="unit-options">
                    {GATE_OPERATIONS.map((o) => (
                      <button
                        key={o}
                        className={`unit-btn${gateOperation === o ? ' active' : ''}`}
                        onClick={() => setGateOperation(o)}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>צבע (אופציונלי)</label>
                  <input
                    value={gateColor}
                    onChange={(e) => setGateColor(e.target.value)}
                    placeholder="לדוגמה: אנתרציט, לבן..."
                    onKeyDown={handleKey}
                  />
                </div>
              </>
            )}

            {service.id === 'sliding' && (
              <div className="field">
                <label>סוג פרופיל</label>
                <select
                  className="field-select"
                  value={slidingProfile}
                  onChange={(e) => setSlidingProfile(e.target.value)}
                >
                  {SLIDING_PROFILES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            )}

            {!service.isShade && (
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
            )}

            <div className="field">
              <label>{service.isCustom ? 'מחיר ליחידה (₪)' : `${service.priceLabel} (₪)`}</label>
              <input
                type="number"
                min="0"
                autoFocus={service.isShade}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                onKeyDown={handleKey}
              />
            </div>

            {(total > 0 || (service.isShade && parseFloat(price) > 0)) && (
              <div className="modal-preview-total">
                סה&quot;כ: <strong>₪{fmt(service.isShade ? parseFloat(price) : total)}</strong>
              </div>
            )}
          </>
        )}

        <div className="modal-actions">
          <button className="btn-primary" onClick={handleSave}>{initialItem ? 'עדכן ✓' : 'הוסף לרשימה ✓'}</button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  )
}

// ── Hidden quote document (captured by html2canvas) ────────────────────────────
function QuoteDoc({ clientName, clientAddress, items, quoteRef }) {
  const today         = new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })
  const regularItems  = items.filter((i) => !i.isDiscount)
  const discountTotal = items.filter((i) => i.isDiscount).reduce((s, i) => s + i.total, 0)
  const subtotal      = regularItems.reduce((s, i) => s + i.total, 0)
  const vat           = subtotal * VAT
  const total         = subtotal + vat - discountTotal
  const hasPergola    = items.some((i) => i.centafColor   != null)
  const hasSliding    = items.some((i) => i.slidingProfile != null)

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

      {/* Specifications — shown when pergola and/or sliding windows are in the quote */}
      {(hasPergola || hasSliding) && (
        <div className="qdoc-specs">
          <div className="qdoc-specs-title">מפרט טכני</div>
          {hasPergola && (
            <>
              <div className="qdoc-specs-row">מסגרת היקפית: דאבל T מידה 140x80, עובי 2 מ&quot;מ</div>
              <div className="qdoc-specs-row">הצללות: 40x20, רווח 2 ס&quot;מ, עובי 1 מ&quot;מ</div>
              <div className="qdoc-specs-row">עמודים 100x100</div>
              <div className="qdoc-specs-row">סנטף: BH איכותי, חברת פלרם</div>
            </>
          )}
          {hasSliding && (
            <div className="qdoc-specs-row">זכוכית טריפלקס 4*4</div>
          )}
        </div>
      )}

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
              <td>{item.isDiscount ? item.name : `${item.name}${item.centafColor ? ` | סנטף: ${item.centafColor}` : ''}${item.lightColor ? ` | ${item.lightColor}` : ''}${item.partitionType ? ` | ${item.partitionType}` : ''}${item.gateStyle ? ` | ${item.gateStyle}` : ''}${item.gateOperation ? ` | ${item.gateOperation}` : ''}${item.slidingProfile ? ` | פרופיל: ${item.slidingProfile}` : ''}${item.partitionColor ? ` | צבע: ${item.partitionColor}` : ''}${item.partitionProfile ? ` | פרופיל: ${item.partitionProfile}` : ''}${item.gateColor ? ` | צבע: ${item.gateColor}` : ''}${item.shadeOperation ? ` | ${item.shadeOperation}` : ''}${item.shadeColor ? ` | צבע: ${item.shadeColor}` : ''}`}</td>
              <td>{item.isDiscount ? '—' : item.shadeOperation != null ? (item.unit || '—') : `${item.quantity} ${item.unit}`}</td>
              <td>{item.isDiscount ? '—' : `₪${fmt(item.pricePerUnit)}`}</td>
              <td style={item.isDiscount ? { color: '#dc2626', fontWeight: 700 } : {}}>
                {item.isDiscount ? `-₪${fmt(item.total)}` : `₪${fmt(item.total)}`}
              </td>
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
        {discountTotal > 0 && (
          <div className="qdoc-total-row" style={{ color: '#dc2626' }}>
            <span>הנחה:</span><span>-₪{fmt(discountTotal)}</span>
          </div>
        )}
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

// ── Infer the SERVICES entry for an already-saved item (supports legacy items without serviceId) ──
function inferService(item) {
  if (item.serviceId) return SERVICES.find((s) => s.id === item.serviceId) ?? null
  if (item.isDiscount)          return SERVICES.find((s) => s.id === 'discount')
  if (item.centafColor   != null) return SERVICES.find((s) => s.id === 'pergola')
  if (item.lightColor    != null) return SERVICES.find((s) => s.id === 'lighting')
  if (item.partitionType != null) return SERVICES.find((s) => s.id === 'partition')
  if (item.gateStyle      != null) return SERVICES.find((s) => s.id === 'gate')
  if (item.slidingProfile != null) return SERVICES.find((s) => s.id === 'sliding')
  if (item.shadeOperation != null) return SERVICES.find((s) => s.id === 'shade')
  const match = SERVICES.find((s) => !s.isCustom && !s.isDiscount && item.name.startsWith(s.name))
  return match ?? SERVICES.find((s) => s.isCustom) ?? null
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [view,            setView]            = useState('form')  // 'form' | 'history'
  const [clientName,      setClientName]      = useState('')
  const [clientAddress,   setClientAddress]   = useState('')
  const [items,           setItems]           = useState([])
  const [activeService,   setActiveService]   = useState(null)
  const [editingItemIdx,  setEditingItemIdx]  = useState(null)
  const [generating,      setGenerating]      = useState(false)
  const [showPreview,     setShowPreview]     = useState(false)
  const [editingId,       setEditingId]       = useState(null)
  const [proposals,       setProposals]       = useState([])
  const quoteRef = useRef(null)

  const closeModal = () => { setActiveService(null); setEditingItemIdx(null) }

  const saveItem = (item) => {
    if (editingItemIdx !== null) {
      setItems((prev) => prev.map((it, i) => i === editingItemIdx ? item : it))
    } else {
      setItems((prev) => [...prev, item])
    }
    closeModal()
  }

  const openItemEdit = (idx) => {
    const svc = inferService(items[idx])
    if (!svc) return
    setEditingItemIdx(idx)
    setActiveService(svc)
  }

  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx))

  const regularItems  = items.filter((i) => !i.isDiscount)
  const discountTotal = items.filter((i) => i.isDiscount).reduce((s, i) => s + i.total, 0)
  const subtotal      = regularItems.reduce((s, i) => s + i.total, 0)
  const vat           = subtotal * VAT
  const total         = subtotal + vat - discountTotal

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

      const saveDate = new Date()
      const ts = `${saveDate.getDate().toString().padStart(2,'0')}-${(saveDate.getMonth()+1).toString().padStart(2,'0')}-${String(saveDate.getFullYear()).slice(2)}_${saveDate.getHours().toString().padStart(2,'0')}-${saveDate.getMinutes().toString().padStart(2,'0')}`
      pdf.save(`הצעת-מחיר-${clientName || 'לקוח'}-${ts}.pdf`)

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
                className={`service-card${svc.isDiscount ? ' service-card-discount' : ''}`}
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
                    <span className="item-name">
                      {item.name}
                      {item.centafColor ? ` | סנטף: ${item.centafColor}` : ''}
                      {item.lightColor     ? ` | ${item.lightColor}`     : ''}{item.partitionType ? ` | ${item.partitionType}` : ''}{item.gateStyle ? ` | ${item.gateStyle}` : ''}{item.gateOperation ? ` | ${item.gateOperation}` : ''}{item.slidingProfile ? ` | פרופיל: ${item.slidingProfile}` : ''}{item.partitionColor ? ` | צבע: ${item.partitionColor}` : ''}{item.partitionProfile ? ` | פרופיל: ${item.partitionProfile}` : ''}{item.gateColor ? ` | צבע: ${item.gateColor}` : ''}
                      {item.shadeOperation ? ` | ${item.shadeOperation}` : ''}{item.shadeColor ? ` | צבע: ${item.shadeColor}` : ''}
                    </span>
                    {!item.isDiscount && (
                      <span className="item-detail">
                        {item.shadeOperation != null
                          ? item.unit ? `מידות: ${item.unit}` : ''
                          : `${item.quantity} ${item.unit} × ₪${fmt(item.pricePerUnit)}`
                        }
                      </span>
                    )}
                  </div>
                  <span className="item-total" style={item.isDiscount ? { color: '#dc2626' } : {}}>
                    {item.isDiscount ? '-' : ''}₪{fmt(item.total)}
                  </span>
                  <button className="btn-item-edit" onClick={() => openItemEdit(i)} title="ערוך">✏️</button>
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
              {discountTotal > 0 && (
                <div className="summary-row" style={{ color: '#dc2626' }}>
                  <span>הנחה</span>
                  <span>-₪{fmt(discountTotal)}</span>
                </div>
              )}
              <div className="summary-row summary-total">
                <span>סה&quot;כ לתשלום</span>
                <span>₪{fmt(total)}</span>
              </div>
            </div>

            <div className="action-buttons">
              <button className="preview-btn" onClick={() => setShowPreview(true)}>
                👁 תצוגה מקדימה
              </button>
              <button
                className="generate-btn"
                onClick={generatePDF}
                disabled={generating}
              >
                {generating ? 'מייצר PDF...' : '📄 הפק הצעת מחיר PDF'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {activeService && (
        <Modal
          service={activeService}
          onClose={closeModal}
          onSave={saveItem}
          initialItem={editingItemIdx !== null ? items[editingItemIdx] : null}
        />
      )}

      {/* Off-screen quote document for PDF rendering */}
      <div style={{ position: 'fixed', top: 0, left: '-9999px', width: '794px', pointerEvents: 'none' }}>
        <QuoteDoc clientName={clientName} clientAddress={clientAddress} items={items} quoteRef={quoteRef} />
      </div>

      {/* Preview overlay */}
      {showPreview && (
        <div className="preview-overlay" onClick={() => setShowPreview(false)}>
          <div className="preview-toolbar" onClick={(e) => e.stopPropagation()}>
            <button className="preview-close-btn" onClick={() => setShowPreview(false)}>✕ סגור</button>
          </div>
          <div className="preview-doc-wrapper" onClick={(e) => e.stopPropagation()}>
            <QuoteDoc clientName={clientName} clientAddress={clientAddress} items={items} quoteRef={null} />
          </div>
        </div>
      )}
    </div>
  )
}
