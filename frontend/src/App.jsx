import { useState, useEffect } from 'react'
import axios from 'axios'
import './index.css'

const API = 'http://127.0.0.1:5000/api'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [user, setUser] = useState(null)
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [txs, setTxs] = useState([])
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 })
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food')
  const [desc, setDesc] = useState('')
  const [fromCur, setFromCur] = useState('KES')
  const [toCur, setToCur] = useState('USD')
  const [exAmount, setExAmount] = useState(1000)
  const [exResult, setExResult] = useState(null)

  const headers = { headers: { Authorization: `Bearer ${token}` } }

  const loadData = async () => {
    try {
      const [t, s] = await Promise.all([
        axios.get(`${API}/transactions`, headers),
        axios.get(`${API}/summary`, headers)
      ])
      setTxs(t.data); setSummary(s.data)
    } catch (e) { console.log(e) }
  }

  useEffect(() => { if (token) loadData() }, [token])

  const handleAuth = async (e) => {
    e.preventDefault()
    try {
      const url = isLogin ? `${API}/auth/login` : `${API}/auth/register`
      const payload = isLogin ? { email, password } : { name, email, password }
      const res = await axios.post(url, payload)
      localStorage.setItem('token', res.data.token)
      setToken(res.data.token); setUser(res.data)
    } catch (err) { alert(err.response?.data?.msg || 'Auth failed') }
  }

  const addTx = async (e) => {
    e.preventDefault()
    await axios.post(`${API}/transactions`, { type, amount, category, description: desc }, headers)
    setAmount(''); setDesc(''); loadData()
  }

  const deleteTx = async (id) => {
    await axios.delete(`${API}/transactions/${id}`, headers)
    loadData()
  }

  const convert = async () => {
    const res = await axios.get(`${API}/exchange?from=${fromCur}&to=${toCur}&amount=${exAmount}`)
    setExResult(res.data)
  }

  const logout = () => { localStorage.removeItem('token'); setToken(''); setUser(null) }

  if (!token) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <h1>💰 Fintrack</h1>
          <p>Track money. Convert currency. Grow.</p>
          <div className="tabs">
            <button className={isLogin ? 'active' : ''} onClick={() => setIsLogin(true)}>Login</button>
            <button className={!isLogin ? 'active' : ''} onClick={() => setIsLogin(false)}>Register</button>
          </div>
          <form onSubmit={handleAuth}>
            {!isLogin && <input placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required />}
            <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            <button className="btn-primary" type="submit">{isLogin ? 'Login →' : 'Create Account →'}</button>
          </form>
          <small>Test: deroh@test.com / 123456</small>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header><h2>💰 Fintrack</h2><div><span>Hi, {user?.name || 'Deroh'}</span><button onClick={logout}>Logout</button></div></header>
      <div className="cards">
        <div className="card green"><span>Income</span><h3>KES {summary.income.toLocaleString()}</h3></div>
        <div className="card red"><span>Expense</span><h3>KES {summary.expense.toLocaleString()}</h3></div>
        <div className="card blue"><span>Balance</span><h3>KES {summary.balance.toLocaleString()}</h3></div>
      </div>
      <div className="grid">
        <div className="panel">
          <h3>Add Transaction</h3>
          <form onSubmit={addTx}>
            <div className="row"><button type="button" className={type === 'income' ? 'chip active-green' : 'chip'} onClick={() => setType('income')}>+ Income</button><button type="button" className={type === 'expense' ? 'chip active-red' : 'chip'} onClick={() => setType('expense')}>- Expense</button></div>
            <input placeholder="Amount (KES)" type="number" value={amount} onChange={e => setAmount(e.target.value)} required />
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option>Food</option><option>Transport</option><option>Rent</option><option>Salary</option><option>Business</option><option>Other</option>
            </select>
            <input placeholder="Description (e.g. Lunch)" value={desc} onChange={e => setDesc(e.target.value)} />
            <button className="btn-primary">Add Transaction</button>
          </form>
          <h3 style={{ marginTop: 20 }}>Recent Transactions</h3>
          {txs.length === 0 && <p style={{ color: '#888' }}>No transactions yet. Add one above!</p>}
          {txs.map(t => (
            <div key={t.id} className="tx"><span>{t.category} • {t.description}</span><b style={{ color: t.type === 'income' ? 'green' : 'red' }}>{t.type === 'income' ? '+' : '-'} KES {t.amount}</b><button onClick={() => deleteTx(t.id)}>✕</button></div>
          ))}
        </div>
        <div className="panel">
          <h3>💱 Currency Converter</h3>
          <p>Live rates — KES, USD, EUR, GBP, UGX, TZS</p>
          <input type="number" value={exAmount} onChange={e => setExAmount(e.target.value)} />
          <div className="row">
            <select value={fromCur} onChange={e => setFromCur(e.target.value)}><option>KES</option><option>USD</option><option>EUR</option><option>GBP</option><option>UGX</option><option>TZS</option></select>
            <span>→</span>
            <select value={toCur} onChange={e => setToCur(e.target.value)}><option>USD</option><option>KES</option><option>EUR</option><option>GBP</option><option>UGX</option><option>TZS</option></select>
          </div>
          <button className="btn-primary" onClick={convert}>Convert</button>
          {exResult && <div className="result"><h2>{exResult.converted.toFixed(2)} {exResult.to}</h2><small>1 {exResult.from} = {exResult.rate} {exResult.to}</small></div>}
        </div>
      </div>
    </div>
  )
}
export default App